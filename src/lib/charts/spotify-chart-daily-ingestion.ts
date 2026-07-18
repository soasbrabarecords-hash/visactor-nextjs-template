import "server-only";
import { ingestSpotifyChart } from "@/lib/charts/spotify-chart-ingestion";
import {
  type AutomaticChart,
  downloadSpotifyChartForDate,
  getAutomaticCharts,
} from "@/lib/charts/spotify-chart-source";
import { createAdminClient } from "@/lib/supabase/admin";

export const SPOTIFY_CHART_DAILY_LOOKBACK_DAYS = 7;

type CompleteSnapshot = {
  country: string;
  chart_date: string;
};

export type SpotifyChartDailyIngestionResult = {
  country: string;
  chartDate: string;
  status: "existing" | "success" | "failed" | "source-unavailable";
  rowsCount: number;
  updatedLatestEntries: boolean;
  error?: string;
};

function snapshotKey(country: string, chartDate: string) {
  return `${country}:${chartDate}`;
}

function normalizeError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Erro desconhecido na ingestao diaria.";
}

export function getSpotifyChartDailyRepairDates(
  now = new Date(),
  days = SPOTIFY_CHART_DAILY_LOOKBACK_DAYS,
) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  return Array.from({ length: days }, (_value, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (days - index));
    return date.toISOString().slice(0, 10);
  });
}

async function readRecentCompleteSnapshots(
  charts: AutomaticChart[],
  dates: string[],
) {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for daily Spotify Charts ingestion.",
    );
  }

  const { data, error } = await admin
    .from("spotify_chart_complete_snapshots")
    .select("country,chart_date")
    .eq("chart_type", "top-songs")
    .in(
      "country",
      charts.map((chart) => chart.country),
    )
    .gte("chart_date", dates[0]);

  if (error) {
    throw new Error(
      `Nao foi possivel verificar os snapshots recentes: ${error.message}`,
    );
  }

  return (data ?? []) as CompleteSnapshot[];
}

export async function ingestRecentSpotifyCharts(
  input: {
    now?: Date;
    charts?: AutomaticChart[];
    completeSnapshots?: CompleteSnapshot[];
    download?: typeof downloadSpotifyChartForDate;
    ingest?: typeof ingestSpotifyChart;
  } = {},
) {
  const charts = input.charts ?? getAutomaticCharts();
  const dates = getSpotifyChartDailyRepairDates(input.now);
  const completeSnapshots =
    input.completeSnapshots ??
    (await readRecentCompleteSnapshots(charts, dates));
  const download = input.download ?? downloadSpotifyChartForDate;
  const ingest = input.ingest ?? ingestSpotifyChart;
  const completeKeys = new Set(
    completeSnapshots.map((snapshot) =>
      snapshotKey(snapshot.country, snapshot.chart_date),
    ),
  );
  const latestCompleteDate = new Map<string, string>();
  const results: SpotifyChartDailyIngestionResult[] = [];

  for (const snapshot of completeSnapshots) {
    const current = latestCompleteDate.get(snapshot.country);
    if (!current || snapshot.chart_date > current) {
      latestCompleteDate.set(snapshot.country, snapshot.chart_date);
    }
  }

  // Oldest-first processing repairs calendar gaps without allowing an older
  // snapshot to replace the latest compatibility entries.
  for (const chartDate of dates) {
    for (const chart of charts) {
      if (completeKeys.has(snapshotKey(chart.country, chartDate))) {
        results.push({
          country: chart.country,
          chartDate,
          status: "existing",
          rowsCount: 200,
          updatedLatestEntries: false,
        });
        continue;
      }

      let downloaded;

      try {
        downloaded = await download(chart, chartDate);
      } catch (error) {
        results.push({
          country: chart.country,
          chartDate,
          status: "source-unavailable",
          rowsCount: 0,
          updatedLatestEntries: false,
          error: normalizeError(error),
        });
        continue;
      }

      const currentLatest = latestCompleteDate.get(chart.country);
      const updatesLatestEntries = !currentLatest || chartDate > currentLatest;
      const result = await ingest(chart, chartDate, async () => downloaded, {
        persistLegacyEntries: updatesLatestEntries,
        persistSnapshotAtomically: true,
      });

      if (!result.success) {
        results.push({
          country: chart.country,
          chartDate,
          status: "failed",
          rowsCount: 0,
          updatedLatestEntries: false,
          error: result.error,
        });
        continue;
      }

      completeKeys.add(snapshotKey(chart.country, chartDate));
      if (updatesLatestEntries) {
        latestCompleteDate.set(chart.country, chartDate);
      }
      results.push({
        country: chart.country,
        chartDate,
        status: "success",
        rowsCount: result.rowsCount,
        updatedLatestEntries: updatesLatestEntries,
      });
    }
  }

  const imported = results.filter((result) => result.status === "success");
  const failed = results.filter((result) => result.status === "failed");
  const sourceUnavailable = results.filter(
    (result) => result.status === "source-unavailable",
  );

  return {
    success: failed.length === 0,
    complete: failed.length === 0 && sourceUnavailable.length === 0,
    lookbackDays: SPOTIFY_CHART_DAILY_LOOKBACK_DAYS,
    checked: results.length,
    existing: results.filter((result) => result.status === "existing").length,
    imported: imported.length,
    failed: failed.length,
    sourceUnavailable: sourceUnavailable.length,
    importedDates: imported.map((result) => ({
      country: result.country,
      chartDate: result.chartDate,
    })),
    results,
  };
}
