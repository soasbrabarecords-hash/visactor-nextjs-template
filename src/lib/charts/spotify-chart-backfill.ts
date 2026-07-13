import "server-only";
import { ingestSpotifyChart } from "@/lib/charts/spotify-chart-ingestion";
import {
  downloadSpotifyChartForDate,
  getBackfillChart,
  getBackfillChartRegionKeys,
} from "@/lib/charts/spotify-chart-source";

export const MAX_SPOTIFY_CHART_BACKFILL_DAYS = 7;

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function enumerateDates(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end) {
    throw new Error("start_date e end_date devem usar o formato YYYY-MM-DD.");
  }

  if (start > end) {
    throw new Error("start_date nao pode ser posterior a end_date.");
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (dates.length > MAX_SPOTIFY_CHART_BACKFILL_DAYS) {
    throw new Error(
      `O limite por execucao e de ${MAX_SPOTIFY_CHART_BACKFILL_DAYS} dias.`,
    );
  }

  return dates;
}

export async function backfillSpotifyCharts(input: {
  country: string;
  chartType: string;
  startDate: string;
  endDate: string;
}) {
  const country = input.country.trim().toUpperCase();
  const chartType = input.chartType.trim().toLowerCase();
  const chart = getBackfillChart(country, chartType);

  if (!chart) {
    throw new Error(
      `Chart de backfill nao configurado. Regioes conhecidas: ${getBackfillChartRegionKeys().join("/")}.`,
    );
  }

  const dates = enumerateDates(input.startDate, input.endDate);
  const results = [];

  for (const chartDate of dates) {
    results.push(
      await ingestSpotifyChart(chart, chartDate, () =>
        downloadSpotifyChartForDate(chart, chartDate),
      ),
    );
  }

  return {
    success: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    rows_count: results.reduce((total, result) => total + result.rowsCount, 0),
    imported_dates: results
      .filter((result) => result.success)
      .map((result) => result.chartDate),
    results,
  };
}
