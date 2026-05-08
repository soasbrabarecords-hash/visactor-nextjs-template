import "server-only";

import {
  detectGenre,
  detectPlaylistGenre,
  GENRE_LABEL,
  normalizeGenreText,
  type TrackGenre,
} from "@/lib/genre-detection";
import {
  fetchSpotifyEditablePlaylist,
  type SpotifyAccountPlaylist,
  type SpotifyEditablePlaylist,
} from "@/lib/spotify-user";

export type SpotifyAccountPlaylistTarget = {
  id: string;
  name: string;
  imageUrl: string | null;
  tracksTotal: number;
  genre: TrackGenre;
  trackIds: Set<string>;
  artistNames: Set<string>;
  genreCounts: Map<TrackGenre, number>;
};

export type SpotifyAccountProfile = {
  playlistsCount: number;
  uniqueTrackCount: number;
  repeatedTrackCount: number;
  dominantGenre: TrackGenre | null;
  dominantGenreLabel: string | null;
  dominantArtists: string[];
  trackPlaylistNamesById: Map<string, string[]>;
  artistPlaylistCountByName: Map<string, number>;
  genreTrackCountByType: Map<TrackGenre, number>;
  playlistTargets: SpotifyAccountPlaylistTarget[];
};

type SpotifyAccountProfileCacheEntry = {
  value: SpotifyAccountProfile | null;
  expiresAt: number;
};

const ACCOUNT_PROFILE_TTL_MS = 5 * 60 * 1000;
const accountProfileCache = new Map<
  string,
  SpotifyAccountProfileCacheEntry
>();
const accountProfileInFlight = new Map<
  string,
  Promise<SpotifyAccountProfile | null>
>();

const KNOWN_TRACK_GENRES = new Set<TrackGenre>([
  "funk",
  "trap",
  "rap",
  "sertanejo",
  "pagode",
  "pagodao",
  "piseiro",
  "pop",
  "rock",
  "reggae",
  "unknown",
]);

function getCachedProfile(cacheKey: string) {
  const entry = accountProfileCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    accountProfileCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

function setCachedProfile(
  cacheKey: string,
  value: SpotifyAccountProfile | null,
) {
  accountProfileCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ACCOUNT_PROFILE_TTL_MS,
  });

  return value;
}

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  iteratee: (item: TItem, index: number) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const workers = Array.from({
    length: Math.min(concurrency, items.length),
  }).map(async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);

  return results;
}

export function normalizeSpotifyArtistName(value: string) {
  return normalizeGenreText(value).replace(/\s+/g, " ").trim();
}

export function extractSpotifyArtistNames(value: string) {
  return value
    .split(/,| feat\. | feat | ft\. | ft | part\./i)
    .map((artist) => normalizeSpotifyArtistName(artist))
    .filter(Boolean);
}

export function resolveSpotifyTrackGenre(
  genreLabel: string | null | undefined,
  artists: string,
  trackName: string,
): TrackGenre {
  const normalizedGenre = normalizeGenreText(genreLabel ?? "");

  if (KNOWN_TRACK_GENRES.has(normalizedGenre as TrackGenre)) {
    return normalizedGenre as TrackGenre;
  }

  if (normalizedGenre === "forro") {
    return "piseiro";
  }

  if (normalizedGenre === "samba") {
    return "pagode";
  }

  return detectGenre(artists, trackName);
}

