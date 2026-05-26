import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addTrackToPlaylist,
  fetchSpotifyPlaylistTrackIds,
  removeTrackFromPlaylist,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";
import { getCurrentWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteBody = {
  trackUri?: unknown;
  snapshotId?: unknown;
};

type AddBody = {
  trackUri?: unknown;
  source?: unknown;
  chartSnapshotTrackId?: unknown;
};

function getErrorStatus(message: string) {
  if (message.includes("429")) {
    return 429;
  }

  if (
    message.toLowerCase().includes("nao conectado") ||
    message.toLowerCase().includes("session unavailable") ||
    message.toLowerCase().includes("conecte uma conta spotify")
  ) {
    return 401;
  }

  if (message.toLowerCase().includes("workspace vinculado")) {
    return 403;
  }

  return 500;
}

function extractSpotifyTrackId(trackUri: string) {
  return trackUri.replace(/^spotify:track:/, "").trim();
}

async function recordPlaylistAction(input: {
  workspaceId: string;
  userId: string;
  source: string;
  actionType: string;
  playlistId: string;
  trackId: string;
  chartSnapshotTrackId: string | null;
  status: string;
  errorMessage?: string | null;
}) {
  try {
    const supabase = await createClient();
    await supabase.from("playlist_actions").insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      source: input.source,
      action_type: input.actionType,
      spotify_playlist_id: input.playlistId,
      spotify_track_id: input.trackId,
      chart_snapshot_track_id: input.chartSnapshotTrackId,
      status: input.status,
      error_message: input.errorMessage ?? null,
    });
  } catch {
    // Historico de acoes nao deve bloquear a acao principal no Spotify.
  }
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
  const source = typeof body.source === "string" && body.source.trim()
    ? body.source.trim()
    : "playlist_add_button";
  const chartSnapshotTrackId =
    typeof body.chartSnapshotTrackId === "string" && body.chartSnapshotTrackId.trim()
      ? body.chartSnapshotTrackId.trim()
      : null;

  if (!trackUri) {
    return NextResponse.json(
      { message: "trackUri e obrigatorio." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspace = await getCurrentWorkspaceContext().catch(() => null);

  if (!user || !workspace) {
    return NextResponse.json(
      {
        success: false,
        message: "Nenhum workspace vinculado. Peça acesso a um administrador.",
      },
      { status: 403 },
    );
  }

  const { result, refreshedToken } = await addTrackToPlaylist(
    playlistId,
    trackUri,
  );

  if (!result.success) {
    await recordPlaylistAction({
      workspaceId: workspace.workspace.id,
      userId: user.id,
      source,
      actionType: "add_track",
      playlistId,
      trackId: extractSpotifyTrackId(trackUri),
      chartSnapshotTrackId,
      status: "error",
      errorMessage: result.message,
    });

    return NextResponse.json(
      {
        success: false,
        message: result.message,
      },
      { status: getErrorStatus(result.message) },
    );
  }

  await recordPlaylistAction({
    workspaceId: workspace.workspace.id,
    userId: user.id,
    source,
    actionType: "add_track",
    playlistId,
    trackId: extractSpotifyTrackId(trackUri),
    chartSnapshotTrackId,
    status: result.alreadyExists ? "already_exists" : "success",
  });

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
