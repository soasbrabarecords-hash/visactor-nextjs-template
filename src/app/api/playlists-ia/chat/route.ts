import { NextResponse } from "next/server";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";
import { runPlaylistsAiAgent } from "@/lib/playlists-ai-agent";
import type { PlaylistsAiConversationMessage } from "@/types/playlists-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

function parseMessages(value: unknown): PlaylistsAiConversationMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((item): PlaylistsAiConversationMessage[] => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const role =
        record.role === "user"
          ? "user"
          : record.role === "assistant"
            ? "assistant"
            : null;
      const content =
        typeof record.content === "string" ? record.content.trim() : "";
      if (!role || !content) return [];
      return [{ role, content: content.slice(0, 1600) }];
    })
    .slice(-10);
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

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const messageValue = body?.message ?? body?.prompt;
    const message = typeof messageValue === "string" ? messageValue.trim() : "";
    if (!message) {
      return NextResponse.json(
        {
          success: false,
          message: "Escreva uma pergunta para a Playlists IA.",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (message.length > 1600) {
      return NextResponse.json(
        {
          success: false,
          message: "A pergunta deve ter no máximo 1.600 caracteres.",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const result = await runPlaylistsAiAgent({
      message,
      messages: parseMessages(body?.messages),
    });
    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Playlists IA chat failed: ${message}\n`);
    return NextResponse.json(
      {
        success: false,
        message:
          "Não foi possível consultar os dados da Playlists IA agora. Nenhuma alteração foi executada.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
