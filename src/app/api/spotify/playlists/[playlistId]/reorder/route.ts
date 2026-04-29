import { NextResponse } from "next/server";
import {
  reorderPlaylistTracks,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReorderBody = {
  rangeStart?: unknown;
  insertBefore?: unknown;
  snapshotId?: unknown;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const body = (await request.json()) as ReorderBody;

    const rangeStart = typeof body.rangeStart === "number" ? body.rangeStart : -1;
    const insertBefore = typeof body.insertBefore === "number" ? body.insertBefore : -1;
    const snapshotId = typeof body.snapshotId === "string" ? body.snapshotId.trim() : "";

    if (rangeStart < 0 || insertBefore < 0) {
      return NextResponse.json(
        { message: "rangeStart e insertBefore são obrigatórios." },
        { status: 400 },
      );
    }

    if (!snapshotId) {
      return NextResponse.json({ message: "snapshotId é obrigatório." }, { status: 400 });
    }

    const { result, refreshedToken } = await reorderPlaylistTracks(
      playlistId,
      rangeStart,
      insertBefore,
      snapshotId,
    );

    const response = NextResponse.json(result);

    if (refreshedToken) {
      setSpotifyAuthCookies(response, refreshedToken);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao reordenar faixas." },
      { status: 500 },
    );
  }
}
