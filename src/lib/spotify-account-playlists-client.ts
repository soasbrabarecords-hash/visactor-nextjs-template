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

let inFlight: Promise<SpotifyPlaylistsClientResponse> | null = null;
let rateLimitedState: { message: string; until: number } | null = null;

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
}: {
  force?: boolean;
} = {}): Promise<SpotifyPlaylistsClientResponse> {
  if (!force && rateLimitedState && rateLimitedState.until > Date.now()) {
    throw new Error(rateLimitedState.message);
  }

  if (!force && inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const response = await fetch("/api/spotify/me/playlists", {
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      const message = payload.message?.trim() || "Nao foi possivel carregar playlists do Spotify.";
      const retryAfterSeconds = parseRetryAfterSeconds(message);

      if (retryAfterSeconds) {
        rateLimitedState = {
          message,
          until: Date.now() + retryAfterSeconds * 1000,
        };
      }

      throw new Error(message);
    }

    const payload = (await response.json()) as SpotifyPlaylistsClientResponse;

    if (!payload.connected) {
      const message = payload.message?.trim() || "Nao foi possivel carregar playlists do Spotify.";
      const retryAfterSeconds = parseRetryAfterSeconds(message);

      if (retryAfterSeconds) {
        rateLimitedState = {
          message,
          until: Date.now() + retryAfterSeconds * 1000,
        };
      } else {
        rateLimitedState = null;
      }
    } else {
      rateLimitedState = null;
    }

    return payload;
  })();

  inFlight = request;

  try {
    return await request;
  } finally {
    inFlight = null;
  }
}

export function invalidateSpotifyAccountPlaylistsClientCache() {
  inFlight = null;
}
