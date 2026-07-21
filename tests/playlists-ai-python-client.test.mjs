import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { exports: {} });

const {
  rankPlaylistCandidates,
  runPlaylistAiMaintenance,
  sendPlaylistAiFeedback,
} = await import("../src/lib/playlists-ai-python-client.ts");

const config = {
  baseUrl: "https://python.example.test",
  token: "internal-token",
  timeoutMs: 250,
};

function rankInput() {
  return {
    workspace_id: "workspace-1",
    playlist_id: "playlist-1",
    playlist_name: "FUNK 2026",
    genre: "funk",
    market: "BR",
    as_of: "2026-07-21T12:00:00.000Z",
    limit: 2,
    candidates: [1, 2].map((index) => ({
      track_id: `track-${index}`,
      name: `Faixa ${index}`,
      artists: "Artista",
      market: "BR",
      current_position: index,
      positions: { BR: index },
      movement_7d: 4,
      opportunity_score: 80,
      heat_score: 75,
      momentum_score: 70,
      freshness_score: 65,
      stability_score: 60,
      saturation_risk: 20,
      crossover_score: 10,
      genre: "funk",
      genre_confidence: 90,
      playlist_fit: 95,
      observed_days_30: 20,
      is_new_entry: false,
      baseline_fit_score: 95,
      baseline_score: 85,
    })),
  };
}

test("rank client sends the internal token and validates a known-track response", async () => {
  let requestUrl = null;
  let requestInit = null;
  const result = await rankPlaylistCandidates(rankInput(), {
    config,
    fetcher: async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return Response.json({
        request_id: "request-1",
        model_version: "ltr-2026-07-21",
        personalized: true,
        cold_start: false,
        items: [
          {
            track_id: "track-2",
            rank: 1,
            score: 96,
            base_score: 84,
            learned_score: 98,
            reason_codes: ["workspace_affinity"],
            propensity: 0.71,
          },
          {
            track_id: "track-1",
            rank: 2,
            score: 91,
            base_score: 85,
            learned_score: 93,
            reason_codes: ["chart_momentum"],
            propensity: 0.64,
          },
        ],
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(requestUrl, "https://python.example.test/v1/rank");
  assert.equal(requestInit.headers["X-Playlists-AI-Token"], "internal-token");
  assert.equal(requestInit.headers.Authorization, undefined);
  assert.equal(requestInit.cache, "no-store");
  assert.equal(JSON.parse(requestInit.body).candidates[0].playlist_fit, 95);
  assert.deepEqual(
    result.value.items.map((item) => item.track_id),
    ["track-2", "track-1"],
  );
});

test("rank client fails closed when Python returns an unknown candidate", async () => {
  const result = await rankPlaylistCandidates(rankInput(), {
    config,
    fetcher: async () =>
      Response.json({
        request_id: "request-2",
        model_version: "ltr-test",
        personalized: false,
        cold_start: true,
        items: [
          {
            track_id: "invented-track",
            rank: 1,
            score: 99,
            base_score: 70,
            learned_score: 99,
            reason_codes: [],
            propensity: 0.5,
          },
        ],
      }),
  });

  assert.deepEqual(result, { ok: false, reason: "invalid_response" });
});

test("rank client fails closed when Python returns duplicate ranks", async () => {
  const result = await rankPlaylistCandidates(rankInput(), {
    config,
    fetcher: async () =>
      Response.json({
        request_id: "request-duplicate-rank",
        model_version: "ltr-test",
        personalized: false,
        cold_start: true,
        items: [
          {
            track_id: "track-1",
            rank: 1,
            score: 90,
            reason_codes: [],
          },
          {
            track_id: "track-2",
            rank: 1,
            score: 80,
            reason_codes: [],
          },
        ],
      }),
  });

  assert.deepEqual(result, { ok: false, reason: "invalid_response" });
});

test("rank client exposes a bounded timeout as a baseline fallback reason", async () => {
  const result = await rankPlaylistCandidates(rankInput(), {
    config: { ...config, timeoutMs: 5 },
    fetcher: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  });

  assert.deepEqual(result, { ok: false, reason: "timeout" });
});

test("feedback and maintenance use their dedicated POST endpoints", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return new Response(null, { status: 204 });
  };
  const feedback = await sendPlaylistAiFeedback(
    {
      workspace_id: "workspace-1",
      request_id: "request-1",
      track_id: "track-2",
      action: "save",
      target_playlist_id: null,
      actor_id: "user-1",
      actor_role: "curador",
      event_id: "event-1",
      occurred_at: "2026-07-21T12:01:00.000Z",
    },
    { config, fetcher },
  );
  const maintenance = await runPlaylistAiMaintenance({ config, fetcher });

  assert.equal(feedback.ok, true);
  assert.equal(maintenance.ok, true);
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "https://python.example.test/v1/feedback",
      "https://python.example.test/v1/maintenance/run",
    ],
  );
  assert.ok(calls.every((call) => call.init.method === "POST"));
  assert.deepEqual(
    {
      actor_id: JSON.parse(calls[0].init.body).actor_id,
      actor_role: JSON.parse(calls[0].init.body).actor_role,
    },
    { actor_id: "user-1", actor_role: "curador" },
  );
});

test("maintenance uses its longer operation-specific timeout", async () => {
  const result = await runPlaylistAiMaintenance({
    config: { ...config, maintenanceTimeoutMs: 5 },
    fetcher: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  });

  assert.deepEqual(result, { ok: false, reason: "timeout" });
});

test("missing configuration skips Python without throwing", async () => {
  const result = await rankPlaylistCandidates(rankInput(), { config: null });
  assert.deepEqual(result, { ok: false, reason: "not_configured" });
});
