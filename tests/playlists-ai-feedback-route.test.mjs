import assert from "node:assert/strict";
import { mock, test } from "node:test";

let access = {
  allowed: true,
  status: 200,
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "curador",
};
let forwardedResult = { ok: true, value: { accepted: true } };
let forwardedPayload = null;

mock.module("@/lib/playlist-os-read-access", {
  exports: {
    getPlaylistOsReadAccess: async () => access,
  },
});

mock.module("@/lib/playlists-ai-python-client", {
  exports: {
    sendPlaylistAiFeedback: async (payload) => {
      forwardedPayload = payload;
      return forwardedResult;
    },
  },
});

const { POST } = await import("../src/app/api/playlists-ia/feedback/route.ts");

test.beforeEach(() => {
  access = {
    allowed: true,
    status: 200,
    workspaceId: "workspace-1",
    userId: "user-1",
    role: "curador",
  };
  forwardedResult = { ok: true, value: { accepted: true } };
  forwardedPayload = null;
});

function request(body) {
  return new Request("http://localhost/api/playlists-ia/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  request_id: "request-1",
  track_id: "track-1",
  action: "pin",
  target_playlist_id: null,
  actor_id: "forged-user",
  actor_role: "owner",
  event_id: "event-1",
  occurred_at: "2026-07-21T12:00:00-03:00",
};

test("feedback route scopes the event to the authenticated workspace", async () => {
  const response = await POST(request(validBody));
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.success, true);
  assert.equal(body.forwarded, true);
  assert.deepEqual(forwardedPayload, {
    workspace_id: "workspace-1",
    request_id: "request-1",
    track_id: "track-1",
    action: "pin",
    target_playlist_id: null,
    actor_id: "user-1",
    actor_role: "curador",
    event_id: "event-1",
    occurred_at: "2026-07-21T15:00:00.000Z",
  });
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
});

test("feedback route carries the chosen destination for add events", async () => {
  const response = await POST(
    request({
      ...validBody,
      action: "add",
      target_playlist_id: "spotify-playlist-2",
    }),
  );

  assert.equal(response.status, 202);
  assert.equal(forwardedPayload.target_playlist_id, "spotify-playlist-2");

  forwardedPayload = null;
  const missingTarget = await POST(
    request({ ...validBody, action: "add", target_playlist_id: null }),
  );
  assert.equal(missingTarget.status, 400);
  assert.equal(forwardedPayload, null);
});

test("feedback route rejects access and malformed actions before forwarding", async () => {
  access = { allowed: false, status: 403, message: "Sem acesso." };
  const forbidden = await POST(request(validBody));
  assert.equal(forbidden.status, 403);
  assert.equal(forwardedPayload, null);

  access = {
    allowed: true,
    status: 200,
    workspaceId: "workspace-1",
    userId: "user-1",
    role: "curador",
  };
  const invalid = await POST(request({ ...validBody, action: "execute" }));
  assert.equal(invalid.status, 400);
  assert.equal(forwardedPayload, null);
});

test("feedback route rejects read-only roles before they can poison learning", async () => {
  access = {
    allowed: true,
    status: 200,
    workspaceId: "workspace-1",
    userId: "viewer-1",
    role: "viewer",
  };
  const response = await POST(
    request({
      ...validBody,
      actor_id: "forged-admin",
      actor_role: "owner",
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(forwardedPayload, null);
});

test("feedback remains non-blocking when the Python service is disabled", async () => {
  forwardedResult = { ok: false, reason: "not_configured" };
  const response = await POST(request(validBody));
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.success, true);
  assert.equal(body.forwarded, false);
  assert.equal(body.skipped, true);
});

test("feedback returns a retryable error when configured Python delivery fails", async () => {
  forwardedResult = { ok: false, reason: "network_error" };
  const response = await POST(request(validBody));
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.success, false);
  assert.equal(body.retryable, true);
  assert.equal(body.forwarded, false);
});
