import "server-only";

import { Buffer } from "node:buffer";

type SpotifyTokenResponse = {
  access_token: string;
  expires_in: number;
};

type SpotifyPlaylistResponse = {
  name?: string;
  images?: Array<{
    url?: string;
  }>;
  followers?: {
    total?: number;
  };
  tracks?: {
    total?: number;
  };
  external_urls?: {
    spotify?: string;
  };
};

type SpotifyPlaylistTracksResponse = {
  items?: Array<{
    track?: {
      id?: string;
      name?: string;
      popularity?: number;
      explicit?: boolean;
      duration_ms?: number;
      external_urls?: {
        spotify?: string;
      };
      artists?: Array<{
        name?: string;
      }>;
      album?: {
        name?: string;
      };
    };
  }>;
  next?: string | null;
};

export type SpotifyPlaylistMetadata = {
  playlistId: string;
  name: string;
  coverUrl: string | null;
  followers: number;
  tracks: number;
  url: string;
};

export type SpotifyTrackRecord = {
  id: string;
  name: string;
  artists: string[];
  popularity: number;
  explicit: boolean;
  durationMs: number;
  albumName: string;
  spotifyUrl: string;
};

let spotifyToken:
  | {
      value: string;
      expiresAt: number;
    }
  | undefined;

function getSpotifyEnv() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
  };
}

function parseNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function calculatePlaylistScore({
  followers,
  tracks,
}: {
  followers: number;
  tracks: number;
}) {
  const followersScore = Math.min(Math.log10(followers + 1) / 6, 1) * 70;
  const trackBalance = Math.max(0, 1 - Math.abs(tracks - 80) / 120) * 30;

  return Math.round(followersScore + trackBalance);
}

export function extractSpotifyPlaylistId(input: string): string | null {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return null;
  }

  const directIdMatch = trimmedInput.match(/^[A-Za-z0-9]{22}$/);
  if (directIdMatch) {
    return directIdMatch[0];
  }

  const urlMatch = trimmedInput.match(/playlist\/([A-Za-z0-9]{22})/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  return null;
}

async function getSpotifyAccessToken() {
  const env = getSpotifyEnv();

  if (!env) {
    throw new Error("Spotify environment variables are not configured.");
  }

  if (spotifyToken && spotifyToken.expiresAt > Date.now() + 30_000) {
    return spotifyToken.value;
  }

  const credentials = Buffer.from(
    `${env.clientId}:${env.clientSecret}`,
    "utf-8",
  ).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to authenticate with the Spotify API.");
  }

  const tokenPayload = (await response.json()) as SpotifyTokenResponse;

  spotifyToken = {
    value: tokenPayload.access_token,
    expiresAt: Date.now() + tokenPayload.expires_in * 1000,
  };

  return spotifyToken.value;
}

async function spotifyFetch<T>(url: string) {
  const token = await getSpotifyAccessToken();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Spotify API request failed.");
  }

  return (await response.json()) as T;
}

export async function fetchSpotifyPlaylistMetadata(
  playlistId: string,
): Promise<SpotifyPlaylistMetadata> {
  const playlist = await spotifyFetch<SpotifyPlaylistResponse>(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,images(url),followers(total),tracks(total),external_urls(spotify)`,
  );

  return {
    playlistId,
    name: playlist.name?.trim() || "Spotify Playlist",
    coverUrl: playlist.images?.[0]?.url?.trim() || null,
    followers: parseNumber(playlist.followers?.total),
    tracks: parseNumber(playlist.tracks?.total),
    url:
      playlist.external_urls?.spotify ||
      `https://open.spotify.com/playlist/${playlistId}`,
  };
}

export async function fetchSpotifyPlaylistTracks(
  playlistId: string,
): Promise<SpotifyTrackRecord[]> {
  const tracks: SpotifyTrackRecord[] = [];
  let nextUrl:
    | string
    | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,popularity,explicit,duration_ms,external_urls(spotify),artists(name),album(name))),next`;

  while (nextUrl) {
    const payload: SpotifyPlaylistTracksResponse =
      await spotifyFetch<SpotifyPlaylistTracksResponse>(nextUrl);

    for (const item of payload.items ?? []) {
      const track = item.track;

      if (!track?.id || !track.name) {
        continue;
      }

      tracks.push({
        id: track.id,
        name: track.name,
        artists: (track.artists ?? [])
          .map((artist) => artist.name?.trim() || "")
          .filter(Boolean),
        popularity: parseNumber(track.popularity),
        explicit: Boolean(track.explicit),
        durationMs: parseNumber(track.duration_ms),
        albumName: track.album?.name?.trim() || "Unknown album",
        spotifyUrl:
          track.external_urls?.spotify ||
          `https://open.spotify.com/track/${track.id}`,
      });
    }

    nextUrl = payload.next ?? null;
  }

  return tracks;
}
