import { NextResponse } from "next/server";
import { updateCurrentWorkspaceSpotifyIntegration } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  appClientId?: unknown;
  appClientSecret?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const appClientId =
      typeof body.appClientId === "string" ? body.appClientId : null;
    const appClientSecret =
      typeof body.appClientSecret === "string" ? body.appClientSecret : null;

    const workspace = await updateCurrentWorkspaceSpotifyIntegration({
      appMode: "workspace_app",
      appClientId,
      appClientSecret,
    });

    return NextResponse.json({
      success: true,
      spotifyIntegration: workspace?.spotifyIntegration ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao salvar integracao.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status:
          message.toLowerCase().includes("sem permissao") ||
          message.toLowerCase().includes("indisponivel")
            ? 403
            : 400,
      },
    );
  }
}
