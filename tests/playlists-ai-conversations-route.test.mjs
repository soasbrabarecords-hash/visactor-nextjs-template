import assert from "node:assert/strict";
import { mock, test } from "node:test";

let access = {
  allowed: true,
  status: 200,
  workspaceId: "workspace-1",
  userId: "user-1",
};
let listInput = null;

mock.module("@/lib/playlist-os-read-access", {
  exports: { getPlaylistOsReadAccess: async () => access },
});

mock.module("@/lib/playlists-ai-conversations", {
  exports: {
    listPlaylistAiConversations: async (input) => {
      listInput = input;
      return [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "FUNK 2026",
          status: "active",
          brief: {},
          lastMessageAt: null,
          createdAt: "2026-07-15T00:00:00.000Z",
          updatedAt: "2026-07-15T00:00:00.000Z",
        },
      ];
    },
  },
});

const { GET } = await import(
  "../src/app/api/playlists-ia/conversations/route.ts"
);

test.beforeEach(() => {
  access = {
    allowed: true,
    status: 200,
    workspaceId: "workspace-1",
    userId: "user-1",
  };
  listInput = null;
});

test("conversation list stays scoped to the active user and workspace", async () => {
  const response = await GET();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.conversations.length, 1);
  assert.deepEqual(listInput, {
    workspaceId: "workspace-1",
    userId: "user-1",
  });
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
});

test("conversation list enforces Playlist OS access", async () => {
  access = { allowed: false, status: 403, message: "Sem acesso." };
  const response = await GET();

  assert.equal(response.status, 403);
  assert.equal(listInput, null);
});