export function pickTopSpotifyGenre(genreCounts: Map<TrackGenre, number>) {
  return [...genreCounts.entries()]
    .filter(([genre]) => genre !== "unknown")
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

export function getSpotifyGenreDisplayLabel(genre: TrackGenre | null) {
  if (!genre || genre === "unknown") {
    return null;
  }

  return GENRE_LABEL[genre];
}

function mapEditablePlaylistsToProfile(playlists: SpotifyEditablePlaylist[]) {
  if (playlists.length === 0) {
    return null;
  }

  const trackPlaylistNamesById = new Map<string, string[]>();
  const artistPlaylistCountByName = new Map<string, number>();
  const genreTrackCountByType = new Map<TrackGenre, number>();
  const playlistTargets: SpotifyAccountPlaylistTarget[] = [];

  for (const playlist of playlists) {
    const playlistTrackIds = new Set<string>();
    const playlistArtistNames = new Set<string>();
    const playlistGenreCounts = new Map<TrackGenre, number>();

    for (const track of playlist.tracks) {
      if (!track.id || playlistTrackIds.has(track.id)) {
        continue;
      }

      playlistTrackIds.add(track.id);
      const trackPlaylists = trackPlaylistNamesById.get(track.id) ?? [];

      if (!trackPlaylists.includes(playlist.name)) {
        trackPlaylists.push(playlist.name);
      }

      trackPlaylistNamesById.set(track.id, trackPlaylists);

      const detectedGenre = resolveSpotifyTrackGenre(
        null,
        track.artists,
        track.name,
      );

      if (detectedGenre !== "unknown") {
        genreTrackCountByType.set(
          detectedGenre,
          (genreTrackCountByType.get(detectedGenre) ?? 0) + 1,
        );
        playlistGenreCounts.set(
          detectedGenre,
          (playlistGenreCounts.get(detectedGenre) ?? 0) + 1,
        );
      }

      for (const artistName of extractSpotifyArtistNames(track.artists)) {
        playlistArtistNames.add(artistName);
      }
    }

    for (const artistName of playlistArtistNames) {
      artistPlaylistCountByName.set(
        artistName,
        (artistPlaylistCountByName.get(artistName) ?? 0) + 1,
      );
    }

    const detectedPlaylistGenre = detectPlaylistGenre(
      playlist.name,
      playlist.description,
    );

    const playlistGenre =
      detectedPlaylistGenre !== "unknown"
        ? detectedPlaylistGenre
        : pickTopSpotifyGenre(playlistGenreCounts) ?? "unknown";

    playlistTargets.push({
      id: playlist.id,
      name: playlist.name,
      imageUrl: playlist.imageUrl,
      tracksTotal: playlist.tracksTotal,
      genre: playlistGenre,
      trackIds: playlistTrackIds,
      artistNames: playlistArtistNames,
      genreCounts: playlistGenreCounts,
    });
  }

  if (playlistTargets.length === 0) {
    return null;
  }

  const dominantGenre = pickTopSpotifyGenre(genreTrackCountByType);

  return {
    playlistsCount: playlistTargets.length,
    uniqueTrackCount: trackPlaylistNamesById.size,
    repeatedTrackCount: [...trackPlaylistNamesById.values()].filter(
      (playlistNames) => playlistNames.length >= 2,
    ).length,
    dominantGenre,
    dominantGenreLabel: getSpotifyGenreDisplayLabel(dominantGenre),
    dominantArtists: [...artistPlaylistCountByName.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([artistName]) => artistName),
    trackPlaylistNamesById,
    artistPlaylistCountByName,
    genreTrackCountByType,
    playlistTargets,
  } satisfies SpotifyAccountProfile;
}

export async function buildSpotifyAccountProfile(
  playlists: SpotifyAccountPlaylist[],
): Promise<SpotifyAccountProfile | null> {
  if (playlists.length === 0) {
    return null;
  }

  const cacheKey = [
    playlists[0]?.ownerId ?? "spotify-account",
    ...playlists.map((playlist) => `${playlist.id}:${playlist.tracksTotal}`),
  ].join("|");
  const cachedProfile = getCachedProfile(cacheKey);

  if (cachedProfile) {
    return cachedProfile;
  }

  const inFlight = accountProfileInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const editablePlaylists = await mapWithConcurrency(
      playlists,
      2,
      async (playlist) => {
        const { result } = await fetchSpotifyEditablePlaylist(playlist.id);

        if (!result.connected || !result.playlist) {
          return null;
        }

        return result.playlist;
      },
    );

    return setCachedProfile(
      cacheKey,
      mapEditablePlaylistsToProfile(
        editablePlaylists.filter(
          (playlist): playlist is SpotifyEditablePlaylist => Boolean(playlist),
        ),
      ),
    );
  })();

  accountProfileInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    accountProfileInFlight.delete(cacheKey);
  }
}
