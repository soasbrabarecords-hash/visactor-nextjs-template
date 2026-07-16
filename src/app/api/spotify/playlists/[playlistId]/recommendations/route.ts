import { NextResponse } from "next/server";
import { getMusicIntelligence } from "@/lib/music-intelligence";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";
import { buildPlaylistSuggestionIntelligence } from "@/lib/playlist-suggestion-intelligence";
import {
  fetchSpotifyEditablePlaylist,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";
import { attachTrackProfilesToMusicIntelligence } from "@/lib/track-profile-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const access = await getPlaylistOsReadAccess();

    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }

    const { playlistId } = await params;
    const { result, refreshedToken } =
      await fetchSpotifyEditablePlaylist(playlistId);

    if (!result.connected) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const intelligence = await attachTrackProfilesToMusicIntelligence(
      await getMusicIntelligence(),
      access.workspaceId,
    );
    const data = buildPlaylistSuggestionIntelligence({
      playlist: {
        name: result.playlist.name,
        description: result.playlist.description,
        tracks: result.playlist.tracks.map((track) => ({
          id: track.id,
          name: track.name,
          artists: track.artists,
        })),
      },
      intelligence,
    });
    const response = NextResponse.json(data, { headers: NO_STORE_HEADERS });

    if (refreshedToken) {
      setSpotifyAuthCookies(response, refreshedToken);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Playlist intelligence failed: ${message}\n`);
    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível montar as decisões desta playlist agora.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
