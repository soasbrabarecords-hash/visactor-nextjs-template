import { NextResponse } from "next/server";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";
import {
  archivePlaylistAiConversation,
  getPlaylistAiConversation,
} from "@/lib/playlists-ai-conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const access = await getPlaylistOsReadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }

    const { conversationId } = await context.params;
    if (!UUID_PATTERN.test(conversationId)) {
      return NextResponse.json(
        { success: false, message: "Conversa inválida." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const conversation = await getPlaylistAiConversation({
      conversationId,
      workspaceId: access.workspaceId,
      userId: access.userId,
    });
    if (!conversation) {
      return NextResponse.json(
        { success: false, message: "Conversa não encontrada neste workspace." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { success: true, conversation },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Playlists IA conversation failed: ${message}\n`);
    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível abrir esta conversa agora.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const access = await getPlaylistOsReadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }

    const { conversationId } = await context.params;
    if (!UUID_PATTERN.test(conversationId)) {
      return NextResponse.json(
        { success: false, message: "Conversa inválida." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const archived = await archivePlaylistAiConversation({
      conversationId,
      workspaceId: access.workspaceId,
      userId: access.userId,
    });
    if (!archived) {
      return NextResponse.json(
        { success: false, message: "Conversa não encontrada neste workspace." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Playlists IA conversation archive failed: ${message}\n`,
    );
    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível apagar esta conversa agora.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
