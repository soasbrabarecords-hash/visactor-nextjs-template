import { NextResponse } from "next/server";
import { withSpotifyToken } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Brazil Top 50 playlist — official Spotify editorial
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
    const { data: result } = await withSpotifyToken<Top50Response>(async (token) => {
      const url = `https://api.spotify.com/v1/playlists/${BR_TOP50_PLAYLIST_ID}/tracks?limit=50&fields=items(track(id,name,artists(id,name),album(name,images),popularity))`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Spotify API error: ${res.status}`);
      }

      const json = (await res.json()) as {
        items: Array<{
          track: {
            id: string;
            name: string;
            artists: Array<{ id: string; name: string }>;
            album: { name: string; images: Array<{ url: string }> };
            popularity: number | null;
          } | null;
        }>;
      };

      const tracks: Top50Track[] = [];
      for (const item of json.items) {
        if (!item.track) continue;
        const t = item.track;
        const rank = tracks.length + 1;
        tracks.push({
          rank,
          trackId: t.id,
          trackName: t.name,
          artist: t.artists.map((a) => a.name).join(", "),
          artistIds: t.artists.map((a) => a.id),
          albumName: t.album.name,
          albumArt: t.album.images[0]?.url ?? null,
          popularity: t.popularity,
        });
      }

      return { tracks, fetchedAt: new Date().toISOString() };
    });

    _cache.data = result;
    _cache.expiresAt = now + 30 * 60 * 1000;

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ tracks: [], fetchedAt: new Date().toISOString() });
  }
}
