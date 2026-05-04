import { NextResponse } from "next/server";
import { updateCurrentWorkspaceSettings } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  workspaceName?: unknown;
  defaultMarket?: unknown;
  releaseWindowDays?: unknown;
  suggestionScoreThreshold?: unknown;
  prioritizeFollowedArtists?: unknown;
  prioritizeTopTracks?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    const workspace = await updateCurrentWorkspaceSettings({
      workspaceName:
        typeof body.workspaceName === "string" ? body.workspaceName : null,
      defaultMarket:
        typeof body.defaultMarket === "string" ? body.defaultMarket : "BR",
      releaseWindowDays:
        typeof body.releaseWindowDays === "number"
          ? body.releaseWindowDays
          : Number(body.releaseWindowDays ?? 21),
      suggestionScoreThreshold:
        typeof body.suggestionScoreThreshold === "number"
          ? body.suggestionScoreThreshold
          : Number(body.suggestionScoreThreshold ?? 70),
      prioritizeFollowedArtists: Boolean(body.prioritizeFollowedArtists),
      prioritizeTopTracks: Boolean(body.prioritizeTopTracks),
    });

    return NextResponse.json({
      success: true,
      workspace: workspace?.workspace ?? null,
      settings: workspace?.settings ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao salvar workspace.";

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
