export type SpotifyAccountPlaylistClient = {
  id: string;
  name: string;
  ownerId?: string;
  ownerName?: string;
  imageUrl: string | null;
  tracksTotal: number;
  spotifyUrl?: string;
  isPublic?: boolean;
  isCollaborative?: boolean;
};

export type SpotifyPlaylistsClientResponse =
  | {
      connected: true;
      playlists: SpotifyAccountPlaylistClient[];
    }
  | {
      connected: false;
      playlists: [];
      message: string;
    };

type ClientCacheEntry = {
  value: SpotifyPlaylistsClientResponse;
  expiresAt: number;
};

const DEFAULT_CACHE_SCOPE = "current-workspace";
const CONNECTED_CACHE_TTL_MS = 90 * 1000;
const DISCONNECTED_CACHE_TTL_MS = 10 * 1000;
const MAX_CACHE_SCOPES = 20;

const responseCache = new Map<string, ClientCacheEntry>();
const inFlightByScope = new Map<
  string,
  Promise<SpotifyPlaylistsClientResponse>
>();
const rateLimitedStateByScope = new Map<
  string,
  { message: string; until: number }
>();
const cacheGenerationByScope = new Map<string, number>();

function normalizeCacheScope(cacheKey?: string) {
  return cacheKey?.trim() || DEFAULT_CACHE_SCOPE;
}

function getCacheGeneration(cacheScope: string) {
  return cacheGenerationByScope.get(cacheScope) ?? 0;
}

function bumpCacheGeneration(cacheScope: string) {
  cacheGenerationByScope.set(cacheScope, getCacheGeneration(cacheScope) + 1);
}

function getCachedResponse(cacheScope: string) {
  const cached = responseCache.get(cacheScope);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheScope);
    return null;
  }

  return cached.value;
}

function setCachedResponse(
  cacheScope: string,
  value: SpotifyPlaylistsClientResponse,
) {
  responseCache.set(cacheScope, {
    value,
    expiresAt:
      Date.now() +
      (value.connected ? CONNECTED_CACHE_TTL_MS : DISCONNECTED_CACHE_TTL_MS),
  });

  while (responseCache.size > MAX_CACHE_SCOPES) {
    const oldestScope = responseCache.keys().next().value as string | undefined;
    if (!oldestScope) break;
    responseCache.delete(oldestScope);
  }

  return value;
}

function parseRetryAfterSeconds(message: string) {
  const match = message.match(/(\d+)\s+segundos/i);

  if (!match) {
    return null;
  }

  const seconds = Number.parseInt(match[1] ?? "", 10);

  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export async function getSpotifyAccountPlaylistsClient({
  force = false,
  cacheKey,
}: {
  force?: boolean;
  cacheKey?: string;
} = {}): Promise<SpotifyPlaylistsClientResponse> {
  const cacheScope = normalizeCacheScope(cacheKey);

  if (force) {
    bumpCacheGeneration(cacheScope);
    responseCache.delete(cacheScope);
    inFlightByScope.delete(cacheScope);
  }

  const rateLimitedState = rateLimitedStateByScope.get(cacheScope);

  if (!force && rateLimitedState && rateLimitedState.until > Date.now()) {
    throw new Error(rateLimitedState.message);
  }

  if (!force) {
    const cached = getCachedResponse(cacheScope);
    if (cached) {
      return cached;
    }

    const inFlight = inFlightByScope.get(cacheScope);
    if (inFlight) {
      return inFlight;
    }
  }

  const requestGeneration = getCacheGeneration(cacheScope);
  const request = (async () => {
    const response = await fetch(
      `/api/spotify/me/playlists${force ? "?force=1" : ""}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      const message = payload.message?.trim() || "Nao foi possivel carregar playlists do Spotify.";
      const retryAfterSeconds = parseRetryAfterSeconds(message);

      if (retryAfterSeconds) {
        rateLimitedStateByScope.set(cacheScope, {
          message,
          until: Date.now() + retryAfterSeconds * 1000,
        });
      }

      throw new Error(message);
    }

    const payload = (await response.json()) as SpotifyPlaylistsClientResponse;

    if (!payload.connected) {
      const message = payload.message?.trim() || "Nao foi possivel carregar playlists do Spotify.";
      const retryAfterSeconds = parseRetryAfterSeconds(message);

      if (retryAfterSeconds) {
        rateLimitedStateByScope.set(cacheScope, {
          message,
          until: Date.now() + retryAfterSeconds * 1000,
        });
      } else {
        rateLimitedStateByScope.delete(cacheScope);
      }
    } else {
      rateLimitedStateByScope.delete(cacheScope);
    }

    return getCacheGeneration(cacheScope) === requestGeneration
      ? setCachedResponse(cacheScope, payload)
      : payload;
  })();

  inFlightByScope.set(cacheScope, request);

  try {
    return await request;
  } finally {
    if (inFlightByScope.get(cacheScope) === request) {
      inFlightByScope.delete(cacheScope);
    }
  }
}

export function getCachedSpotifyAccountPlaylistsClient(cacheKey?: string) {
  return getCachedResponse(normalizeCacheScope(cacheKey));
}

export function invalidateSpotifyAccountPlaylistsClientCache(cacheKey?: string) {
  if (cacheKey) {
    const cacheScope = normalizeCacheScope(cacheKey);
    bumpCacheGeneration(cacheScope);
    responseCache.delete(cacheScope);
    inFlightByScope.delete(cacheScope);
    rateLimitedStateByScope.delete(cacheScope);
    return;
  }

  const cacheScopes = new Set([
    ...responseCache.keys(),
    ...inFlightByScope.keys(),
    ...rateLimitedStateByScope.keys(),
  ]);
  cacheScopes.forEach(bumpCacheGeneration);
  responseCache.clear();
  inFlightByScope.clear();
  rateLimitedStateByScope.clear();
}
