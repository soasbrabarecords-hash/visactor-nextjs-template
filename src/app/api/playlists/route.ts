import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { insertPlaylistIntoSupabase } from "@/lib/supabase-rest";
import {
  calculatePlaylistScore,
  extractSpotifyPlaylistId,
  fetchSpotifyPlaylistMetadata,
} from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatePlaylistBody = {
  url?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePlaylistBody;
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";

    if (!rawUrl) {
      return NextResponse.json(
        { message: "Playlist URL is required." },
        { status: 400 },
      );
    }

    const playlistId = extractSpotifyPlaylistId(rawUrl);

    if (!playlistId) {
      return NextResponse.json(
        { message: "Cole uma URL valida de playlist do Spotify." },
        { status: 400 },
      );
    }

    const spotifyPlaylist = await fetchSpotifyPlaylistMetadata(playlistId);
    const payload = {
      url: spotifyPlaylist.url,
      name: spotifyPlaylist.name,
      image_url: spotifyPlaylist.coverUrl,
      followers: spotifyPlaylist.followers,
      tracks: spotifyPlaylist.tracks,
      score: calculatePlaylistScore({
        followers: spotifyPlaylist.followers,
        tracks: spotifyPlaylist.tracks,
      }),
    };

    const insertedPlaylist = await insertPlaylistIntoSupabase(payload);

    revalidatePath("/");
    revalidatePath("/charts");

    return NextResponse.json(insertedPlaylist, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create playlist.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
