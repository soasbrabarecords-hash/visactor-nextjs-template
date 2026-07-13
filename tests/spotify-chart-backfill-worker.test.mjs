import assert from "node:assert/strict";
import { mock, test } from "node:test";

const claimedJobs = [];
const settledJobs = [];
let backfillCalls = [];
let failedSettlementStatus = "failed";
let snapshotAvailableBeforeImport = false;
const snapshotReadsByKey = new Map();
let snapshotTotalTracks = 200;
let snapshotTrackCount = 200;

function makeJob(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    region_id: "BR",
    chart_type: "top-songs",
    period: "daily",
    target_date: "2026-07-12",
    status: "running",
    attempts: 1,
    max_attempts: 3,
    next_attempt_at: "2026-07-13T00:00:00.000Z",
    last_error: null,
    worker_id: "test-worker",
    lease_token: crypto.randomUUID(),
    lease_expires_at: "2099-01-01T00:00:00.000Z",
    started_at: "2026-07-13T00:00:00.000Z",
    finished_at: null,
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

function createSnapshotAdmin() {
  return {
    from(table) {
      if (table === "chart_snapshots") {
        const filters = {};
        const chain = {
          eq(field, value) {
            filters[field] = value;
            return chain;
          },
          maybeSingle: async () => {
            const key = `${filters.country}:${filters.chart_type}:${filters.chart_date}`;
            const reads = (snapshotReadsByKey.get(key) ?? 0) + 1;
            snapshotReadsByKey.set(key, reads);

            return {
              data:
                snapshotAvailableBeforeImport || reads > 1
                  ? {
                      id: "snapshot-id",
                      total_tracks: snapshotTotalTracks,
                    }
                  : null,
              error: null,
            };
          },
          select() {
            return chain;
          },
        };
        return chain;
      }

      if (table === "chart_snapshot_tracks") {
        const chain = {
          eq: async () => ({ count: snapshotTrackCount, error: null }),
          select() {
            return chain;
          },
        };
        return chain;
      }

      throw new Error(`Unexpected table ${table}.`);
    },
  };
}

mock.module("@/lib/charts/spotify-chart-backfill-jobs", {
  exports: {
    SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT: 3,
    SPOTIFY_CHART_BACKFILL_MAX_LIMIT: 10,
    claimNextSpotifyChartBackfillJob: async () => claimedJobs.shift() ?? null,
    recoverExpiredSpotifyChartBackfillJobs: async () => 0,
    settleSpotifyChartBackfillJob: async (input) => {
      settledJobs.push(input);
      return {
        id: input.jobId,
        status:
          input.outcome === "failed" ? failedSettlementStatus : input.outcome,
      };
    },
  },
});

mock.module("@/lib/charts/spotify-chart-backfill", {
  exports: {
    backfillSpotifyCharts: async (input) => {
      backfillCalls.push(input);

      if (input.country === "GLOBAL") {
        return {
          results: [{ success: false, error: "source unavailable" }],
        };
      }

      return {
        results: [{ success: true, rowsCount: 200 }],
      };
    },
  },
});

mock.module("@/lib/supabase/admin", {
  exports: {
    createAdminClient: () => createSnapshotAdmin(),
  },
});

const { processSpotifyChartBackfillQueue } =
  await import("../src/lib/charts/spotify-chart-backfill-worker.ts");

test.beforeEach(() => {
  claimedJobs.length = 0;
  settledJobs.length = 0;
  backfillCalls = [];
  failedSettlementStatus = "failed";
  snapshotAvailableBeforeImport = false;
  snapshotReadsByKey.clear();
  snapshotTotalTracks = 200;
  snapshotTrackCount = 200;
});

test("worker isolates a failed GLOBAL job from a successful BR job", async () => {
  claimedJobs.push(
    makeJob({ region_id: "BR" }),
    makeJob({ region_id: "GLOBAL", target_date: "2026-07-11" }),
  );

  const result = await processSpotifyChartBackfillQueue({ limit: 2 });

  assert.equal(result.processed, 2);
  assert.equal(result.success, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.lostLease, 0);
  assert.deepEqual(
    settledJobs.map(({ outcome }) => outcome),
    ["success", "failed"],
  );
  assert.equal(backfillCalls.length, 2);
});

test("worker skips unsupported cities without invoking the importer", async () => {
  claimedJobs.push(makeJob({ region_id: "BR-SP-SAO-PAULO" }));

  const result = await processSpotifyChartBackfillQueue({ limit: 1 });

  assert.equal(result.processed, 1);
  assert.equal(result.skipped, 1);
  assert.equal(backfillCalls.length, 0);
  assert.equal(settledJobs[0].outcome, "skipped");
});

test("worker skips a snapshot that is already complete", async () => {
  snapshotAvailableBeforeImport = true;
  claimedJobs.push(makeJob());

  const result = await processSpotifyChartBackfillQueue({ limit: 1 });

  assert.equal(result.processed, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.results[0].rowsCount, 200);
  assert.equal(backfillCalls.length, 0);
  assert.equal(settledJobs[0].outcome, "skipped");
});

test("worker rejects a partial snapshot and leaves it queued for retry", async () => {
  failedSettlementStatus = "pending";
  snapshotTrackCount = 199;
  claimedJobs.push(makeJob());

  const result = await processSpotifyChartBackfillQueue({ limit: 1 });

  assert.equal(result.processed, 1);
  assert.equal(result.success, 0);
  assert.equal(result.retryPending, 1);
  assert.equal(result.failed, 0);
  assert.equal(settledJobs[0].outcome, "failed");
  assert.match(settledJobs[0].error, /Snapshot incompleto/);
});

test("worker stops cleanly when the queue is empty and clamps its limit", async () => {
  const result = await processSpotifyChartBackfillQueue({ limit: 999 });

  assert.equal(result.appliedLimit, 10);
  assert.equal(result.processed, 0);
  assert.equal(result.success, 0);
  assert.equal(result.failed, 0);
});
