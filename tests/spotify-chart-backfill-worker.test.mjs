import assert from "node:assert/strict";
import { mock, test } from "node:test";

const queuedJobs = [];
const claimCalls = [];
const settledJobs = [];
let backfillCalls = [];
let sourceProbeError = null;
let sourceProbeFailureRegion = null;
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
    status: "pending",
    attempts: 0,
    max_attempts: 3,
    next_attempt_at: "2026-07-13T00:00:00.000Z",
    last_error: null,
    worker_id: null,
    lease_token: null,
    lease_expires_at: null,
    started_at: null,
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
          eq() {
            return chain;
          },
          order() {
            return chain;
          },
          limit: async () => ({
            data: Array.from(
              { length: snapshotTrackCount },
              (_value, index) => ({
                position: index + 1,
                spotify_track_id: `track-${index + 1}`,
              }),
            ),
            error: null,
          }),
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
    peekNextSpotifyChartBackfillJobs: async ({ limit }) =>
      queuedJobs.slice(0, limit),
    claimSpotifyChartBackfillJobById: async (input) => {
      claimCalls.push(input);
      const index = queuedJobs.findIndex((job) => job.id === input.jobId);
      if (index < 0) return null;
      const [job] = queuedJobs.splice(index, 1);
      return {
        ...job,
        status: "running",
        attempts: job.attempts + 1,
        worker_id: input.workerId,
        lease_token: crypto.randomUUID(),
        lease_expires_at: "2099-01-01T00:00:00.000Z",
        started_at: "2026-07-13T00:00:00.000Z",
      };
    },
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

mock.module("@/lib/charts/spotify-chart-source-test", {
  exports: {
    probeSpotifyChartHistoricalSource: async (input) => {
      if (
        sourceProbeError &&
        (!sourceProbeFailureRegion ||
          sourceProbeFailureRegion === input.regionId)
      ) {
        throw sourceProbeError;
      }
      if (input.regionId.startsWith("BR-")) {
        throw new Error("historical city source not configured");
      }

      return {
        chart: {
          chartType: input.chartType,
          country: input.regionId,
          metadataMarket: input.regionId === "GLOBAL" ? "US" : "BR",
          sourceKey: input.regionId.toLowerCase(),
          csvUrlTemplate: null,
          fallbackUrl: null,
          officialChartAlias: null,
        },
        downloaded: {
          chartDate: input.date,
          csvText: "validated csv",
          sourceUrl: "https://example.test/chart.csv",
          sourceType: "spotify_official",
          sourceProvider: "spotify_official_api",
          httpStatus: 200,
          contentType: "application/json",
          bytes: 1024,
          durationMs: 15,
        },
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
  queuedJobs.length = 0;
  claimCalls.length = 0;
  settledJobs.length = 0;
  backfillCalls = [];
  sourceProbeError = null;
  sourceProbeFailureRegion = null;
  failedSettlementStatus = "failed";
  snapshotAvailableBeforeImport = false;
  snapshotReadsByKey.clear();
  snapshotTotalTracks = 200;
  snapshotTrackCount = 200;
});

test("worker isolates a failed GLOBAL job from a successful BR job", async () => {
  queuedJobs.push(
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

test("worker blocks an unvalidated city before claiming its job", async () => {
  queuedJobs.push(makeJob({ region_id: "BR-SP-SAO-PAULO" }));

  const result = await processSpotifyChartBackfillQueue({ limit: 1 });

  assert.equal(result.processed, 0);
  assert.equal(result.sourceBlocked, true);
  assert.equal(claimCalls.length, 0);
  assert.equal(settledJobs.length, 0);
  assert.equal(backfillCalls.length, 0);
});

test("worker skips a snapshot that is already complete", async () => {
  snapshotAvailableBeforeImport = true;
  queuedJobs.push(makeJob());

  const result = await processSpotifyChartBackfillQueue({ limit: 1 });

  assert.equal(result.processed, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.results[0].rowsCount, 200);
  assert.equal(backfillCalls.length, 0);
  assert.equal(settledJobs[0].outcome, "skipped");
});

test("worker never treats an internally consistent 100-row snapshot as Top 200", async () => {
  snapshotAvailableBeforeImport = true;
  snapshotTotalTracks = 100;
  snapshotTrackCount = 100;
  failedSettlementStatus = "pending";
  queuedJobs.push(makeJob());

  const result = await processSpotifyChartBackfillQueue({ limit: 1 });

  assert.equal(result.skipped, 0);
  assert.equal(result.retryPending, 1);
  assert.equal(backfillCalls.length, 1);
  assert.match(settledJobs[0].error, /Snapshot incompleto/);
});

test("worker rejects a partial snapshot and leaves it queued for retry", async () => {
  failedSettlementStatus = "pending";
  snapshotTrackCount = 199;
  queuedJobs.push(makeJob());

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

test("worker leaves attempts untouched when source preflight fails", async () => {
  const job = makeJob();
  queuedJobs.push(job);
  sourceProbeError = new Error("Spotify historical source returned 401");

  const result = await processSpotifyChartBackfillQueue({ limit: 3 });

  assert.equal(result.processed, 0);
  assert.equal(result.sourceBlocked, true);
  assert.equal(result.sourceErrors.length, 1);
  assert.equal(claimCalls.length, 0);
  assert.equal(settledJobs.length, 0);
  assert.equal(backfillCalls.length, 0);
  assert.equal(job.attempts, 0);
  assert.equal(job.status, "pending");
});

test("a failure in the second preflight does not claim the first validated job", async () => {
  const br = makeJob({ region_id: "BR" });
  const global = makeJob({
    region_id: "GLOBAL",
    target_date: "2026-07-11",
  });
  queuedJobs.push(br, global);
  sourceProbeError = new Error("GLOBAL source returned 401");
  sourceProbeFailureRegion = "GLOBAL";

  const result = await processSpotifyChartBackfillQueue({ limit: 2 });

  assert.equal(result.sourceValidated, 1);
  assert.equal(result.sourceBlocked, true);
  assert.equal(result.processed, 0);
  assert.equal(claimCalls.length, 0);
  assert.equal(settledJobs.length, 0);
  assert.equal(br.attempts, 0);
  assert.equal(global.attempts, 0);
});
