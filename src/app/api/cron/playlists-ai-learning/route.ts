import { NextResponse } from "next/server";
import { runPlaylistAiMaintenance } from "@/lib/playlists-ai-python-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const result = await runPlaylistAiMaintenance();
  if (!result.ok && result.reason === "not_configured") {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: result.reason,
    });
  }
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.reason },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    skipped: false,
    maintenance: result.value,
  });
}
