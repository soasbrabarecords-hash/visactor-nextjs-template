export type SpotifyPopularityCacheTrack = {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  imageUrl: string | null;
  spotifyUrl: string;
  popularity: number;
  popularitySource: "spotify" | "snapshot" | "unavailable";
};

export type SpotifyPopularitySnapshotRow = {
  market: "spotify";
  genre: "catalog";
  track_id: string;
  snapshot_date: string;
  captured_at: string;
  track_name: string;
  artists: string;
  album_name: string;
  cover_url: string | null;
  spotify_url: string;
  popularity: number;
  signal_count: 1;
  source_mode: "spotify_playlist";
  explicit: false;
};

function normalizePopularity(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.min(100, Math.round(value));
}

export function buildSpotifyPopularitySnapshotRows(
  tracks: SpotifyPopularityCacheTrack[],
  capturedAt = new Date(),
): SpotifyPopularitySnapshotRow[] {
  const capturedAtIso = capturedAt.toISOString();
  const snapshotDate = capturedAtIso.slice(0, 10);
  const rowsByTrackId = new Map<string, SpotifyPopularitySnapshotRow>();

  for (const track of tracks) {
    const trackId = track.id.trim();
    const popularity = normalizePopularity(track.popularity);

    if (
      !trackId ||
      popularity === null ||
      track.popularitySource !== "spotify"
    ) {
      continue;
    }

    rowsByTrackId.set(trackId, {
      market: "spotify",
      genre: "catalog",
      track_id: trackId,
      snapshot_date: snapshotDate,
      captured_at: capturedAtIso,
      track_name: track.name.trim() || "Faixa Spotify",
      artists: track.artists.trim() || "Artista não informado",
      album_name: track.albumName.trim() || "Álbum não informado",
      cover_url: track.imageUrl?.trim() || null,
      spotify_url:
        track.spotifyUrl.trim() || `https://open.spotify.com/track/${trackId}`,
      popularity,
      signal_count: 1,
      source_mode: "spotify_playlist",
      explicit: false,
    });
  }

  return Array.from(rowsByTrackId.values());
}
