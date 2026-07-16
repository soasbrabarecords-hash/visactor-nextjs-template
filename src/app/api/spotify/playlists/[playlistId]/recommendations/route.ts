import { NextResponse } from "next/server";
import { getMusicIntelligence } from "@/lib/music-intelligence";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";
import { buildPlaylistSuggestionIntelligence } from "@/lib/playlist-suggestion-intelligence";
import { getSpotifyListeningSignals } from "@/lib/spotify-listening-signals";
import {
  fetchSpotifyEditablePlaylist,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";
import {
  attachTrackProfilesToMusicIntelligence,
  getTrackGenreProfiles,
  toTrackGenreCardProfile,
} from "@/lib/track-profile-engine";

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

    const playlistTracks = result.playlist.tracks;
    const baseIntelligence = await getMusicIntelligence();
    const [intelligence, playlistProfiles, listening] = await Promise.all([
      attachTrackProfilesToMusicIntelligence(
        baseIntelligence,
        access.workspaceId,
      ),
      getTrackGenreProfiles(
        playlistTracks.map((track) => ({
          spotifyTrackId: track.id,
          name: track.name,
          artists: track.artists,
          albumName: track.albumName,
        })),
        { workspaceId: access.workspaceId, persistFallbacks: true },
      ),
      getSpotifyListeningSignals(access.workspaceId),
    ]);
    const data = buildPlaylistSuggestionIntelligence({
      playlist: {
        name: result.playlist.name,
        description: result.playlist.description,
        tracks: playlistTracks.map((track) => ({
          id: track.id,
          name: track.name,
          artists: track.artists,
          genreProfile: toTrackGenreCardProfile(playlistProfiles.get(track.id)),
        })),
      },
      intelligence,
      listening,
    });
    const response = NextResponse.json(data, { headers: NO_STORE_HEADERS });

    const latestRefreshedToken = listening.refreshedToken ?? refreshedToken;
    if (latestRefreshedToken) {
      setSpotifyAuthCookies(response, latestRefreshedToken);
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
