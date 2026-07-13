export type SpotifyArtistGenresResponse = Record<string, string[]>;

type ArtistGenreCacheEntry = {
  genres: string[];
  expiresAt: number;
};

const GENRES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EMPTY_GENRES_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_ARTIST_CACHE_SIZE = 2_000;
const BATCH_SIZE = 50;

const artistGenresCache = new Map<string, ArtistGenreCacheEntry>();
const inFlightByBatch = new Map<string, Promise<SpotifyArtistGenresResponse>>();

function getCachedGenres(artistId: string) {
  const cached = artistGenresCache.get(artistId);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    artistGenresCache.delete(artistId);
    return null;
  }

  return cached.genres;
}

function cacheGenres(artistId: string, genres: string[]) {
  artistGenresCache.set(artistId, {
    genres,
    expiresAt:
      Date.now() +
      (genres.length > 0 ? GENRES_CACHE_TTL_MS : EMPTY_GENRES_CACHE_TTL_MS),
  });

  while (artistGenresCache.size > MAX_ARTIST_CACHE_SIZE) {
    const oldestId = artistGenresCache.keys().next().value as
      string | undefined;
    if (!oldestId) break;
    artistGenresCache.delete(oldestId);
  }
}

async function fetchArtistGenresBatch(ids: string[]) {
  const batchKey = [...ids].sort().join(",");
  const currentRequest = inFlightByBatch.get(batchKey);

  if (currentRequest) {
    return currentRequest;
  }

  const request = (async () => {
    const response = await fetch(
      `/api/spotify/artists/genres?ids=${encodeURIComponent(ids.join(","))}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error("Nao foi possivel carregar os generos dos artistas.");
    }

    return (await response.json()) as SpotifyArtistGenresResponse;
  })();

  inFlightByBatch.set(batchKey, request);

  try {
    return await request;
  } finally {
    if (inFlightByBatch.get(batchKey) === request) {
      inFlightByBatch.delete(batchKey);
    }
  }
}

export async function getSpotifyArtistGenresClient(artistIds: string[]) {
  const uniqueIds = Array.from(
    new Set(artistIds.map((artistId) => artistId.trim()).filter(Boolean)),
  );
  const result: SpotifyArtistGenresResponse = {};
  const missingIds: string[] = [];

  for (const artistId of uniqueIds) {
    const cachedGenres = getCachedGenres(artistId);
    if (cachedGenres) {
      result[artistId] = cachedGenres;
    } else {
      missingIds.push(artistId);
    }
  }

  for (let index = 0; index < missingIds.length; index += BATCH_SIZE) {
    const batch = missingIds.slice(index, index + BATCH_SIZE);
    const fetched = await fetchArtistGenresBatch(batch);

    for (const artistId of batch) {
      if (!Object.prototype.hasOwnProperty.call(fetched, artistId)) {
        continue;
      }

      const genres = fetched[artistId] ?? [];
      cacheGenres(artistId, genres);
      result[artistId] = genres;
    }
  }

  return result;
}
