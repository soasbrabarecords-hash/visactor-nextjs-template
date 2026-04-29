import { NextResponse } from "next/server";
import { withSpotifyToken } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ArtistGenresResponse = Record<string, string[]>;

// Cache em memória 24h por artistId
const cache = new Map<string, { genres: string[]; expiresAt: number }>();
const TTL = 24 * 60 * 60 * 1000;

async function fetchArtistGenresBatch(
  token: string,
  ids: string[],
): Promise<ArtistGenresResponse> {
  const url = `https://api.spotify.com/v1/artists?ids=${ids.join(",")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    artists: Array<{ id: string; genres: string[] } | null>;
  };
  const result: ArtistGenresResponse = {};
  for (const artist of data.artists ?? []) {
    if (artist?.id) result[artist.id] = artist.genres ?? [];
  }
  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("ids") ?? "";
  const allIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allIds.length === 0) {
    return NextResponse.json({});
  }

  const now = Date.now();
  const result: ArtistGenresResponse = {};
  const missing: string[] = [];

  for (const id of allIds) {
    const hit = cache.get(id);
    if (hit && hit.expiresAt > now) {
      result[id] = hit.genres;
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    try {
      const { data: fetched } = await withSpotifyToken(async (token) => {
        const out: ArtistGenresResponse = {};
        // Spotify aceita max 50 ids por request
        for (let i = 0; i < missing.length; i += 50) {
          const batch = missing.slice(i, i + 50);
          const batchResult = await fetchArtistGenresBatch(token, batch);
          Object.assign(out, batchResult);
        }
        return out;
      });

      for (const [id, genres] of Object.entries(fetched)) {
        cache.set(id, { genres, expiresAt: now + TTL });
        result[id] = genres;
      }
      // IDs que não vieram = array vazio, cache negativo 1h
      for (const id of missing) {
        if (!(id in result)) {
          cache.set(id, { genres: [], expiresAt: now + 60 * 60 * 1000 });
          result[id] = [];
        }
      }
    } catch {
      // Se falhar, retorna o que tiver em cache
    }
  }

  return NextResponse.json(result);
}
