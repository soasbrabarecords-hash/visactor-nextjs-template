import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260715193000_create_track_genre_profiles.sql",
    import.meta.url,
  ),
  "utf8",
);

test("creates global profiles and workspace-scoped overrides", () => {
  assert.match(
    migration,
    /create table if not exists public\.track_genre_profiles/i,
  );
  assert.match(
    migration,
    /create table if not exists public\.music_genre_overrides/i,
  );
  assert.match(migration, /unique \(workspace_id, entity_type, entity_id\)/i);
  assert.match(migration, /manual genre corrections/i);
});

test("protects genre data behind server-side access", () => {
  assert.match(
    migration,
    /alter table public\.track_genre_profiles enable row level security/i,
  );
  assert.match(
    migration,
    /alter table public\.music_genre_overrides enable row level security/i,
  );
  assert.match(
    migration,
    /revoke all on public\.music_genre_overrides from anon, authenticated/i,
  );
});
