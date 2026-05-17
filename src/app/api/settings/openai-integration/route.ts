import { NextResponse } from "next/server";
import { updateCurrentWorkspaceOpenAIIntegration } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  appMode?: unknown;
  apiKey?: unknown;
  model?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const appMode =
      body.appMode === "workspace_app" ? "workspace_app" : "global_app";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : null;
    const model = typeof body.model === "string" ? body.model : null;

    const workspace = await updateCurrentWorkspaceOpenAIIntegration({
      appMode,
      apiKey,
      model,
    });

    return NextResponse.json({
      success: true,
      openaiIntegration: workspace?.openaiIntegration ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao salvar OpenAI.";

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
