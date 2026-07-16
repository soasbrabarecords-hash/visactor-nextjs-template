import assert from "node:assert/strict";
import { mock, test } from "node:test";

const conversationId = "11111111-1111-4111-8111-111111111111";
let access = {
  allowed: true,
  status: 200,
  workspaceId: "workspace-1",
  userId: "user-1",
};
let archiveInput = null;
let archiveResult = true;

mock.module("@/lib/playlist-os-read-access", {
  exports: { getPlaylistOsReadAccess: async () => access },
});

mock.module("@/lib/playlists-ai-conversations", {
  exports: {
    getPlaylistAiConversation: async () => null,
    archivePlaylistAiConversation: async (input) => {
      archiveInput = input;
      return archiveResult;
    },
  },
});

const { DELETE } =
  await import("../src/app/api/playlists-ia/conversations/[conversationId]/route.ts");

test.beforeEach(() => {
  access = {
    allowed: true,
    status: 200,
    workspaceId: "workspace-1",
    userId: "user-1",
  };
  archiveInput = null;
  archiveResult = true;
});

test("conversation archive stays scoped to the active user and workspace", async () => {
  const response = await DELETE(new Request("https://example.test"), {
    params: Promise.resolve({ conversationId }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(archiveInput, {
    conversationId,
    workspaceId: "workspace-1",
    userId: "user-1",
  });
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
});

test("conversation archive rejects invalid identifiers", async () => {
  const response = await DELETE(new Request("https://example.test"), {
    params: Promise.resolve({ conversationId: "invalid" }),
  });

  assert.equal(response.status, 400);
  assert.equal(archiveInput, null);
});

test("conversation archive enforces Playlist OS access", async () => {
  access = { allowed: false, status: 403, message: "Sem acesso." };
  const response = await DELETE(new Request("https://example.test"), {
    params: Promise.resolve({ conversationId }),
  });

  assert.equal(response.status, 403);
  assert.equal(archiveInput, null);
});

test("conversation archive reports a missing scoped conversation", async () => {
  archiveResult = false;
  const response = await DELETE(new Request("https://example.test"), {
    params: Promise.resolve({ conversationId }),
  });

  assert.equal(response.status, 404);
});
