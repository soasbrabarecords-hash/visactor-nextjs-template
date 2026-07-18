import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("@/lib/supabase/admin", {
  exports: { createAdminClient: () => null },
});

mock.module("@/lib/track-profile-engine", {
  exports: {
    enrichTrackProfile: async () => {
      throw new Error("Use the injected enrichment function in tests.");
    },
  },
});

const {
  processSpotifyChartGenreCandidates,
  shouldEnrichSpotifyChartGenreProfile,
} = await import("../src/lib/charts/spotify-chart-genre-enrichment.ts");

function storedProfile({
  source = "musicbrainz",
  lastEnrichedAt = "2026-07-18T10:00:00.000Z",
} = {}) {
  return {
    spotify_track_id: "track-1",
    genre_sources: [
      {
        id: source,
        label: source,
        status: "used",
      },
    ],
    last_enriched_at: lastEnrichedAt,
  };
}

function enrichedProfile(candidate, primaryGenre) {
  return {
    spotifyTrackId: candidate.spotifyTrackId,
    spotifyArtistIds: [],
    trackName: candidate.name,
    artistName: candidate.artists,
    albumName: null,
    isrc: null,
    primaryGenre,
    secondaryGenres: [],
    subgenres: primaryGenre === "funk" ? ["baile funk"] : [],
    moodTags: [],
    energyTags: [],
    languageSignal: "desconhecido",
    countrySignal: candidate.chartCountry,
    genreConfidence: primaryGenre === "desconhecido" ? 15 : 88,
    confidenceLabel: primaryGenre === "desconhecido" ? "baixa" : "alta",
    genreSources: [],
    genreEvidence: [],
    lastEnrichedAt: "2026-07-18T12:00:00.000Z",
    manualOverride: false,
    manualOverrideEntityType: null,
  };
}

test("enriches profiles that only contain the old internal fallback", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");
  assert.equal(
    shouldEnrichSpotifyChartGenreProfile(
      storedProfile({ source: "internal_taxonomy" }),
      now,
    ),
    true,
  );
  assert.equal(
    shouldEnrichSpotifyChartGenreProfile(storedProfile(), now),
    false,
  );
  assert.equal(
    shouldEnrichSpotifyChartGenreProfile(
      storedProfile({ lastEnrichedAt: "2026-05-01T10:00:00.000Z" }),
      now,
    ),
    true,
  );
});

test("processes a bounded chart batch and reports classified and unknown tracks", async () => {
  const candidates = [
    {
      spotifyTrackId: "track-1",
      name: "Faixa 1",
      artists: "Artista 1",
      chartCountry: "BR",
      position: 1,
    },
    {
      spotifyTrackId: "track-2",
      name: "Faixa 2",
      artists: "Artista 2",
      chartCountry: "GLOBAL",
      position: 1,
    },
    {
      spotifyTrackId: "track-3",
      name: "Faixa 3",
      artists: "Artista 3",
      chartCountry: "BR",
      position: 2,
    },
  ];
  const result = await processSpotifyChartGenreCandidates(candidates, {
    limit: 2,
    concurrency: 2,
    enrich: async (candidate) =>
      enrichedProfile(
        candidate,
        candidate.spotifyTrackId === "track-1" ? "funk" : "desconhecido",
      ),
  });

  assert.equal(result.selected, 2);
  assert.equal(result.processed, 2);
  assert.equal(result.classified, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.results[0].subgenres[0], "baile funk");
});

test("isolates provider failures without aborting the remaining batch", async () => {
  const candidates = [
    {
      spotifyTrackId: "track-error",
      name: "Falha",
      artists: "Artista",
      chartCountry: "BR",
      position: 1,
    },
    {
      spotifyTrackId: "track-ok",
      name: "Sucesso",
      artists: "Artista",
      chartCountry: "BR",
      position: 2,
    },
  ];
  const result = await processSpotifyChartGenreCandidates(candidates, {
    concurrency: 1,
    enrich: async (candidate) => {
      if (candidate.spotifyTrackId === "track-error") {
        throw new Error("provider unavailable");
      }
      return enrichedProfile(candidate, "sertanejo");
    },
  });

  assert.equal(result.processed, 2);
  assert.equal(result.classified, 1);
  assert.equal(result.failed, 1);
});
