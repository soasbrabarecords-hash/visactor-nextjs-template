import "server-only";

import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const SPOTIFY_ACCESS_TOKEN_COOKIE = "spotify_access_token";
const SPOTIFY_REFRESH_TOKEN_COOKIE = "spotify_refresh_token";
const SPOTIFY_STATE_COOKIE = "spotify_auth_state";

type SpotifyOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

type SpotifyUserPlaylistsResponse = {
  items?: SpotifyUserPlaylistObject[];
  next?: string | null;
};

type SpotifyUserPlaylistObject = {
  id?: string;
  name?: string;
  public?: boolean | null;
  collaborative?: boolean;
  external_urls?: {
    spotify?: string;
  };
  images?: Array<{
    url?: string;
  }>;
  owner?: {
    display_name?: string;
  };
  tracks?: {
    total?: number;
  };
};

export type SpotifyAccountPlaylist = {
  id: string;
  name: string;
  ownerName: string;
  imageUrl: string | null;
  tracksTotal: number;
  spotifyUrl: string;
  isPublic: boolean;
  isCollaborative: boolean;
};

export type SpotifyAccountPlaylistsResult =
  | {
      connected: true;
      playlists: SpotifyAccountPlaylist[];
    }
  | {
      connected: false;
      playlists: [];
      message: string;
    };

function getSpotifyOAuthEnv() {
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

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function getSpotifyCredentialsHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf-8").toString("base64")}`;
}

export function getSpotifyRedirectUri(origin: string) {
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI?.trim() ||
    `${origin}/api/spotify/auth/callback`;

  return redirectUri.replace(/\/+$/, "");
}

export function buildSpotifyAuthorizeUrl({
  origin,
  state,
}: {
  origin: string;
  state: string;
}) {
  const env = getSpotifyOAuthEnv();

  if (!env) {
    throw new Error("Spotify environment variables are not configured.");
  }

  const params = new URLSearchParams({
    client_id: env.clientId,
    response_type: "code",
    redirect_uri: getSpotifyRedirectUri(origin),
    scope:
      "playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public ugc-image-upload user-read-email",
    state,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export function setSpotifyStateCookie(response: NextResponse, state: string) {
  response.cookies.set(
    SPOTIFY_STATE_COOKIE,
    state,
    getCookieOptions(10 * 60),
  );
}

export async function getSpotifyStateCookie() {
  const cookieStore = await cookies();

  return cookieStore.get(SPOTIFY_STATE_COOKIE)?.value ?? null;
}

export function clearSpotifyStateCookie(response: NextResponse) {
  response.cookies.set(SPOTIFY_STATE_COOKIE, "", getCookieOptions(0));
}

export function setSpotifyAuthCookies(
  response: NextResponse,
  token: SpotifyOAuthTokenResponse,
) {
  response.cookies.set(
    SPOTIFY_ACCESS_TOKEN_COOKIE,
    token.access_token,
    getCookieOptions(Math.max(60, token.expires_in - 60)),
  );

  if (token.refresh_token) {
    response.cookies.set(
      SPOTIFY_REFRESH_TOKEN_COOKIE,
      token.refresh_token,
      getCookieOptions(60 * 60 * 24 * 30),
    );
  }
}

export function clearSpotifyAuthCookies(response: NextResponse) {
  response.cookies.set(SPOTIFY_ACCESS_TOKEN_COOKIE, "", getCookieOptions(0));
  response.cookies.set(SPOTIFY_REFRESH_TOKEN_COOKIE, "", getCookieOptions(0));
  clearSpotifyStateCookie(response);
}

export async function exchangeSpotifyCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const env = getSpotifyOAuthEnv();

  if (!env) {
    throw new Error("Spotify environment variables are not configured.");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: getSpotifyCredentialsHeader(env.clientId, env.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to connect Spotify account.");
  }

  return (await response.json()) as SpotifyOAuthTokenResponse;
}

async function refreshSpotifyToken(refreshToken: string) {
  const env = getSpotifyOAuthEnv();

  if (!env) {
    throw new Error("Spotify environment variables are not configured.");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: getSpotifyCredentialsHeader(env.clientId, env.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Spotify account session.");
  }

  return (await response.json()) as SpotifyOAuthTokenResponse;
}

function mapSpotifyAccountPlaylist(
  playlist: SpotifyUserPlaylistObject,
): SpotifyAccountPlaylist | null {
  if (!playlist.id || !playlist.name) {
    return null;
  }

  return {
    id: playlist.id,
    name: playlist.name,
    ownerName: playlist.owner?.display_name?.trim() || "Spotify",
    imageUrl: playlist.images?.[0]?.url?.trim() || null,
    tracksTotal:
      typeof playlist.tracks?.total === "number" ? playlist.tracks.total : 0,
    spotifyUrl:
      playlist.external_urls?.spotify ||
      `https://open.spotify.com/playlist/${playlist.id}`,
    isPublic: Boolean(playlist.public),
    isCollaborative: Boolean(playlist.collaborative),
  };
}

async function fetchSpotifyAccountPlaylistsWithToken(accessToken: string) {
  const playlists: SpotifyAccountPlaylist[] = [];
  let nextUrl:
    | string
    | null = "https://api.spotify.com/v1/me/playlists?limit=50";

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch Spotify account playlists.");
    }

    const payload = (await response.json()) as SpotifyUserPlaylistsResponse;

    for (const playlist of payload.items ?? []) {
      const mappedPlaylist = mapSpotifyAccountPlaylist(playlist);

      if (mappedPlaylist) {
        playlists.push(mappedPlaylist);
      }
    }

    nextUrl = payload.next ?? null;
  }

  return playlists;
}

export async function fetchSpotifyAccountPlaylists(): Promise<{
  result: SpotifyAccountPlaylistsResult;
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return {
      result: {
        connected: false,
        playlists: [],
        message: "Spotify ainda nao conectado.",
      },
      refreshedToken: null,
    };
  }

  try {
    if (accessToken) {
      return {
        result: {
          connected: true,
          playlists: await fetchSpotifyAccountPlaylistsWithToken(accessToken),
        },
        refreshedToken: null,
      };
    }

    if (!refreshToken) {
      throw new Error("Spotify session unavailable.");
    }

    const refreshedToken = await refreshSpotifyToken(refreshToken);

    return {
      result: {
        connected: true,
        playlists: await fetchSpotifyAccountPlaylistsWithToken(
          refreshedToken.access_token,
        ),
      },
      refreshedToken,
    };
  } catch (error) {
    return {
      result: {
        connected: false,
        playlists: [],
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar playlists do Spotify.",
      },
      refreshedToken: null,
    };
  }
}
