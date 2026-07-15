import { NextResponse } from "next/server";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";
import { enrichTrackProfile } from "@/lib/track-profile-engine";
import type { TrackProfileInput } from "@/types/track-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function POST(request: Request) {
  try {
    const access = await getPlaylistOsReadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }
    const body = (await request.json()) as Partial<TrackProfileInput>;
    const spotifyTrackId = body.spotifyTrackId?.trim();
    if (!spotifyTrackId || !/^[A-Za-z0-9]{22}$/.test(spotifyTrackId)) {
      return NextResponse.json(
        { success: false, message: "Spotify track ID inválido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    const profile = await enrichTrackProfile(
      {
        spotifyTrackId,
        name: body.name,
        artists: body.artists,
        albumName: body.albumName,
        isrc: body.isrc,
        chartCountry: body.chartCountry,
      },
      { workspaceId: access.workspaceId },
    );
    return NextResponse.json(
      { success: true, profile },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível enriquecer a faixa agora.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
