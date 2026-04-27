import "server-only";

import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const SPOTIFY_ACCESS_TOKEN_COOKIE = "spotify_access_token";
const SPOTIFY_REFRESH_TOKEN_COOKIE = "spotify_refresh_token";
const SPOTIFY_STATE_COOKIE = "spotify_auth_state";
const SPOTIFY_PRODUCTION_REDIRECT_URI =
  "https://system.soasbraba.com/api/spotify/auth/callback";

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

type SpotifyCurrentUserResponse = {
  id?: string;
  display_name?: string | null;
};

type SpotifyUserPlaylistObject = {
  id?: string;
  name?: string;
  description?: string | null;
  public?: boolean | null;
  collaborative?: boolean;
  external_urls?: {
    spotify?: string;
  };
  images?: Array<{
    url?: string;
  }>;
  owner?: {
    id?: string;
    display_name?: string;
  };
  tracks?: {
    total?: number;
  };
};

type SpotifyPlaylistTracksResponse = {
  items?: SpotifyPlaylistTrackItem[];
  next?: string | null;
};

type SpotifyPlaylistTrackItem = {
  track?: {
    id?: string;
    name?: string;
    duration_ms?: number;
    popularity?: number;
    external_urls?: {
      spotify?: string;
    };
    album?: {
      name?: string;
      images?: Array<{
        url?: string;
      }>;
    };
    artists?: Array<{
      name?: string;
    }>;
  } | null;
};

export type SpotifyAccountPlaylist = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  imageUrl: string | null;
  tracksTotal: number;
  spotifyUrl: string;
  isPublic: boolean;
  isCollaborative: boolean;
};

export type SpotifyEditablePlaylistTrack = {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  imageUrl: string | null;
  durationLabel: string;
  popularity: number;
  spotifyUrl: string;
};

export type SpotifyEditablePlaylist = SpotifyAccountPlaylist & {
  description: string;
  tracks: SpotifyEditablePlaylistTrack[];
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

export type SpotifyEditablePlaylistResult =
  | {
      connected: true;
      playlist: SpotifyEditablePlaylist;
    }
  | {
      connected: false;
      playlist: null;
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
    (process.env.NODE_ENV === "production"
      ? SPOTIFY_PRODUCTION_REDIRECT_URI
      : null) ||
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
    show_dialog: "true",
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

function formatDuration(milliseconds: number | undefined) {
  if (!milliseconds || milliseconds <= 0) {
    return "—";
  }

  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function fetchSpotifyCurrentUserWithToken(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Spotify user profile.");
  }

  const profile = (await response.json()) as SpotifyCurrentUserResponse;

  if (!profile.id) {
    throw new Error("Spotify user profile unavailable.");
  }

  return profile;
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
    ownerId: playlist.owner?.id || "",
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

function mapSpotifyEditablePlaylistTrack(
  item: SpotifyPlaylistTrackItem,
): SpotifyEditablePlaylistTrack | null {
  const track = item.track;

  if (!track?.id || !track.name) {
    return null;
  }

  return {
    id: track.id,
    name: track.name,
    artists:
      track.artists
        ?.map((artist) => artist.name)
        .filter(Boolean)
        .join(", ") || "Artista nao informado",
    albumName: track.album?.name || "Album nao informado",
    imageUrl: track.album?.images?.[0]?.url?.trim() || null,
    durationLabel: formatDuration(track.duration_ms),
    popularity: typeof track.popularity === "number" ? track.popularity : 0,
    spotifyUrl:
      track.external_urls?.spotify ||
      `https://open.spotify.com/track/${track.id}`,
  };
}

async function fetchSpotifyAccountPlaylistsWithToken(accessToken: string) {
  const currentUser = await fetchSpotifyCurrentUserWithToken(accessToken);
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
      if (playlist.owner?.id !== currentUser.id) {
        continue;
      }

      const mappedPlaylist = mapSpotifyAccountPlaylist(playlist);

      if (mappedPlaylist) {
        playlists.push(mappedPlaylist);
      }
    }

    nextUrl = payload.next ?? null;
  }

  return playlists;
}

async function fetchSpotifyPlaylistTracksWithToken(
  accessToken: string,
  playlistId: string,
) {
  const tracks: SpotifyEditablePlaylistTrack[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch Spotify playlist tracks.");
    }

    const payload = (await response.json()) as SpotifyPlaylistTracksResponse;

    for (const item of payload.items ?? []) {
      const track = mapSpotifyEditablePlaylistTrack(item);

      if (track) {
        tracks.push(track);
      }
    }

    nextUrl = payload.next ?? null;
  }

  return tracks;
}

async function fetchSpotifyEditablePlaylistWithToken(
  accessToken: string,
  playlistId: string,
) {
  const currentUser = await fetchSpotifyCurrentUserWithToken(accessToken);
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Spotify playlist.");
  }

  const playlist = (await response.json()) as SpotifyUserPlaylistObject;

  if (playlist.owner?.id !== currentUser.id) {
    throw new Error("Esta playlist nao foi criada pela conta Spotify conectada.");
  }

  const mappedPlaylist = mapSpotifyAccountPlaylist(playlist);

  if (!mappedPlaylist) {
    throw new Error("Spotify playlist unavailable.");
  }

  return {
    ...mappedPlaylist,
    description: playlist.description?.trim() || "",
    tracks: await fetchSpotifyPlaylistTracksWithToken(accessToken, playlistId),
  };
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
      try {
        return {
          result: {
            connected: true,
            playlists: await fetchSpotifyAccountPlaylistsWithToken(accessToken),
          },
          refreshedToken: null,
        };
      } catch (error) {
        if (!refreshToken) {
          throw error;
        }
      }
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

export async function fetchSpotifyEditablePlaylist(
  playlistId: string,
): Promise<{
  result: SpotifyEditablePlaylistResult;
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return {
      result: {
        connected: false,
        playlist: null,
        message: "Spotify ainda nao conectado.",
      },
      refreshedToken: null,
    };
  }

  try {
    if (accessToken) {
      try {
        return {
          result: {
            connected: true,
            playlist: await fetchSpotifyEditablePlaylistWithToken(
              accessToken,
              playlistId,
            ),
          },
          refreshedToken: null,
        };
      } catch (error) {
        if (!refreshToken) {
          throw error;
        }
      }
    }

    if (!refreshToken) {
      throw new Error("Spotify session unavailable.");
    }

    const refreshedToken = await refreshSpotifyToken(refreshToken);

    return {
      result: {
        connected: true,
        playlist: await fetchSpotifyEditablePlaylistWithToken(
          refreshedToken.access_token,
          playlistId,
        ),
      },
      refreshedToken,
    };
  } catch (error) {
    return {
      result: {
        connected: false,
        playlist: null,
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar a playlist do Spotify.",
      },
      refreshedToken: null,
    };
  }
}
