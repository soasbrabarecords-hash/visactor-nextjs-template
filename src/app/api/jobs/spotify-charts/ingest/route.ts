import { NextResponse } from "next/server";
import { ingestRecentSpotifyCharts } from "@/lib/charts/spotify-chart-daily-ingestion";
import {
  SPOTIFY_CHART_GENRE_ENRICHMENT_DEFAULT_LIMIT,
  SPOTIFY_CHART_GENRE_ENRICHMENT_MAX_LIMIT,
  enrichLatestSpotifyChartGenres,
} from "@/lib/charts/spotify-chart-genre-enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROUTE_WORK_BUDGET_MS = 250_000;
const MINIMUM_GENRE_BUDGET_MS = 10_000;

function parseGenreLimit(value: string | null) {
  if (value === null) return SPOTIFY_CHART_GENRE_ENRICHMENT_DEFAULT_LIMIT;
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return parsed >= 1 && parsed <= SPOTIFY_CHART_GENRE_ENRICHMENT_MAX_LIMIT
    ? parsed
    : null;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  const searchParams = new URL(request.url).searchParams;
  const genreLimit = parseGenreLimit(searchParams.get("genre_limit"));
  const genresOnly = searchParams.get("genres_only") === "1";

  if (genreLimit === null) {
    return NextResponse.json(
      {
        success: false,
        error: `genre_limit deve estar entre 1 e ${SPOTIFY_CHART_GENRE_ENRICHMENT_MAX_LIMIT}.`,
      },
      { status: 400 },
    );
  }

  const ingestion = genresOnly ? null : await ingestRecentSpotifyCharts();
  const remainingBudgetMs = ROUTE_WORK_BUDGET_MS - (Date.now() - startedAt);
  const genreEnrichment =
    remainingBudgetMs >= MINIMUM_GENRE_BUDGET_MS
      ? await enrichLatestSpotifyChartGenres({
          limit: genreLimit,
          maxDurationMs: remainingBudgetMs,
        })
      : {
          skipped: true,
          reason: "insufficient_route_time_budget",
          remainingBudgetMs,
        };

  return NextResponse.json({
    success: ingestion?.success ?? true,
    genresOnly,
    ingestion,
    genreEnrichment,
    durationMs: Date.now() - startedAt,
  });
}
