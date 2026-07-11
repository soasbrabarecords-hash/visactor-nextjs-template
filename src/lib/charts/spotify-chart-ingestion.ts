import "server-only";

import { importSpotifyChartCsv } from "@/lib/charts/import-spotify-chart-csv";
import {
  finishSpotifyChartRun,
  startSpotifyChartRun,
} from "@/lib/charts/spotify-chart-runs";
import type {
  AutomaticChart,
  DownloadedSpotifyChart,
} from "@/lib/charts/spotify-chart-source";

export type SpotifyChartIngestionResult = {
  success: boolean;
  chartType: string;
  country: string;
  chartDate: string;
  sourceUrl: string | null;
  sourceType: string | null;
  rowsCount: number;
  skippedCount?: number;
  error?: string;
};

export async function ingestSpotifyChart(
  chart: AutomaticChart,
  requestedDate: string,
  download: () => Promise<DownloadedSpotifyChart>,
): Promise<SpotifyChartIngestionResult> {
  let runId: string | null = null;
  let attemptedDate = requestedDate;
  let sourceUrl: string | null = null;
  let sourceType: string | null = null;

  try {
    runId = await startSpotifyChartRun({
      chartType: chart.chartType,
      country: chart.country,
      chartDate: requestedDate,
    });
    const downloaded = await download();
    attemptedDate = downloaded.chartDate;
    sourceUrl = downloaded.sourceUrl;
    sourceType = downloaded.sourceType;
    const result = await importSpotifyChartCsv({
      csvText: downloaded.csvText,
      chartType: chart.chartType,
      country: chart.country,
      chartDate: downloaded.chartDate,
      sourceUrl: downloaded.sourceUrl,
      sourceType: downloaded.sourceType,
      enrichSpotifyMetadata: false,
    });

    if (result.rows_count === 0) {
      throw new Error(
        result.errors[0] ??
          "CSV encontrado, mas nenhuma linha valida foi importada.",
      );
    }

    if (!result.debug?.entriesSaved || !result.debug.snapshotCreated) {
      throw new Error(
        result.errors[0] ??
          "O CSV foi parseado, mas o snapshot nao foi persistido no Supabase.",
      );
    }

    await finishSpotifyChartRun(runId, {
      status: "success",
      chartDate: downloaded.chartDate,
      sourceUrl: downloaded.sourceUrl,
      sourceType: downloaded.sourceType,
      rowsCount: result.rows_count,
    });

    return {
      success: true,
      chartType: chart.chartType,
      country: chart.country,
      chartDate: downloaded.chartDate,
      sourceUrl,
      sourceType,
      rowsCount: result.rows_count,
      skippedCount: result.skippedCount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido na ingestao.";

    if (runId) {
      await finishSpotifyChartRun(runId, {
        status: "error",
        chartDate: attemptedDate,
        sourceUrl,
        sourceType,
        rowsCount: 0,
        errorMessage: message,
      }).catch(() => undefined);
    }

    return {
      success: false,
      chartType: chart.chartType,
      country: chart.country,
      chartDate: attemptedDate,
      sourceUrl,
      sourceType,
      rowsCount: 0,
      error: message,
    };
  }
}
