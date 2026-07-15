import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260715042446_optimize_spotify_chart_backfill_progress.sql",
    import.meta.url,
  ),
  "utf8",
);

test("progress refresh locks the selected campaigns before shared metrics", () => {
  assert.match(
    migration,
    /create or replace function public\.refresh_spotify_chart_backfill_campaign_progress/,
  );
  assert.match(migration, /p_phase_key text default null/);
  assert.match(migration, /raise exception 'Invalid phase_key\.'/);
  assert.match(migration, /order by campaign\.phase_order\s+for update/);
  assert.ok(
    migration.indexOf("for update;") < migration.indexOf("for progress_row in"),
  );
});

test("strict Top 200 coverage is materialized once for every target phase", () => {
  assert.match(migration, /with target_campaigns as materialized/);
  assert.match(migration, /complete as materialized/);
  assert.equal(
    (
      migration.match(
        /from public\.spotify_chart_complete_snapshots as snapshot/g,
      ) ?? []
    ).length,
    1,
  );
  assert.match(migration, /left join complete/);
  assert.match(migration, /complete\.country = job\.region_id/);
  assert.match(migration, /complete\.chart_type = job\.chart_type/);
  assert.match(migration, /complete\.chart_date = job\.target_date/);
  assert.ok(
    migration.indexOf("from public.spotify_chart_complete_snapshots") <
      migration.indexOf("loop\n"),
  );
});

test("all campaign counters and completion states retain their contracts", () => {
  for (const counter of [
    "linked_job_count",
    "covered_job_count",
    "pending_job_count",
    "retry_pending_job_count",
    "running_job_count",
    "success_job_count",
    "failed_job_count",
    "skipped_job_count",
  ]) {
    assert.match(migration, new RegExp(`${counter} =`));
  }

  assert.match(
    migration,
    /progress_row\.status in \(\s*'locked',\s*'ready',\s*'paused',\s*'cancelled'/,
  );
  assert.match(
    migration,
    /linked_count = progress_row\.expected_job_count[\s\S]*covered_count = progress_row\.expected_job_count[\s\S]*then 'completed'/,
  );
  assert.match(
    migration,
    /pending_count = 0[\s\S]*running_count = 0[\s\S]*unsatisfied_terminal_count > 0[\s\S]*then 'blocked'/,
  );
  assert.match(
    migration,
    /insert into public\.spotify_chart_backfill_campaign_logs/,
  );
  assert.match(migration, /return next refreshed_campaign/);
});

test("optimized RPC remains invoker-only and service-role scoped", () => {
  assert.match(migration, /security invoker/);
  assert.doesNotMatch(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});
