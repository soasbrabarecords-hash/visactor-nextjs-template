import { NextResponse } from "next/server";
import {
  replacePlaylistTracks,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReorderFullBody = {
  uris?: unknown;
};

function getErrorStatus(message: string) {
  if (message.includes("429")) {
    return 429;
  }

  if (
    message.toLowerCase().includes("nao conectado") ||
    message.toLowerCase().includes("session unavailable")
  ) {
    return 401;
  }

  return 500;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  const startedAt = Date.now();
  const { playlistId } = await params;
  const body = (await request.json()) as ReorderFullBody;

  if (!Array.isArray(body.uris) || body.uris.length === 0) {
    return NextResponse.json({ message: "uris e obrigatorio." }, { status: 400 });
  }

  const uris = body.uris.filter((value): value is string => typeof value === "string");

  if (uris.length === 0) {
    return NextResponse.json(
      { message: "Nenhuma URI valida foi enviada." },
      { status: 400 },
    );
  }

  // eslint-disable-next-line no-console -- production trace for Spotify mutations
  console.info("[spotify:playlist-order] update started", {
    playlistId,
    itemCount: uris.length,
  });

  const { result, refreshedToken } = await replacePlaylistTracks(
    playlistId,
    uris,
  );

  if (!result.success) {
    // eslint-disable-next-line no-console -- production trace for Spotify mutations
    console.error("[spotify:playlist-order] update failed", {
      playlistId,
      itemCount: uris.length,
      durationMs: Date.now() - startedAt,
      message: result.message,
    });
    return NextResponse.json(
      {
        success: false,
        message: result.message,
      },
      { status: getErrorStatus(result.message) },
    );
  }

  // eslint-disable-next-line no-console -- production trace for Spotify mutations
  console.info("[spotify:playlist-order] update completed", {
    playlistId,
    itemCount: uris.length,
    durationMs: Date.now() - startedAt,
    hasSnapshotId: Boolean(result.snapshotId),
  });

  const response = NextResponse.json({
    success: true,
    snapshotId: result.snapshotId,
  });

  if (refreshedToken) {
    setSpotifyAuthCookies(response, refreshedToken);
  }

  return response;
}
