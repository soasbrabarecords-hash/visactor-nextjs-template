import { NextResponse } from "next/server";
import { backfillSpotifyCharts } from "@/lib/charts/spotify-chart-backfill";
import { canCurrentUserBackfillSpotifyCharts } from "@/lib/charts/spotify-charts-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await canCurrentUserBackfillSpotifyCharts())) {
    return NextResponse.json(
      { error: "Apenas admins de workspace interno podem executar backfill." },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        country?: string;
        chart_type?: string;
        start_date?: string;
        end_date?: string;
      }
    | null;

  try {
    const summary = await backfillSpotifyCharts({
      country: payload?.country ?? "",
      chartType: payload?.chart_type ?? "",
      startDate: payload?.start_date ?? "",
      endDate: payload?.end_date ?? "",
    });
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill invalido." },
      { status: 400 },
    );
  }
}
