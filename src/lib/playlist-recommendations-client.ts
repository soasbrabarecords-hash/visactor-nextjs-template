import type { PlaylistSuggestionResponse } from "@/lib/playlist-suggestion-intelligence";

type CachedRecommendations = {
  value: PlaylistSuggestionResponse;
  expiresAt: number;
};

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, CachedRecommendations>();
const inFlight = new Map<string, Promise<PlaylistSuggestionResponse>>();

export async function getPlaylistRecommendationsClient(
  playlistId: string,
  { force = false }: { force?: boolean } = {},
) {
  if (force) {
    cache.delete(playlistId);
    inFlight.delete(playlistId);
  }

  const cached = cache.get(playlistId);
  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = inFlight.get(playlistId);
  if (!force && pending) return pending;

  const request = (async () => {
    const response = await fetch(
      `/api/spotify/playlists/${playlistId}/recommendations`,
      { cache: "no-store" },
    );
    const data = (await response.json()) as PlaylistSuggestionResponse & {
      message?: string;
    };

    if (!response.ok) {
      throw new Error(
        data.message ?? "Não foi possível atualizar a inteligência.",
      );
    }

    cache.set(playlistId, {
      value: data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return data;
  })();

  inFlight.set(playlistId, request);

  try {
    return await request;
  } finally {
    if (inFlight.get(playlistId) === request) inFlight.delete(playlistId);
  }
}
