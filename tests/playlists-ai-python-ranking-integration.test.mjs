import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { exports: {} });

const playlist = {
  id: "playlist-1",
  name: "FUNK 2026",
  ownerId: "owner-1",
  ownerName: "Workspace",
  imageUrl: null,
  tracksTotal: 0,
  spotifyUrl: "https://open.spotify.com/playlist/playlist-1",
  isPublic: true,
  isCollaborative: false,
  description: "Funk em alta",
  snapshotId: "snapshot-1",
  tracks: [],
};

function intelligenceTrack(id, opportunityScore, position) {
  return {
    id,
    snapshotTrackId: `snapshot-${id}`,
    spotifyTrackId: id,
    spotifyUrl: `https://open.spotify.com/track/${id}`,
    name: `Faixa ${id}`,
    artists: "Artista Funk",
    coverUrl: null,
    primaryCountry: "BR",
    countries: ["BR"],
    currentPosition: position,
    positions: { BR: position },
    previousPosition: position + 4,
    movement24h: 1,
    movement7d: 4,
    movement14d: 8,
    movement30d: 12,
    peakPosition: position,
    streams: 500_000,
    observedDays30: 20,
    isNewEntry: false,
    action: "add_now",
    actionLabel: "Adicionar agora",
    suggestedPlaylistName: null,
    explanation: "Sinal consistente no chart.",
    scores: {
      heatScore: 80,
      momentumScore: 75,
      freshnessScore: 70,
      stabilityScore: 65,
      saturationRisk: 20,
      crossoverScore: 15,
      opportunityScore,
    },
  };
}

const first = intelligenceTrack("track-1", 90, 4);
const second = intelligenceTrack("track-2", 80, 8);
let rankResult;
let rankInput;

mock.module("@/lib/music-intelligence", {
  exports: {
    getMusicIntelligence: async () => ({
      summary: {
        latestChartDate: "2026-07-20",
        maxWindow: 365,
        status: "ready",
      },
      candidatePool: { BR: [first, second], GLOBAL: [] },
    }),
  },
});

mock.module("@/lib/spotify-user", {
  exports: {
    fetchSpotifyAccountPlaylists: async () => ({
      result: { connected: true, playlists: [playlist] },
    }),
    fetchSpotifyEditablePlaylist: async () => ({
      result: { connected: true, playlist },
    }),
    fetchSpotifyPlaylistTrackIds: async () => null,
    withSpotifyToken: async () => null,
  },
});

mock.module("@/lib/track-profile-engine", {
  exports: {
    getTrackGenreProfiles: async (tracks) =>
      new Map(
        tracks.map((track) => [
          track.spotifyTrackId,
          {
            spotifyTrackId: track.spotifyTrackId,
            primaryGenre: "funk",
            secondaryGenres: [],
            subgenres: [],
            moodTags: ["festivo"],
            energyTags: ["alta"],
            languageSignal: "pt-BR",
            countrySignal: "BR",
            genreConfidence: 90,
            confidenceLabel: "alta",
            manualOverride: false,
          },
        ]),
      ),
  },
});

mock.module("@/lib/workspaces", {
  exports: {
    getCurrentWorkspaceSelection: async () => ({
      workspace: { id: "workspace-1" },
    }),
  },
});

mock.module("@/lib/supabase/admin", {
  exports: { createAdminClient: () => null },
});

mock.module("@/lib/playlists-ai-python-client", {
  exports: {
    rankPlaylistCandidates: async (input) => {
      rankInput = input;
      return rankResult;
    },
  },
});

const { recommendTracksForPlaylist } =
  await import("../src/lib/playlists-ai-tools.ts");

test.beforeEach(() => {
  rankInput = null;
  rankResult = {
    ok: true,
    value: {
      request_id: "request-1",
      model_version: "ltr-1",
      personalized: true,
      cold_start: false,
      items: [
        {
          track_id: "track-2",
          rank: 1,
          score: 97,
          base_score: 86,
          learned_score: 99,
          reason_codes: ["workspace_affinity"],
          propensity: 0.7,
        },
        {
          track_id: "track-1",
          rank: 2,
          score: 88,
          base_score: 93,
          learned_score: 85,
          reason_codes: ["chart_strength"],
          propensity: 0.6,
        },
      ],
    },
  };
});

test("playlist recommendations apply validated Python order over the preserved baseline", async () => {
  const result = await recommendTracksForPlaylist("FUNK 2026", { limit: 2 });

  assert.deepEqual(
    result.cards.map((card) => card.spotifyTrackId),
    ["track-2", "track-1"],
  );
  assert.deepEqual(
    result.cards.map((card) => card.opportunityScore),
    [97, 88],
  );
  assert.equal(result.ranking.provider, "python");
  assert.equal(result.ranking.requestId, "request-1");
  assert.equal(result.cards[0].ranking.modelVersion, "ltr-1");
  assert.equal(rankInput.workspace_id, "workspace-1");
  assert.equal(rankInput.playlist_id, "playlist-1");
  assert.equal(rankInput.candidates[0].playlist_fit, 100);
  assert.equal(rankInput.candidates[0].observed_days_30, 20);
  assert.equal(rankInput.candidates[0].is_new_entry, false);
  assert.match(rankInput.as_of, /^\d{4}-\d{2}-\d{2}T/);
});

test("playlist recommendations keep the deterministic order when Python times out", async () => {
  rankResult = { ok: false, reason: "timeout" };
  const result = await recommendTracksForPlaylist("FUNK 2026", { limit: 2 });

  assert.deepEqual(
    result.cards.map((card) => card.spotifyTrackId),
    ["track-1", "track-2"],
  );
  assert.equal(result.ranking.provider, "baseline");
  assert.equal(result.ranking.status, "timeout");
  assert.ok(result.cards.every((card) => card.ranking === null));
});
