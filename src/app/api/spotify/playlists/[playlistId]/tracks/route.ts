import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setSpotifyAuthCookies } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPOTIFY_ACCESS_TOKEN_COOKIE = "spotify_access_token";
const SPOTIFY_REFRESH_TOKEN_COOKIE = "spotify_refresh_token";

async function doRefresh(clientId: string, clientSecret: string, refreshTok: string) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshTok }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Falha ao renovar sessão do Spotify.");
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; token_type: string };
}

async function removeTrack(
  accessToken: string,
  playlistId: string,
  trackUri: string,
  snapshotId: string,
): Promise<string> {
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tracks: [{ uri: trackUri }], snapshot_id: snapshotId }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string; status?: number } };
    throw new Error(err?.error?.message ?? `Spotify error ${res.status}`);
  }

  const data = await res.json() as { snapshot_id?: string };
  return data.snapshot_id ?? snapshotId;
}

async function fetchTrackIds(accessToken: string, playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(id)),next&limit=50`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `Spotify error ${res.status}`);
    }

    const data = await res.json() as {
      items?: Array<{ track?: { id?: string | null } | null }>;
      next?: string | null;
    };

    for (const item of data.items ?? []) {
      if (item.track?.id) ids.push(item.track.id);
    }

    nextUrl = data.next ?? null;
  }

  return ids;
}

async function addTrack(accessToken: string, playlistId: string, trackUri: string) {
  const existingIds = await fetchTrackIds(accessToken, playlistId);
  const trackId = trackUri.replace("spotify:track:", "");

  if (existingIds.includes(trackId)) {
    return { alreadyExists: true };
  }

  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [trackUri] }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Spotify error ${res.status}`);
  }

  return { alreadyExists: false };
}

type DeleteBody = { trackUri?: unknown; snapshotId?: unknown };
type AddBody = { trackUri?: unknown };

async function getSpotifyToken() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value;
  const refreshTok = cookieStore.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value;
  const clientId = process.env.SPOTIFY_CLIENT_ID ?? "";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? "";

  if (accessToken) {
    return { token: accessToken, refreshTok, clientId, clientSecret, refreshedTokenData: null };
  }

  if (!refreshTok) {
    throw new Error("Spotify não conectado.");
  }

  const refreshedTokenData = await doRefresh(clientId, clientSecret, refreshTok);

  return {
    token: refreshedTokenData.access_token,
    refreshTok,
    clientId,
    clientSecret,
    refreshedTokenData,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const auth = await getSpotifyToken();
    const { refreshTok, clientId, clientSecret } = auth;
    let { token, refreshedTokenData } = auth;

    let trackIds: string[];
    try {
      trackIds = await fetchTrackIds(token, playlistId);
    } catch (error) {
      if (refreshTok && !refreshedTokenData) {
        refreshedTokenData = await doRefresh(clientId, clientSecret, refreshTok);
        token = refreshedTokenData.access_token;
        trackIds = await fetchTrackIds(token, playlistId);
      } else {
        throw error;
      }
    }

    const response = NextResponse.json({ trackIds });
    if (refreshedTokenData) setSpotifyAuthCookies(response, refreshedTokenData);
    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao buscar faixas." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const body = (await request.json()) as AddBody;
    const trackUri = typeof body.trackUri === "string" ? body.trackUri.trim() : "";

    if (!trackUri) {
      return NextResponse.json({ message: "trackUri é obrigatório." }, { status: 400 });
    }

    const auth = await getSpotifyToken();
    const { refreshTok, clientId, clientSecret } = auth;
    let { token, refreshedTokenData } = auth;

    let result: { alreadyExists: boolean };
    try {
      result = await addTrack(token, playlistId, trackUri);
    } catch (error) {
      if (refreshTok && !refreshedTokenData) {
        refreshedTokenData = await doRefresh(clientId, clientSecret, refreshTok);
        token = refreshedTokenData.access_token;
        result = await addTrack(token, playlistId, trackUri);
      } else {
        throw error;
      }
    }

    const response = NextResponse.json({ success: true, alreadyExists: result.alreadyExists });
    if (refreshedTokenData) setSpotifyAuthCookies(response, refreshedTokenData);
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Erro ao adicionar faixa." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const body = (await request.json()) as DeleteBody;

    const trackUri = typeof body.trackUri === "string" ? body.trackUri.trim() : "";
    const snapshotId = typeof body.snapshotId === "string" ? body.snapshotId.trim() : "";

    if (!trackUri) return NextResponse.json({ message: "trackUri é obrigatório." }, { status: 400 });
    if (!snapshotId) return NextResponse.json({ message: "snapshotId é obrigatório." }, { status: 400 });

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value;
    const refreshTok = cookieStore.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value;
    const clientId = process.env.SPOTIFY_CLIENT_ID ?? "";
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? "";

    let token = accessToken;
    let refreshedTokenData = null;

    if (!token) {
      if (!refreshTok) return NextResponse.json({ message: "Spotify não conectado." }, { status: 401 });
      refreshedTokenData = await doRefresh(clientId, clientSecret, refreshTok);
      token = refreshedTokenData.access_token;
    }

    let newSnapshotId: string;
    try {
      newSnapshotId = await removeTrack(token!, playlistId, trackUri, snapshotId);
    } catch (err) {
      if (refreshTok && !refreshedTokenData) {
        refreshedTokenData = await doRefresh(clientId, clientSecret, refreshTok);
        token = refreshedTokenData.access_token;
        newSnapshotId = await removeTrack(token, playlistId, trackUri, snapshotId);
      } else {
        throw err;
      }
    }

    const response = NextResponse.json({ success: true, snapshotId: newSnapshotId });
    if (refreshedTokenData) setSpotifyAuthCookies(response, refreshedTokenData);
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Erro ao remover faixa." },
      { status: 500 },
    );
  }
}
