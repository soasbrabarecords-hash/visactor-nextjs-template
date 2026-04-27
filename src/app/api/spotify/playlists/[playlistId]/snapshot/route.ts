import { NextResponse } from "next/server";
import { fetchPlaylistSnapshotId, setSpotifyAuthCookies } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const { snapshotId, refreshedToken } = await fetchPlaylistSnapshotId(playlistId);
    const response = NextResponse.json({ snapshotId });
    if (refreshedToken) setSpotifyAuthCookies(response, refreshedToken);
    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao buscar snapshot." },
      { status: 500 },
    );
  }
}
