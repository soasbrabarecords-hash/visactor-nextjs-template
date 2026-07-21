import { NextResponse } from "next/server";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";
import type { PlaylistOsAccessRole } from "@/lib/playlist-os-read-access";
import { sendPlaylistAiFeedback } from "@/lib/playlists-ai-python-client";
import type { PlaylistsAiFeedbackAction } from "@/types/playlists-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;
const FEEDBACK_ACTIONS = new Set<PlaylistsAiFeedbackAction>([
  "save",
  "ignore",
  "pin",
  "add",
]);
const LEARNING_ROLES = new Set<PlaylistOsAccessRole>([
  "owner",
  "admin",
  "curador",
]);

function textField(value: unknown, maxLength = 200) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

export async function POST(request: Request) {
  try {
    const access = await getPlaylistOsReadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }
    if (!LEARNING_ROLES.has(access.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Seu papel permite consultar, mas não treinar o Playlists IA.",
        },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const requestId = textField(body?.request_id);
    const trackId = textField(body?.track_id);
    const eventId = textField(body?.event_id);
    const action = textField(
      body?.action,
      32,
    ) as PlaylistsAiFeedbackAction | null;
    const targetPlaylistId =
      body?.target_playlist_id === null ||
      body?.target_playlist_id === undefined
        ? null
        : textField(body.target_playlist_id);
    const occurredAtValue = textField(body?.occurred_at, 64);
    const occurredAt = occurredAtValue ? new Date(occurredAtValue) : null;

    if (
      !requestId ||
      !trackId ||
      !eventId ||
      !action ||
      !FEEDBACK_ACTIONS.has(action) ||
      (action === "add" && !targetPlaylistId) ||
      (body?.target_playlist_id !== null &&
        body?.target_playlist_id !== undefined &&
        !targetPlaylistId) ||
      !occurredAt ||
      Number.isNaN(occurredAt.getTime())
    ) {
      return NextResponse.json(
        { success: false, message: "Feedback inválido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const result = await sendPlaylistAiFeedback({
      workspace_id: access.workspaceId,
      request_id: requestId,
      track_id: trackId,
      action,
      target_playlist_id: targetPlaylistId,
      actor_id: access.userId,
      actor_role: access.role,
      event_id: eventId,
      occurred_at: occurredAt.toISOString(),
    });

    if (!result.ok && result.reason !== "not_configured") {
      return NextResponse.json(
        {
          success: false,
          forwarded: false,
          retryable: true,
          message: "O serviço de aprendizado não aceitou o feedback.",
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        success: true,
        forwarded: result.ok,
        skipped: !result.ok && result.reason === "not_configured",
      },
      { status: 202, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[playlists-ai:feedback] ${message}\n`);
    return NextResponse.json(
      { success: false, message: "Não foi possível registrar o feedback." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
