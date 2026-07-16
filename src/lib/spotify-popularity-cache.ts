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

export type SpotifyPopularityCacheRow = {
  track_id: string;
  captured_at: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  image_url: string | null;
  spotify_url: string;
  popularity: number;
  source: "spotify";
};

function normalizePopularity(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.min(100, Math.round(value));
}

export function shouldRefreshSpotifyPopularity(
  track: Pick<SpotifyPopularityCacheTrack, "popularity" | "popularitySource">,
) {
  return track.popularity <= 0 || track.popularitySource !== "spotify";
}

export function buildSpotifyPopularityCacheRows(
  tracks: SpotifyPopularityCacheTrack[],
  capturedAt = new Date(),
): SpotifyPopularityCacheRow[] {
  const capturedAtIso = capturedAt.toISOString();
  const rowsByTrackId = new Map<string, SpotifyPopularityCacheRow>();

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
      track_id: trackId,
      captured_at: capturedAtIso,
      track_name: track.name.trim() || "Faixa Spotify",
      artist_name: track.artists.trim() || "Artista não informado",
      album_name: track.albumName.trim() || "Álbum não informado",
      image_url: track.imageUrl?.trim() || null,
      spotify_url:
        track.spotifyUrl.trim() || `https://open.spotify.com/track/${trackId}`,
      popularity,
      source: "spotify",
    });
  }

  return Array.from(rowsByTrackId.values());
}
