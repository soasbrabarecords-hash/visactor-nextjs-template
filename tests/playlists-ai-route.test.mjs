import assert from "node:assert/strict";
import { mock, test } from "node:test";

let access = {
  allowed: true,
  status: 200,
  workspaceId: "workspace-1",
  userId: "user-1",
};
let agentCalls = 0;
let lastAgentInput = null;
let storedConversation = null;
let createCalls = 0;
let appendCalls = 0;

const conversationSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Quais músicas estão quentes?",
  status: "active",
  brief: {
    goal: null,
    market: "BR",
    playlistMode: null,
    playlistName: null,
    genre: null,
    audience: null,
    strategy: null,
    targetSize: null,
    activeIntent: "general",
    completeness: 14,
    missingFields: [],
  },
  lastMessageAt: "2026-07-15T00:00:00.000Z",
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z",
};

mock.module("@/lib/playlist-os-read-access", {
  exports: {
    getPlaylistOsReadAccess: async () => access,
  },
});

mock.module("@/lib/playlists-ai-agent", {
  exports: {
    runPlaylistsAiAgent: async (input) => {
      agentCalls += 1;
      lastAgentInput = input;
      return {
        text: `Resposta para ${input.message}`,
        cards: [],
        actions: [],
        confidence: 80,
        dataSources: [],
        brief: {
          goal: null,
          market: null,
          playlistMode: null,
          playlistName: null,
          genre: null,
          audience: null,
          strategy: null,
          targetSize: null,
          activeIntent: "general",
          completeness: 0,
          missingFields: ["goal", "market"],
        },
        meta: {
          intent: "general",
          mode: "question",
          contextComplete: false,
          readOnly: true,
          generatedAt: "2026-07-15T00:00:00.000Z",
        },
      };
    },
  },
});

mock.module("@/lib/playlists-ai-conversations", {
  exports: {
    titleFromPlaylistAiMessage: (message) => message.slice(0, 64),
    getPlaylistAiConversation: async () => storedConversation,
    createPlaylistAiConversation: async () => {
      createCalls += 1;
      return conversationSummary;
    },
    appendPlaylistAiExchange: async () => {
      appendCalls += 1;
      return conversationSummary;
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
  lastAgentInput = null;
  storedConversation = null;
  createCalls = 0;
  appendCalls = 0;
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
      body: JSON.stringify({
        message: "Quais músicas estão quentes?",
        brief: { market: "BR" },
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(agentCalls, 1);
  assert.equal(body.meta.readOnly, true);
  assert.equal(body.meta.mode, "question");
  assert.equal(body.conversation.id, conversationSummary.id);
  assert.deepEqual(lastAgentInput.brief, { market: "BR" });
  assert.deepEqual(body.cards, []);
  assert.equal(typeof body.text, "string");
  assert.equal(createCalls, 1);
  assert.equal(appendCalls, 1);
});

test("chat route resumes stored context instead of trusting browser memory", async () => {
  storedConversation = {
    ...conversationSummary,
    messages: [
      {
        id: "message-1",
        role: "user",
        content: "Quero trabalhar retenção.",
        result: null,
        createdAt: "2026-07-15T00:00:00.000Z",
      },
    ],
    latestResponse: null,
  };
  const response = await POST(
    new Request("http://localhost/api/playlists-ia/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Pode seguir.",
        conversationId: conversationSummary.id,
        brief: { market: "GLOBAL" },
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(createCalls, 0);
  assert.equal(appendCalls, 1);
  assert.deepEqual(lastAgentInput.brief, conversationSummary.brief);
  assert.deepEqual(lastAgentInput.messages, [
    { role: "user", content: "Quero trabalhar retenção." },
  ]);
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
