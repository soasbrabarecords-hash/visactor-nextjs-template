import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSpotifyPopularityCacheRows,
  shouldRefreshSpotifyPopularity,
} from "../src/lib/spotify-popularity-cache.ts";

function track(overrides = {}) {
  return {
    id: "track-1",
    name: "Faixa real",
    artists: "Artista",
    albumName: "Álbum",
    imageUrl: null,
    spotifyUrl: "https://open.spotify.com/track/track-1",
    popularity: 78,
    popularitySource: "spotify",
    ...overrides,
  };
}

test("stores only official Spotify popularity values", () => {
  const rows = buildSpotifyPopularityCacheRows(
    [
      track(),
      track({
        id: "estimated",
        popularity: 100,
        popularitySource: "unavailable",
      }),
      track({ id: "historical", popularity: 75, popularitySource: "snapshot" }),
      track({ id: "missing", popularity: 0 }),
    ],
    new Date("2026-07-15T12:00:00.000Z"),
  );

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    track_id: "track-1",
    captured_at: "2026-07-15T12:00:00.000Z",
    track_name: "Faixa real",
    artist_name: "Artista",
    album_name: "Álbum",
    image_url: null,
    spotify_url: "https://open.spotify.com/track/track-1",
    popularity: 78,
    source: "spotify",
  });
});

test("deduplicates tracks and clamps official popularity", () => {
  const rows = buildSpotifyPopularityCacheRows([
    track({ popularity: 84.4 }),
    track({ popularity: 140, name: "Versão mais recente" }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].track_name, "Versão mais recente");
  assert.equal(rows[0].popularity, 100);
});

test("refreshes unavailable and snapshot values while trusting live Spotify values", () => {
  assert.equal(shouldRefreshSpotifyPopularity(track()), false);
  assert.equal(
    shouldRefreshSpotifyPopularity(
      track({ popularity: 84, popularitySource: "snapshot" }),
    ),
    true,
  );
  assert.equal(
    shouldRefreshSpotifyPopularity(
      track({ popularity: 0, popularitySource: "unavailable" }),
    ),
    true,
  );
});
