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

test("preflight peek is phase-scoped and clamps its batch to ten", async () => {
  rpcList = [
    { id: crypto.randomUUID(), region_id: "BR", status: "pending" },
    { id: null, region_id: null, status: null },
  ];

  const jobs = await peekNextSpotifyChartBackfillJobs({
    limit: 99,
    phaseKey: "core-1095d",
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].region_id, "BR");
  assert.equal(lastRpc.name, "peek_spotify_chart_backfill_jobs");
  assert.equal(lastRpc.params.p_limit, 10);
  assert.equal(lastRpc.params.p_phase_key, "core-1095d");
});

test("validated claim reserves the exact preflight job id", async () => {
  const jobId = crypto.randomUUID();
  rpcResult = { id: jobId, region_id: "GLOBAL", status: "running" };

  const job = await claimSpotifyChartBackfillJobById({
    jobId,
    workerId: "preflight-worker",
    phaseKey: "core-60d",
  });

  assert.equal(job?.id, jobId);
  assert.equal(lastRpc.name, "claim_spotify_chart_backfill_job_by_id");
  assert.equal(lastRpc.params.p_job_id, jobId);
  assert.equal(lastRpc.params.p_worker_id, "preflight-worker");
  assert.equal(lastRpc.params.p_phase_key, "core-60d");
});

test("preflight SQL requires the explicit running rollout phase", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260715013152_extend_spotify_chart_core_history.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.equal(
    (migration.match(/campaign\.status = 'running'/g) ?? []).length,
    2,
  );
  assert.equal(
    (
      migration.match(
        /p_phase_key is null or campaign\.phase_key = p_phase_key/g,
      ) ?? []
    ).length,
    2,
  );
  assert.doesNotMatch(migration, /campaign\.phase_key = 'core-30d'/);
  assert.match(migration, /p_phase_key text default null/);
  assert.match(migration, /window_days between 1 and 1095/);
  assert.match(migration, /snapshot\.total_tracks = 200/);
  assert.match(migration, /integrity\.unique_track_ids = 200/);
  assert.match(migration, /nullif\(btrim\(track\.track_name\), ''\) is null/);
  assert.match(
    migration,
    /track\.chart_date is distinct from snapshot\.chart_date/,
  );
  assert.match(migration, /rollout_anchor_end_date/);
  assert.match(
    migration,
    /spotify_chart_backfill_campaigns_exact_window_check/,
  );
  assert.match(migration, /immediate_successor/);
  assert.match(migration, /retry_pending_job_count <> 0/);
  assert.ok(
    migration.indexOf("pg_advisory_xact_lock") <
      migration.indexOf("do $migration$"),
  );
  assert.ok(
    migration.indexOf(
      "from public.refresh_spotify_chart_backfill_campaign_progress(null)",
    ) < migration.indexOf("validate constraint"),
  );
  assert.equal(
    (migration.match(/where campaign_job\.job_id = job\.id/g) ?? []).length,
    2,
  );
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

test("legacy chart snapshots normalize onto the atomic worker identity", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260715021500_normalize_spotify_chart_snapshot_identity.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /set chart_type = 'top-songs'[\s\S]*where chart_type = 'top_200_daily'/,
  );
  assert.match(
    migration,
    /drop constraint if exists chart_snapshots_chart_date_country_key/,
  );
  assert.match(
    migration,
    /lock table public\.chart_snapshots in share row exclusive mode/,
  );
  assert.match(
    migration,
    /drop index if exists public\.chart_snapshots_chart_date_country_key/,
  );
  assert.match(
    migration,
    /chart_snapshots_country_type_date_key[\s\S]*country, chart_type, chart_date/,
  );
  assert.match(migration, /alter column chart_type set default 'top-songs'/);
  assert.match(migration, /legacy and canonical rows overlap/);
});

test("non-atomic snapshot writes cannot recreate the legacy chart identity", async () => {
  const source = await readFile(
    new URL("../src/lib/chart-snapshots.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /input\.chart_type \?\? "top-songs"/);
  assert.doesNotMatch(source, /input\.chart_type \?\? "top_200_daily"/);
});
