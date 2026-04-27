import { NextResponse } from "next/server";
import { setSpotifyAuthCookies } from "@/lib/spotify-user";
import { cookies } from "next/headers";

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

// Substitui a ordem completa da playlist.
// PUT /v1/playlists/{id}/tracks com até 100 URIs de uma vez SUBSTITUI tudo.
// Para playlists > 100 faixas, usamos range_start/insert_before em loop
// pra mover as faixas da posição atual para a posição desejada.
async function replacePlaylistTracks(
  accessToken: string,
  playlistId: string,
  uris: string[],
): Promise<string> {
  if (uris.length <= 100) {
    // Simples: PUT substitui toda a playlist
    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `Spotify error ${res.status}`);
    }
    const data = await res.json() as { snapshot_id?: string };
    return data.snapshot_id ?? "";
  }

  // > 100 faixas: PUT com as primeiras 100 (limpa a playlist e adiciona 100)
  // depois POST em batches de 100 para adicionar o restante
  const first100 = uris.slice(0, 100);
  const putRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris: first100 }),
    cache: "no-store",
  });
  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Spotify error ${putRes.status}`);
  }
  const putData = await putRes.json() as { snapshot_id?: string };
  let snapshotId = putData.snapshot_id ?? "";

  // Adiciona o restante em batches de 100
  for (let i = 100; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    // Pequeno delay pra não bater rate limit
    await new Promise((r) => setTimeout(r, 100));

    const postRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: batch, position: i }),
      cache: "no-store",
    });
    if (!postRes.ok) {
      const err = await postRes.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `Spotify error ${postRes.status}`);
    }
    const postData = await postRes.json() as { snapshot_id?: string };
    snapshotId = postData.snapshot_id ?? snapshotId;
  }

  return snapshotId;
}

type ReorderFullBody = { uris?: unknown; snapshotId?: unknown };

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
      if (!refreshTok) return NextResponse.json({ message: "Spotify não conectado." }, { status: 401 });
      refreshedTokenData = await doRefresh(clientId, clientSecret, refreshTok);
      token = refreshedTokenData.access_token;
    }

    let snapshotId: string;
    try {
      snapshotId = await replacePlaylistTracks(token!, playlistId, uris);
    } catch (err) {
      if (refreshTok && !refreshedTokenData) {
        refreshedTokenData = await doRefresh(clientId, clientSecret, refreshTok);
        token = refreshedTokenData.access_token;
        snapshotId = await replacePlaylistTracks(token, playlistId, uris);
      } else {
        throw err;
      }
    }

    const response = NextResponse.json({ success: true, snapshotId });
    if (refreshedTokenData) setSpotifyAuthCookies(response, refreshedTokenData);
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Erro ao reordenar playlist." },
      { status: 500 },
    );
  }
}
