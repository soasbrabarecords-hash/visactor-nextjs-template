import { NextResponse } from "next/server";
import { setSpotifyAuthCookies } from "@/lib/spotify-user";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPOTIFY_ACCESS_TOKEN_COOKIE = "spotify_access_token";
const SPOTIFY_REFRESH_TOKEN_COOKIE = "spotify_refresh_token";

async function refreshToken(clientId: string, clientSecret: string, refreshTok: string) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshTok }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to refresh token.");
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; token_type: string };
}

async function putTracksOrder(accessToken: string, playlistId: string, uris: string[]) {
  // A Spotify API aceita no máximo 100 URIs por chamada
  // Se houver mais de 100 faixas, precisa fazer PUT seguido de POSTs adicionais
  const first100 = uris.slice(0, 100);
  const rest = uris.slice(100);

  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: first100 }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? "Falha ao reordenar playlist.");
  }

  const data = await res.json() as { snapshot_id?: string };
  let snapshotId = data.snapshot_id ?? "";

  // Se tiver mais de 100, adiciona o restante em batches
  for (let i = 0; i < rest.length; i += 100) {
    const batch = rest.slice(i, i + 100);
    const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: batch }),
      cache: "no-store",
    });
    if (!addRes.ok) {
      const err = await addRes.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? "Falha ao adicionar faixas extras.");
    }
    const addData = await addRes.json() as { snapshot_id?: string };
    snapshotId = addData.snapshot_id ?? snapshotId;
  }

  return snapshotId;
}

type ReorderFullBody = {
  uris?: unknown;
  snapshotId?: unknown;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const body = (await request.json()) as ReorderFullBody;

    if (!Array.isArray(body.uris) || body.uris.length === 0) {
      return NextResponse.json({ message: "uris é obrigatório." }, { status: 400 });
    }

    const uris = body.uris.filter((u): u is string => typeof u === "string");

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value;
    const refreshTok = cookieStore.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value;

    const clientId = process.env.SPOTIFY_CLIENT_ID ?? "";
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? "";

    let token = accessToken;
    let refreshedTokenData = null;

    if (!token) {
      if (!refreshTok) {
        return NextResponse.json({ message: "Spotify não conectado." }, { status: 401 });
      }
      refreshedTokenData = await refreshToken(clientId, clientSecret, refreshTok);
      token = refreshedTokenData.access_token;
    }

    let snapshotId: string;
    try {
      snapshotId = await putTracksOrder(token, playlistId, uris);
    } catch (err) {
      // Tenta refresh se falhou
      if (refreshTok && !refreshedTokenData) {
        refreshedTokenData = await refreshToken(clientId, clientSecret, refreshTok);
        token = refreshedTokenData.access_token;
        snapshotId = await putTracksOrder(token, playlistId, uris);
      } else {
        throw err;
      }
    }

    const response = NextResponse.json({ success: true, snapshotId });

    if (refreshedTokenData) {
      setSpotifyAuthCookies(response, refreshedTokenData);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao reordenar playlist." },
      { status: 500 },
    );
  }
}
