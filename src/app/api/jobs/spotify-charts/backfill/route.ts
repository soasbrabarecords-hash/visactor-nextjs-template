import { NextResponse } from "next/server";
import { backfillSpotifyCharts } from "@/lib/charts/spotify-chart-backfill";

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

  const searchParams = new URL(request.url).searchParams;

  try {
    const summary = await backfillSpotifyCharts({
      country: searchParams.get("country") ?? "",
      chartType: searchParams.get("chart_type") ?? "",
      startDate: searchParams.get("start_date") ?? "",
      endDate: searchParams.get("end_date") ?? "",
    });
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        success: 0,
        failed: 0,
        rows_count: 0,
        imported_dates: [],
        error: error instanceof Error ? error.message : "Backfill invalido.",
      },
      { status: 400 },
    );
  }
}
