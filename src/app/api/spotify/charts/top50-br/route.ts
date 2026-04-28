import { NextResponse } from "next/server";
import { fetchSpotifyPlaylistTracks } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Brazil Top 50 playlist — official Spotify editorial (public, no user auth needed)
const BR_TOP50_PLAYLIST_ID = "37i9dQZEVXbMXbN3EUUhlg";

export type Top50Track = {
  rank: number;
  trackId: string;
  trackName: string;
  artist: string;
  artistIds: string[];
  albumName: string;
  albumArt: string | null;
  popularity: number | null;
};

export type Top50Response = {
  tracks: Top50Track[];
  fetchedAt: string;
};

// In-memory cache — 30 min TTL
const _cache = {
  data: null as Top50Response | null,
  expiresAt: 0,
};

export async function GET() {
  const now = Date.now();
  if (_cache.data && _cache.expiresAt > now) {
    return NextResponse.json(_cache.data);
  }

  try {
    // Uses Client Credentials flow — no user login required
    const records = await fetchSpotifyPlaylistTracks(BR_TOP50_PLAYLIST_ID, "BR");

    const tracks: Top50Track[] = records.slice(0, 50).map((t, i) => ({
      rank: i + 1,
      trackId: t.id,
      trackName: t.name,
      artist: t.artists.join(", "),
      artistIds: t.artistIds,
      albumName: t.albumName,
      albumArt: t.coverUrl,
      popularity: t.popularity,
    }));

    const result: Top50Response = { tracks, fetchedAt: new Date().toISOString() };

    _cache.data = result;
    _cache.expiresAt = now + 30 * 60 * 1000;

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { tracks: [], fetchedAt: new Date().toISOString(), error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 502 },
    );
  }
}
