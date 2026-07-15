import { NextResponse } from "next/server";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";
import { listPlaylistAiConversations } from "@/lib/playlists-ai-conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET() {
  try {
    const access = await getPlaylistOsReadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }

    const conversations = await listPlaylistAiConversations({
      workspaceId: access.workspaceId,
      userId: access.userId,
    });
    return NextResponse.json(
      { success: true, conversations },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Playlists IA conversations failed: ${message}\n`);
    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível carregar as conversas salvas agora.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
