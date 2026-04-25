import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { insertPlaylistIntoSupabase } from "@/lib/supabase-rest";
import {
  extractSpotifyPlaylistId,
  fetchSpotifyPlaylistMetadata,
} from "@/lib/spotify";

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

    let payload = {
      url: rawUrl,
      name: null as string | null,
      followers: null as number | null,
      tracks: null as number | null,
      score: null as number | null,
    };

    if (playlistId) {
      try {
        const spotifyPlaylist = await fetchSpotifyPlaylistMetadata(playlistId);
        payload = {
          ...payload,
          url: spotifyPlaylist.url,
          name: spotifyPlaylist.name,
          followers: spotifyPlaylist.followers,
          tracks: spotifyPlaylist.tracks,
        };
      } catch {
        payload = {
          ...payload,
          url: rawUrl,
        };
      }
    }

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
