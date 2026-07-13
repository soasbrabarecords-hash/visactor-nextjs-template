import "server-only";
import { importSpotifyChartsCsvContent } from "@/lib/spotify-charts-csv";
import type { SpotifyChartsImportResult } from "@/lib/spotify-charts-importer";

export type SpotifyChartCsvImportInput = {
  csvText: string;
  chartType: string;
  country: string;
  metadataMarket?: string;
  chartDate: string;
  sourceUrl?: string;
  sourceType?: string;
  genre?: string;
  enrichSpotifyMetadata?: boolean;
  persistStreamSnapshots?: boolean;
};

export type SpotifyChartCsvImportSummary = SpotifyChartsImportResult & {
  rows_count: number;
  chart_type: string;
  country: string;
  chart_date: string;
  source_url: string | null;
};

export async function importSpotifyChartCsv({
  csvText,
  chartType,
  country,
  metadataMarket,
  chartDate,
  sourceUrl,
  sourceType,
  genre,
  enrichSpotifyMetadata = false,
  persistStreamSnapshots = true,
}: SpotifyChartCsvImportInput): Promise<SpotifyChartCsvImportSummary> {
  const normalizedCountry = country.trim().toUpperCase();
  const normalizedChartType = chartType.trim() || "top-songs";
  const normalizedChartDate = new Date(`${chartDate}T00:00:00.000Z`);

  if (!normalizedCountry) {
    throw new Error("country e obrigatorio para importar Spotify Charts.");
  }

  if (Number.isNaN(normalizedChartDate.getTime())) {
    throw new Error("chartDate invalida para importar Spotify Charts.");
  }

  const date = normalizedChartDate.toISOString().slice(0, 10);
  const result = await importSpotifyChartsCsvContent({
    csvText,
    chartType: normalizedChartType,
    country: normalizedCountry,
    metadataMarket,
    chartDate: date,
    sourceType,
    genre,
    enrichSpotifyMetadata,
    persistStreamSnapshots,
  });

  return {
    ...result,
    rows_count: result.insertedCount,
    chart_type: normalizedChartType,
    country: normalizedCountry,
    chart_date: date,
    source_url: sourceUrl?.trim() || null,
  };
}
