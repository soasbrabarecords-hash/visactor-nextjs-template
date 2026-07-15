import assert from "node:assert/strict";
import { mock, test } from "node:test";

let access = {
  allowed: true,
  status: 200,
  workspaceId: "workspace-1",
  userId: "user-1",
};
let agentCalls = 0;

mock.module("@/lib/playlist-os-read-access", {
  exports: {
    getPlaylistOsReadAccess: async () => access,
  },
});

mock.module("@/lib/playlists-ai-agent", {
  exports: {
    runPlaylistsAiAgent: async ({ message }) => {
      agentCalls += 1;
      return {
        text: `Resposta para ${message}`,
        cards: [],
        actions: [],
        confidence: 80,
        dataSources: [],
        meta: {
          intent: "general",
          readOnly: true,
          generatedAt: "2026-07-15T00:00:00.000Z",
        },
      };
    },
  },
});

const { POST } = await import("../src/app/api/playlists-ia/chat/route.ts");

test.beforeEach(() => {
  access = {
    allowed: true,
    status: 200,
    workspaceId: "workspace-1",
    userId: "user-1",
  };
  agentCalls = 0;
});

test("chat route enforces Playlist OS access", async () => {
  access = { allowed: false, status: 403, message: "Sem acesso." };
  const response = await POST(
    new Request("http://localhost/api/playlists-ia/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Olá" }),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(agentCalls, 0);
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
});

test("chat route returns the structured read-only contract", async () => {
  const response = await POST(
    new Request("http://localhost/api/playlists-ia/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Quais músicas estão quentes?" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(agentCalls, 1);
  assert.equal(body.meta.readOnly, true);
  assert.deepEqual(body.cards, []);
  assert.equal(typeof body.text, "string");
});

test("chat route rejects empty messages", async () => {
  const response = await POST(
    new Request("http://localhost/api/playlists-ia/chat", {
      method: "POST",
      body: JSON.stringify({ message: "   " }),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(agentCalls, 0);
});
