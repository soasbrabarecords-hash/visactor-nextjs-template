import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { exports: {} });
mock.module("@/lib/music-intelligence", {
  exports: { getMusicIntelligence: async () => null },
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

function ranking(overrides) {
  return {
    spotify_track_id: "track",
    track_name: "Faixa",
    artist_name: "Artista",
    primary_genre: null,
    genre_confidence: null,
    countries: ["BR"],
    chart_days: 120,
    chart_appearances: 120,
    total_streams: 30_000_000,
    average_daily_streams: 250_000,
    best_position: 30,
    average_position: 80,
    first_chart_date: "2026-01-14",
    last_chart_date: "2026-07-12",
    current_position_br: 50,
    current_position_global: null,
    position_7d_br: 70,
    position_7d_global: null,
    image_url: null,
    latest_chart_date: "2026-07-12",
    window_start_date: "2026-01-14",
    available_days: 180,
    ...overrides,
  };
}

const veigh = ranking({
  spotify_track_id: "veigh",
  track_name: "Talvez você precise de mim",
  artist_name: "Veigh, Supernova Ent",
  primary_genre: "trap",
  genre_confidence: 38,
  total_streams: 51_000_000,
});
const falseRap = ranking({
  spotify_track_id: "rappa",
  track_name: "Anjos (Pra quem tem fé)",
  artist_name: "O Rappa",
  primary_genre: "rap",
  genre_confidence: 38,
  total_streams: 28_000_000,
});
const nanda = ranking({
  spotify_track_id: "nanda",
  track_name: "P.I.T.T.Y.",
  artist_name: "NandaTsunami, Stick",
  total_streams: 53_000_000,
});
const beatriz = ranking({
  spotify_track_id: "beatriz",
  track_name: "Beatriz",
  artist_name: "2ZDinizz, Leborato, HHR",
  total_streams: 50_000_000,
});

mock.module("@/lib/supabase/admin", {
  exports: {
    createAdminClient: () => ({
      rpc: async (_name, params) => ({
        data:
          params.p_primary_genre === "trap"
            ? [veigh]
            : params.p_primary_genre === "rap"
              ? [falseRap]
              : [nanda, veigh, beatriz],
        error: null,
      }),
    }),
  },
});

const { getChartOpportunities } =
  await import("../src/lib/playlists-ai-tools.ts");

test("historical trap + rap recovers unprofiled tracks and rejects textual false positives", async () => {
  const result = await getChartOpportunities({
    market: "BR",
    mode: "historical",
    windowDays: 180,
    genres: ["trap", "rap"],
    limit: 10,
  });

  assert.deepEqual(
    result.cards.map((card) => card.spotifyTrackId),
    ["veigh", "nanda", "beatriz"],
  );
  assert.equal(
    result.cards.some((card) => card.spotifyTrackId === "rappa"),
    false,
  );
  assert.deepEqual(
    result.cards.map((card) => card.genreProfile?.primaryGenre),
    ["trap", "rap", "rap"],
  );
});
