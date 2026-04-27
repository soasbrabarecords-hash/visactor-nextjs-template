import { NextResponse } from "next/server";
import {
  removeTrackFromPlaylist,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteTracksBody = {
  trackUri?: unknown;
  snapshotId?: unknown;
};

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const body = (await request.json()) as DeleteTracksBody;

    const trackUri = typeof body.trackUri === "string" ? body.trackUri.trim() : "";
    const snapshotId = typeof body.snapshotId === "string" ? body.snapshotId.trim() : "";

    if (!trackUri) {
      return NextResponse.json({ message: "trackUri é obrigatório." }, { status: 400 });
    }

    if (!snapshotId) {
      return NextResponse.json({ message: "snapshotId é obrigatório." }, { status: 400 });
    }

    const { result, refreshedToken } = await removeTrackFromPlaylist(
      playlistId,
      trackUri,
      snapshotId,
    );

    const response = NextResponse.json(result);

    if (refreshedToken) {
      setSpotifyAuthCookies(response, refreshedToken);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao remover faixa." },
      { status: 500 },
    );
  }
}
