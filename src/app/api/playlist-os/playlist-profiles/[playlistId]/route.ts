import { NextResponse } from "next/server";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";
import { getPlaylistGenreProfile } from "@/lib/track-profile-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ playlistId: string }> };
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET(_request: Request, { params }: Context) {
  try {
    const access = await getPlaylistOsReadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }
    const { playlistId } = await params;
    const profile = await getPlaylistGenreProfile(playlistId, {
      workspaceId: access.workspaceId,
    });
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
            : "Não foi possível calcular o perfil da playlist.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
