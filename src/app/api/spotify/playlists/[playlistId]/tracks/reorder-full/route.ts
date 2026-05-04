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

  const { result, refreshedToken } = await replacePlaylistTracks(
    playlistId,
    uris,
  );

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
      },
      { status: getErrorStatus(result.message) },
    );
  }

  const response = NextResponse.json({
    success: true,
    snapshotId: result.snapshotId,
  });

  if (refreshedToken) {
    setSpotifyAuthCookies(response, refreshedToken);
  }

  return response;
}
