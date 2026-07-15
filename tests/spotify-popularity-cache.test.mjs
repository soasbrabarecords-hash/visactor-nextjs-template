import assert from "node:assert/strict";
import test from "node:test";
import { buildSpotifyPopularitySnapshotRows } from "../src/lib/spotify-popularity-cache.ts";

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
  const rows = buildSpotifyPopularitySnapshotRows(
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
    market: "spotify",
    genre: "catalog",
    track_id: "track-1",
    snapshot_date: "2026-07-15",
    captured_at: "2026-07-15T12:00:00.000Z",
    track_name: "Faixa real",
    artists: "Artista",
    album_name: "Álbum",
    cover_url: null,
    spotify_url: "https://open.spotify.com/track/track-1",
    popularity: 78,
    signal_count: 1,
    source_mode: "spotify_playlist",
    explicit: false,
  });
});

test("deduplicates tracks and clamps official popularity", () => {
  const rows = buildSpotifyPopularitySnapshotRows([
    track({ popularity: 84.4 }),
    track({ popularity: 140, name: "Versão mais recente" }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].track_name, "Versão mais recente");
  assert.equal(rows[0].popularity, 100);
});
