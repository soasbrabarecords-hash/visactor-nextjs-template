import { NextResponse } from "next/server";
import { ingestSpotifyChart } from "@/lib/charts/spotify-chart-ingestion";
import {
  downloadLatestAvailableChart,
  getAutomaticCharts,
  getLatestCandidateDates,
} from "@/lib/charts/spotify-chart-source";

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

  const results = [];

  for (const chart of getAutomaticCharts()) {
    results.push(
      await ingestSpotifyChart(
        chart,
        getLatestCandidateDates()[0],
        () => downloadLatestAvailableChart(chart),
      ),
    );
  }

  return NextResponse.json({
    success: results.every((result) => result.success),
    results,
  });
}
