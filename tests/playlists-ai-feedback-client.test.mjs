import assert from "node:assert/strict";
import test from "node:test";

const { sendPlaylistsAiFeedback } =
  await import("../src/lib/playlists-ai-feedback-client.ts");

const card = {
  spotifyTrackId: "track-1",
  ranking: { requestId: "request-1" },
};
const now = () => new Date("2026-07-21T12:00:00.000Z");

test("feedback retries a failed delivery with the same idempotency key", async () => {
  const states = new Map();
  const calls = [];
  let status = 502;
  const fetcher = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return new Response(null, { status });
  };

  const failed = await sendPlaylistsAiFeedback(
    card,
    "add",
    states,
    "playlist-2",
    false,
    { fetcher, now },
  );
  status = 202;
  const retried = await sendPlaylistsAiFeedback(
    card,
    "add",
    states,
    "playlist-2",
    true,
    { fetcher, now },
  );
  const duplicate = await sendPlaylistsAiFeedback(
    card,
    "add",
    states,
    "playlist-2",
    false,
    { fetcher, now },
  );

  assert.equal(failed, "failed");
  assert.equal(retried, "sent");
  assert.equal(duplicate, "skipped");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].event_id, calls[1].event_id);
  assert.equal(calls[0].target_playlist_id, "playlist-2");
});

test("already-existing tracks only retry a previously failed add signal", async () => {
  const states = new Map();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return new Response(null, { status: 202 });
  };

  const result = await sendPlaylistsAiFeedback(
    card,
    "add",
    states,
    "playlist-existing",
    true,
    { fetcher, now },
  );

  assert.equal(result, "skipped");
  assert.equal(calls, 0);
});

test("non-retryable authorization failures stay deduplicated", async () => {
  const states = new Map();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return new Response(null, { status: 403 });
  };

  const first = await sendPlaylistsAiFeedback(
    card,
    "save",
    states,
    null,
    false,
    {
      fetcher,
      now,
    },
  );
  const second = await sendPlaylistsAiFeedback(
    card,
    "save",
    states,
    null,
    false,
    { fetcher, now },
  );

  assert.equal(first, "sent");
  assert.equal(second, "skipped");
  assert.equal(calls, 1);
});
