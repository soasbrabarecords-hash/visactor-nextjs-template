import { NextResponse } from "next/server";
import { setSpotifyAuthCookies, withSpotifyToken } from "@/lib/spotify-user";
import type { SearchTrackResult } from "@/app/api/spotify/search/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SpotifyRecsResponse = {
  tracks?: Array<{
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

type PlaylistTracksResponse = {
  items?: Array<{
    track?: {
      id?: string | null;
      artists?: Array<{ id?: string | null }>;
    } | null;
  }>;
};

function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return "0:00";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function fetchSeedsFromPlaylist(
  accessToken: string,
  playlistId: string,
): Promise<{ trackIds: string[]; artistIds: string[] }> {
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(id,artists(id)))&limit=50`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!res.ok) return { trackIds: [], artistIds: [] };
  const data = (await res.json()) as PlaylistTracksResponse;
  const trackIds: string[] = [];
  const artistIds: string[] = [];
  for (const item of data.items ?? []) {
    if (item.track?.id) trackIds.push(item.track.id);
    for (const a of item.track?.artists ?? []) {
      if (a.id) artistIds.push(a.id);
    }
  }
  return { trackIds, artistIds };
}

async function fetchRecommendationsWithToken(
  accessToken: string,
  playlistId: string,
  limit: number,
): Promise<SearchTrackResult[]> {
  const { trackIds, artistIds } = await fetchSeedsFromPlaylist(accessToken, playlistId);

  // Pegar até 5 seeds (Spotify aceita no máximo 5 entre tracks/artists/genres)
  const seedTracks = trackIds.slice(0, 2);
  const seedArtists = Array.from(new Set(artistIds)).slice(0, 3);

  if (seedTracks.length === 0 && seedArtists.length === 0) {
    return [];
  }

  const url = new URL("https://api.spotify.com/v1/recommendations");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 20)));
  url.searchParams.set("market", "BR");
  if (seedTracks.length) url.searchParams.set("seed_tracks", seedTracks.join(","));
  if (seedArtists.length) url.searchParams.set("seed_artists", seedArtists.join(","));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Spotify recs error ${res.status}`);
  }

  const data = (await res.json()) as SpotifyRecsResponse;
  const existing = new Set(trackIds);

  return (data.tracks ?? [])
    .filter((t) => t.id && !existing.has(t.id))
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "10");

    const { data, refreshedToken } = await withSpotifyToken((token) =>
      fetchRecommendationsWithToken(token, playlistId, Number.isFinite(limit) ? limit : 10),
    );

    const response = NextResponse.json({ tracks: data });
    if (refreshedToken) setSpotifyAuthCookies(response, refreshedToken);
    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao buscar sugestões.", tracks: [] },
      { status: 500 },
    );
  }
}
