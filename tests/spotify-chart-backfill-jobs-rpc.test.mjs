import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mock, test } from "node:test";

let rpcResult = null;
let rpcList = [];
let lastRpc = null;

mock.module("@/lib/supabase/admin", {
  exports: {
    createAdminClient: () => ({
      rpc: (name, params) => {
        lastRpc = { name, params };

        if (name === "peek_spotify_chart_backfill_jobs") {
          return Promise.resolve({ data: rpcList, error: null });
        }

        return {
          maybeSingle: async () => ({ data: rpcResult, error: null }),
        };
      },
    }),
  },
});

const {
  claimNextSpotifyChartBackfillJob,
  claimSpotifyChartBackfillJobById,
  peekNextSpotifyChartBackfillJobs,
  settleSpotifyChartBackfillJob,
} = await import("../src/lib/charts/spotify-chart-backfill-jobs.ts");

test.beforeEach(() => {
  rpcResult = null;
  rpcList = [];
  lastRpc = null;
});

test("claim treats Postgres null composite rows as an empty queue", async () => {
  rpcResult = {
    id: null,
    region_id: null,
    lease_token: null,
    status: null,
  };

  const claimed = await claimNextSpotifyChartBackfillJob({
    workerId: "unit-test-worker",
  });

  assert.equal(claimed, null);
});

test("settle treats a fenced or expired lease as no result", async () => {
  rpcResult = {
    id: null,
    region_id: null,
    lease_token: null,
    status: null,
  };

  const settled = await settleSpotifyChartBackfillJob({
    jobId: crypto.randomUUID(),
    leaseToken: crypto.randomUUID(),
    outcome: "success",
  });

  assert.equal(settled, null);
});

test("claim preserves a real reserved job", async () => {
  const job = {
    id: crypto.randomUUID(),
    region_id: "BR",
    lease_token: crypto.randomUUID(),
    status: "running",
  };
  rpcResult = job;

  const claimed = await claimNextSpotifyChartBackfillJob({
    workerId: "unit-test-worker",
  });

  assert.equal(claimed?.id, job.id);
  assert.equal(claimed?.status, "running");
});

test("preflight peek is read-only and clamps its batch to ten", async () => {
  rpcList = [
    { id: crypto.randomUUID(), region_id: "BR", status: "pending" },
    { id: null, region_id: null, status: null },
  ];

  const jobs = await peekNextSpotifyChartBackfillJobs({ limit: 99 });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].region_id, "BR");
  assert.equal(lastRpc.name, "peek_spotify_chart_backfill_jobs");
  assert.equal(lastRpc.params.p_limit, 10);
});

test("validated claim reserves the exact preflight job id", async () => {
  const jobId = crypto.randomUUID();
  rpcResult = { id: jobId, region_id: "GLOBAL", status: "running" };

  const job = await claimSpotifyChartBackfillJobById({
    jobId,
    workerId: "preflight-worker",
  });

  assert.equal(job?.id, jobId);
  assert.equal(lastRpc.name, "claim_spotify_chart_backfill_job_by_id");
  assert.equal(lastRpc.params.p_job_id, jobId);
  assert.equal(lastRpc.params.p_worker_id, "preflight-worker");
});

test("preflight SQL is pinned to the running core-30d campaign", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260713235000_preflight_spotify_chart_backfill_sources.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.equal(
    (migration.match(/campaign\.phase_key = 'core-30d'/g) ?? []).length,
    2,
  );
  assert.equal(
    (migration.match(/campaign\.status = 'running'/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(migration, /not exists\s*\([\s\S]*campaign_job\.job_id/);
});

test("historical snapshot RPC is service-role only and enforces an atomic Top 200", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260713235900_atomic_spotify_chart_backfill_snapshot.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /replace_spotify_chart_snapshot_v1/);
  assert.match(migration, /v_track_count <> 200/);
  assert.match(migration, /v_unique_positions <> 200/);
  assert.match(migration, /v_unique_track_ids <> 200/);
  assert.match(migration, /delete from public\.chart_snapshot_tracks/);
  assert.match(migration, /get diagnostics v_inserted = row_count/);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});
