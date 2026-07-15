import assert from "node:assert/strict";
import test from "node:test";
import { buildPlaylistIntelligence } from "../src/lib/playlist-intelligence.ts";

function track(overrides = {}) {
  return {
    id: "AAAAAAAAAAAAAAAAAAAAAA",
    name: "Faixa sem leitura legada",
    artists: "Artista",
    imageUrl: null,
    currentIndex: 0,
    popularity: null,
    chartPosition: null,
    chartMovement: null,
    chartPositionChange: null,
    chartStreams: null,
    dailyStreams: null,
    dailyDelta: null,
    streamTrend: null,
    streamsLoading: false,
    signalsLoading: false,
    ...overrides,
  };
}

test("missing Spotify popularity is not treated as popularity zero", () => {
  const result = buildPlaylistIntelligence([track()]);
  const decision = result.decisions[0];

  assert.equal(decision.action, "keep");
  assert.equal(decision.label, "Sem leitura");
  assert.equal(decision.signals.includes("popularidade baixa"), false);
});

test("chart and stream signals still produce a useful decision without popularity", () => {
  const result = buildPlaylistIntelligence([
    track({
      chartPosition: 12,
      chartMovement: "up",
      chartPositionChange: 8,
      chartStreams: 900_000,
      dailyStreams: 1_100_000,
      dailyDelta: 80_000,
      streamTrend: "up",
    }),
  ]);
  const decision = result.decisions[0];

  assert.ok(decision.score > 50);
  assert.notEqual(decision.label, "Sem leitura");
  assert.ok(decision.signals.some((signal) => signal.includes("Spotify BR")));
});
