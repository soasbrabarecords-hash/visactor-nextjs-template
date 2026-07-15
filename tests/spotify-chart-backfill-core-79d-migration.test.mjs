import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260715024520_add_spotify_chart_core_79d.sql",
    import.meta.url,
  ),
  "utf8",
);
const rolloutMigration = await readFile(
  new URL(
    "../supabase/migrations/20260715013152_extend_spotify_chart_core_history.sql",
    import.meta.url,
  ),
  "utf8",
);

test("core-79d is the BR + Global gate between 60 and 180 days", () => {
  assert.match(
    migration,
    /'core-79d',\s*25,\s*'BR \+ Global — 79 dias',\s*'top-songs',\s*'daily',\s*79,\s*'locked'/,
  );
  assert.match(migration, /values \('BR'\), \('GLOBAL'\)/);
  assert.match(migration, /core-79d must contain exactly BR and Global/);
  assert.doesNotMatch(
    migration,
    /set phase_order = campaign\.phase_order \+ 100/,
  );
  assert.equal(79 * 2, 158);
});

test("the existing anchored seeder derives all 158 jobs without rewriting dates", () => {
  assert.match(
    rolloutMigration,
    /start_date := end_date - \(target_campaign\.window_days - 1\)/,
  );
  assert.match(
    rolloutMigration,
    /target_campaign\.window_days \* region_count/,
  );
  assert.doesNotMatch(
    migration.slice(0, migration.indexOf("create or replace function")),
    /set\s+(target_start_date|target_end_date|expected_job_count|linked_job_count)\s*=/,
  );
});

test("migration refuses to splice the gate after a successor has started", () => {
  assert.ok(
    migration.indexOf("pg_advisory_xact_lock") <
      migration.indexOf("do $migration$"),
  );
  assert.match(
    migration,
    /campaign\.phase_key in \(\s*'core-180d',[\s\S]*'cities-180d'\s*\)/,
  );
  assert.match(migration, /campaign\.started_at is not null/);
  assert.match(migration, /campaign\.target_start_date is not null/);
  assert.match(migration, /campaign\.target_end_date is not null/);
  assert.match(migration, /campaign\.status not in \('locked', 'ready'\)/);
  assert.match(
    migration,
    /from public\.spotify_chart_backfill_campaign_jobs as campaign_job/,
  );
  assert.match(
    migration,
    /core-79d cannot be inserted after a successor phase has started/,
  );
});

test("ready state is rebuilt through predecessor approval order", () => {
  assert.match(
    migration,
    /campaign\.phase_order > 20[\s\S]*campaign\.started_at is null[\s\S]*campaign\.status = 'ready'/,
  );
  assert.match(migration, /with next_eligible as/);
  assert.match(migration, /predecessor\.phase_order < candidate\.phase_order/);
  assert.match(migration, /predecessor\.status <> 'completed'/);
  assert.match(migration, /predecessor\.approved_at is null/);
  assert.match(migration, /order by candidate\.phase_order/);
});

test("covered-job reconciliation is bounded, locked and campaign-scoped", () => {
  assert.match(
    migration,
    /create or replace function public\.reconcile_spotify_chart_backfill_covered_jobs/,
  );
  assert.match(migration, /p_limit integer default 100/);
  assert.match(migration, /p_limit < 1 or p_limit > 500/);
  assert.match(migration, /target_campaign\.status <> 'running'/);
  assert.match(migration, /campaign_job\.campaign_id = target_campaign\.id/);
  assert.match(migration, /job\.status = 'pending'/);
  assert.match(migration, /job\.chart_type = target_campaign\.chart_type/);
  assert.match(migration, /job\.period = target_campaign\.period/);
  assert.match(
    migration,
    /job\.target_date between\s*target_campaign\.target_start_date and target_campaign\.target_end_date/,
  );
  assert.match(
    migration,
    /from public\.spotify_chart_complete_snapshots as complete/,
  );
  assert.match(migration, /complete\.country = job\.region_id/);
  assert.match(migration, /complete\.chart_type = job\.chart_type/);
  assert.match(migration, /complete\.chart_date = job\.target_date/);
  assert.match(migration, /for update of job skip locked/);
  assert.match(migration, /limit p_limit/);
  assert.match(migration, /status = 'skipped'/);
  assert.match(
    migration,
    /from public\.refresh_spotify_chart_backfill_campaign_progress\(p_phase_key\)/,
  );
});

test("covered-job reconciliation is service-role only", () => {
  const functionStart = migration.indexOf(
    "create or replace function public.reconcile_spotify_chart_backfill_covered_jobs",
  );
  const functionSql = migration.slice(functionStart);

  assert.match(functionSql, /security invoker/);
  assert.doesNotMatch(functionSql, /security definer/);
  assert.match(
    functionSql,
    /revoke all[\s\S]*from public, anon, authenticated/,
  );
  assert.match(functionSql, /grant execute[\s\S]*to service_role/);
});
