import { NextResponse } from "next/server";
import { setSpotifyAuthCookies, withSpotifyToken } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SearchTrackResult = {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  imageUrl: string | null;
  durationLabel: string;
  spotifyUrl: string;
  popularity: number;
};

type SpotifySearchResponse = {
  tracks?: {
    items?: Array<{
      id?: string;
      name?: string;
      duration_ms?: number;
      popularity?: number;
      external_urls?: { spotify?: string };
      album?: {
        name?: string;
        images?: Array<{ url?: string }>;
      };
      artists?: Array<{ name?: string }>;
    }>;
  };
};

function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return "0:00";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function spotifySearchWithToken(
  accessToken: string,
  query: string,
  limit: number,
): Promise<SearchTrackResult[]> {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 20)));
  url.searchParams.set("market", "BR");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Spotify search error ${res.status}`);
  }

  const data = (await res.json()) as SpotifySearchResponse;
  const items = data.tracks?.items ?? [];

  return items
    .filter((t) => t.id)
    .map((t) => ({
      id: t.id!,
      name: t.name ?? "(sem nome)",
      artists: (t.artists ?? []).map((a) => a.name).filter(Boolean).join(", "),
      albumName: t.album?.name ?? "",
      imageUrl: t.album?.images?.[0]?.url ?? null,
      durationLabel: formatDuration(t.duration_ms),
      spotifyUrl: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
      popularity: t.popularity ?? 0,
    }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Number(searchParams.get("limit") ?? "10");

    if (!q) {
      return NextResponse.json({ tracks: [] });
    }

    const { data, refreshedToken } = await withSpotifyToken((token) =>
      spotifySearchWithToken(token, q, Number.isFinite(limit) ? limit : 10),
    );

    const response = NextResponse.json({ tracks: data });
    if (refreshedToken) setSpotifyAuthCookies(response, refreshedToken);
    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao pesquisar.", tracks: [] },
      { status: 500 },
    );
  }
}
