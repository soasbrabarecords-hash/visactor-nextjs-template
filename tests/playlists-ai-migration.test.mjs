import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260715223107_create_playlist_ai_conversations.sql",
  import.meta.url,
);

test("playlist ai memory migration is workspace scoped and protected by RLS", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.playlist_ai_conversations/i);
  assert.match(sql, /create table public\.playlist_ai_messages/i);
  assert.match(
    sql,
    /foreign key \(conversation_id, workspace_id, user_id\)[\s\S]*references public\.playlist_ai_conversations \(id, workspace_id, user_id\)/i,
  );
  assert.match(
    sql,
    /alter table public\.playlist_ai_conversations enable row level security/i,
  );
  assert.match(
    sql,
    /alter table public\.playlist_ai_messages enable row level security/i,
  );
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /playlist_ai_user_has_workspace_access\(workspace_id\)/i);
  assert.match(
    sql,
    /revoke all on public\.playlist_ai_messages from anon, authenticated/i,
  );
  assert.match(
    sql,
    /create index playlist_ai_messages_conversation_timeline_idx/i,
  );
});
