import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { exports: {} });

function track(
  id,
  {
    action = "add_now",
    freshnessScore = 80,
    isNewEntry = false,
    momentumScore = 70,
    opportunityScore = 75,
    saturationRisk = 20,
  } = {},
) {
  return {
    id,
    snapshotTrackId: `snapshot-${id}`,
    spotifyTrackId: id,
    spotifyUrl: `https://open.spotify.com/track/${id}`,
    name: `Faixa ${id}`,
    artists: "Artista Teste",
    coverUrl: null,
    primaryCountry: "BR",
    countries: ["BR"],
    currentPosition: 80,
    positions: { BR: 80 },
    previousPosition: 100,
    movement24h: 3,
    movement7d: 20,
    movement14d: 25,
    movement30d: 30,
    peakPosition: 70,
    streams: 300_000,
    observedDays30: 8,
    isNewEntry,
    action,
    actionLabel: action === "review" ? "Revisar" : "Adicionar agora",
    suggestedPlaylistName: null,
    explanation: "Sinal verificado no chart.",
    scores: {
      heatScore: 60,
      momentumScore,
      freshnessScore,
      stabilityScore: 55,
      saturationRisk,
      crossoverScore: 0,
      opportunityScore,
    },
  };
}

const candidates = [
  track("recent", { freshnessScore: 88, saturationRisk: 10 }),
  track("new-fresh", {
    isNewEntry: true,
    freshnessScore: 95,
    saturationRisk: 30,
  }),
  track("new-lower-freshness", {
    isNewEntry: true,
    freshnessScore: 62,
    saturationRisk: 5,
  }),
  track("old", { freshnessScore: 59, saturationRisk: 5 }),
  track("saturated", {
    isNewEntry: true,
    freshnessScore: 100,
    saturationRisk: 55,
  }),
  track("review", {
    action: "review",
    isNewEntry: true,
    freshnessScore: 100,
    saturationRisk: 15,
  }),
];

mock.module("@/lib/music-intelligence", {
  exports: {
    getMusicIntelligence: async () => ({
      summary: {
        latestChartDate: "2026-07-20",
        maxWindow: 365,
        status: "ready",
      },
      candidatePool: { BR: candidates, GLOBAL: [] },
    }),
  },
});
mock.module("@/lib/spotify-user", {
  exports: {
    fetchSpotifyAccountPlaylists: async () => null,
    fetchSpotifyEditablePlaylist: async () => null,
    fetchSpotifyPlaylistTrackIds: async () => null,
    withSpotifyToken: async () => null,
  },
});
mock.module("@/lib/track-profile-engine", {
  exports: { getTrackGenreProfiles: async () => new Map() },
});
mock.module("@/lib/workspaces", {
  exports: { getCurrentWorkspaceSelection: async () => null },
});
mock.module("@/lib/supabase/admin", {
  exports: { createAdminClient: () => null },
});
mock.module("@/lib/playlists-ai-python-client", {
  exports: { rankPlaylistCandidates: async () => null },
});

const { getChartOpportunities } =
  await import("../src/lib/playlists-ai-tools.ts");

test("discovery keeps recent low-saturation candidates and orders new entries first", async () => {
  const result = await getChartOpportunities({
    market: "BR",
    mode: "discovery",
    limit: 10,
  });

  assert.deepEqual(
    result.cards.map((card) => card.spotifyTrackId),
    ["new-fresh", "new-lower-freshness", "recent"],
  );
  assert.ok(
    result.cards.every((card) => /Radar de descoberta/.test(card.reason)),
  );
  assert.ok(
    result.cards.every((card) => card.statusLabel === "Descoberta em formação"),
  );
});
