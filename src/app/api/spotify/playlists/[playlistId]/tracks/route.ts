import { NextResponse } from "next/server";
import {
  addTrackToPlaylist,
  fetchSpotifyPlaylistTrackIds,
  removeTrackFromPlaylist,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteBody = {
  trackUri?: unknown;
  snapshotId?: unknown;
};

type AddBody = {
  trackUri?: unknown;
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  const { playlistId } = await params;
  const { result, refreshedToken } = await fetchSpotifyPlaylistTrackIds(playlistId);

  if (!result.success) {
    return NextResponse.json(
      { message: result.message },
      { status: getErrorStatus(result.message) },
    );
  }

  const response = NextResponse.json({
    trackIds: result.trackIds,
  });

  if (refreshedToken) {
    setSpotifyAuthCookies(response, refreshedToken);
  }

  return response;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  const { playlistId } = await params;
  const body = (await request.json()) as AddBody;
  const trackUri = typeof body.trackUri === "string" ? body.trackUri.trim() : "";

  if (!trackUri) {
    return NextResponse.json(
      { message: "trackUri e obrigatorio." },
      { status: 400 },
    );
  }

  const { result, refreshedToken } = await addTrackToPlaylist(
    playlistId,
    trackUri,
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
    alreadyExists: result.alreadyExists,
  });

  if (refreshedToken) {
    setSpotifyAuthCookies(response, refreshedToken);
  }

  return response;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  const { playlistId } = await params;
  const body = (await request.json()) as DeleteBody;
  const trackUri = typeof body.trackUri === "string" ? body.trackUri.trim() : "";
  const snapshotId =
    typeof body.snapshotId === "string" ? body.snapshotId.trim() : "";

  if (!trackUri) {
    return NextResponse.json(
      { message: "trackUri e obrigatorio." },
      { status: 400 },
    );
  }

  if (!snapshotId) {
    return NextResponse.json(
      { message: "snapshotId e obrigatorio." },
      { status: 400 },
    );
  }

  const { result, refreshedToken } = await removeTrackFromPlaylist(
    playlistId,
    trackUri,
    snapshotId,
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
