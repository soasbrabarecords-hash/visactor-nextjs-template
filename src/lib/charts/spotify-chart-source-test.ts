import "server-only";
import {
  type DownloadedSpotifyChart,
  downloadSpotifyChartForDate,
  getBackfillChart,
} from "@/lib/charts/spotify-chart-source";
import { redactSpotifyChartSourceUrl } from "@/lib/charts/spotify-chart-source-resolver";
import {
  type SpotifyChartCsvInspection,
  inspectSpotifyChartsCsvContent,
} from "@/lib/spotify-charts-csv";
import { createAdminClient } from "@/lib/supabase/admin";

export type SpotifyChartHistoricalSourceProbe = {
  chart: NonNullable<ReturnType<typeof getBackfillChart>>;
  downloaded: DownloadedSpotifyChart;
  inspection: SpotifyChartCsvInspection;
};

function normalizeHistoricalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("date deve usar o formato YYYY-MM-DD.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("date deve ser uma data valida.");
  }

  const today = new Date().toISOString().slice(0, 10);
  if (value > today) {
    throw new Error("date nao pode estar no futuro.");
  }

  return value;
}

async function readHistoricalRegionConfiguration(regionId: string) {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY e obrigatoria para validar a regiao historica.",
    );
  }

  const { data, error } = await admin
    .from("spotify_chart_regions")
    .select("region_key,source_key,country_code,type")
    .eq("region_key", regionId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Regiao historica ${regionId} nao encontrada no catalogo: ${error?.message ?? "registro ausente"}.`,
    );
  }

  return {
    sourceKey: data.source_key as string,
    metadataMarket: (data.country_code as string | null) ?? "US",
  };
}

export async function probeSpotifyChartHistoricalSource(input: {
  regionId: string;
  chartType?: string;
  date: string;
}): Promise<SpotifyChartHistoricalSourceProbe> {
  const regionId = input.regionId.trim().toUpperCase();
  const chartType = input.chartType?.trim().toLowerCase() || "top-songs";
  const date = normalizeHistoricalDate(input.date);
  const region = await readHistoricalRegionConfiguration(regionId);
  const chart = getBackfillChart(regionId, chartType, region);

  if (!chart) {
    throw new Error(`Fonte historica nao configurada para ${regionId}.`);
  }

  const downloaded = await downloadSpotifyChartForDate(chart, date);
  const inspection = inspectSpotifyChartsCsvContent({
    csvText: downloaded.csvText,
    country: chart.country,
    chartDate: date,
    chartType: chart.chartType,
    sourceType: downloaded.sourceType,
  });

  if (!inspection.valid) {
    throw new SpotifyChartSourceValidationError(
      "A fonte respondeu, mas o parser nao validou o snapshot.",
      { chart, downloaded, inspection },
    );
  }

  return { chart, downloaded, inspection };
}

export class SpotifyChartSourceValidationError extends Error {
  readonly probe: SpotifyChartHistoricalSourceProbe;

  constructor(message: string, probe: SpotifyChartHistoricalSourceProbe) {
    super(message);
    this.name = "SpotifyChartSourceValidationError";
    this.probe = probe;
  }
}

export function summarizeSpotifyChartHistoricalProbe(
  probe: SpotifyChartHistoricalSourceProbe,
) {
  return {
    request: {
      regionId: probe.chart.country,
      chartType: probe.chart.chartType,
      date: probe.downloaded.chartDate,
    },
    source: {
      configured: true,
      type: probe.downloaded.sourceType,
      provider: probe.downloaded.sourceProvider,
      host: new URL(probe.downloaded.sourceUrl).hostname,
      url: redactSpotifyChartSourceUrl(probe.downloaded.sourceUrl),
    },
    response: {
      received: true,
      httpStatus: probe.downloaded.httpStatus,
      contentType: probe.downloaded.contentType,
      bytes: probe.downloaded.bytes,
      durationMs: probe.downloaded.durationMs,
      resolvedDate: probe.downloaded.chartDate,
      songCount: probe.inspection.parsedRows,
    },
    parser: {
      working: probe.inspection.valid,
      ...probe.inspection,
    },
  };
}

export async function testSpotifyChartHistoricalSource(input: {
  regionId: string;
  chartType?: string;
  date: string;
}) {
  const checkedAt = new Date().toISOString();
  const probe = await probeSpotifyChartHistoricalSource(input);
  const summary = summarizeSpotifyChartHistoricalProbe(probe);
  const snapshot = {
    generated: true,
    persisted: false,
    id: null,
    regionId: probe.chart.country,
    chartType: probe.chart.chartType,
    chartDate: probe.downloaded.chartDate,
    totalTracks: probe.inspection.parsedRows,
    validTracks: probe.inspection.validRows,
    uniqueRanks: probe.inspection.uniqueRanks,
    rankRange: {
      min: probe.inspection.minRank,
      max: probe.inspection.maxRank,
    },
    completeTop200: probe.inspection.completeTop200,
    source: {
      type: probe.downloaded.sourceType,
      provider: probe.downloaded.sourceProvider,
      url: redactSpotifyChartSourceUrl(probe.downloaded.sourceUrl),
    },
  };

  return {
    success: true,
    checkedAt,
    ...summary,
    snapshotGenerated: true,
    snapshot,
    errors: [],
    sideEffects: {
      queueTouched: false,
      campaignTouched: false,
      snapshotPersisted: false,
    },
  };
}
