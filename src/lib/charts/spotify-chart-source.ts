import "server-only";
import { CURRENT_AUTOMATIC_SPOTIFY_CHART_REGIONS } from "@/lib/charts/spotify-chart-region-catalog";

export type SpotifyChartSourceType = "spotify_official" | "kworb";

export type AutomaticChart = {
  chartType: string;
  country: string;
  metadataMarket: string;
  csvUrlTemplate: string | null;
  fallbackUrl: string | null;
};

export type DownloadedSpotifyChart = {
  chartDate: string;
  csvText: string;
  sourceUrl: string;
  sourceType: SpotifyChartSourceType;
};

type HistoricalSourceConfig = {
  regionId: string;
  sourceKey: string;
  environmentVariable: string;
  fallbackUrl: string | null;
  metadataMarket: string;
  requiresCityValidation: boolean;
};

// Keep this separate from CURRENT_AUTOMATIC_SPOTIFY_CHART_REGIONS. The daily
// 10h cron must remain BR + Global even after city backfills are enabled.
const historicalSourceConfigs = [
  {
    regionId: "BR",
    sourceKey: "br",
    environmentVariable: "SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE",
    fallbackUrl: "https://kworb.net/spotify/country/br_daily.html",
    metadataMarket: "BR",
    requiresCityValidation: false,
  },
  {
    regionId: "GLOBAL",
    sourceKey: "global",
    environmentVariable: "SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE",
    fallbackUrl: "https://kworb.net/spotify/country/global_daily.html",
    metadataMarket: "US",
    requiresCityValidation: false,
  },
  {
    regionId: "BR-SP-SAO-PAULO",
    sourceKey: "br-sao-paulo",
    environmentVariable: "SPOTIFY_CHARTS_BR_SAO_PAULO_CSV_URL_TEMPLATE",
    fallbackUrl: null,
    metadataMarket: "BR",
    requiresCityValidation: true,
  },
  {
    regionId: "BR-RJ-RIO-DE-JANEIRO",
    sourceKey: "br-rio-de-janeiro",
    environmentVariable: "SPOTIFY_CHARTS_BR_RIO_DE_JANEIRO_CSV_URL_TEMPLATE",
    fallbackUrl: null,
    metadataMarket: "BR",
    requiresCityValidation: true,
  },
  {
    regionId: "BR-RS-PORTO-ALEGRE",
    sourceKey: "br-porto-alegre",
    environmentVariable: "SPOTIFY_CHARTS_BR_PORTO_ALEGRE_CSV_URL_TEMPLATE",
    fallbackUrl: null,
    metadataMarket: "BR",
    requiresCityValidation: true,
  },
] as const satisfies readonly HistoricalSourceConfig[];

function readHistoricalTemplate(environmentVariable: string) {
  return process.env[environmentVariable]?.trim() || null;
}

function isCityBackfillValidated() {
  return process.env.SPOTIFY_CHARTS_CITY_BACKFILL_VALIDATED === "1";
}

function getHistoricalSourceConfig(regionId: string) {
  const normalizedRegionId = regionId.trim().toUpperCase();
  return (
    historicalSourceConfigs.find(
      (source) => source.regionId === normalizedRegionId,
    ) ?? null
  );
}

function mapHistoricalChart(source: HistoricalSourceConfig): AutomaticChart {
  return {
    chartType: "top-songs",
    country: source.regionId,
    metadataMarket: source.metadataMarket,
    csvUrlTemplate: readHistoricalTemplate(source.environmentVariable),
    fallbackUrl: source.fallbackUrl,
  };
}

export function getAutomaticCharts(): AutomaticChart[] {
  return CURRENT_AUTOMATIC_SPOTIFY_CHART_REGIONS.map((region) => {
    const source = getHistoricalSourceConfig(region.regionKey);

    if (!source) {
      throw new Error(`Fonte automatica ausente para ${region.regionKey}.`);
    }

    return mapHistoricalChart(source);
  });
}

export function getHistoricalSpotifyChartSourceReadiness(
  regionIds: readonly string[] = historicalSourceConfigs.map(
    (source) => source.regionId,
  ),
) {
  return regionIds.map((regionId) => {
    const source = getHistoricalSourceConfig(regionId);
    const template = source
      ? readHistoricalTemplate(source.environmentVariable)
      : null;
    const hasHistoricalTemplate = Boolean(template?.includes("{date}"));
    const citySourceValidated =
      !source?.requiresCityValidation || isCityBackfillValidated();
    const supportsHistoricalDates =
      hasHistoricalTemplate && citySourceValidated;

    return {
      regionId: regionId.trim().toUpperCase(),
      supportsHistoricalDates,
      requiredEnvironmentVariable: source?.environmentVariable ?? null,
      reason: !source
        ? "historical_region_not_configured"
        : source.requiresCityValidation && !citySourceValidated
          ? "historical_city_source_not_validated"
          : supportsHistoricalDates
            ? null
            : template
              ? "template_missing_date_placeholder"
              : "historical_csv_template_not_configured",
    };
  });
}

export function getAutomaticChart(country: string, chartType: string) {
  const normalizedCountry = country.trim().toUpperCase();
  const normalizedChartType = chartType.trim().toLowerCase();

  return (
    getAutomaticCharts().find(
      (chart) =>
        chart.country === normalizedCountry &&
        chart.chartType === normalizedChartType,
    ) ?? null
  );
}

export function getBackfillChart(country: string, chartType: string) {
  const normalizedCountry = country.trim().toUpperCase();
  const normalizedChartType = chartType.trim().toLowerCase();
  const source = getHistoricalSourceConfig(normalizedCountry);

  if (!source || normalizedChartType !== "top-songs") return null;

  const readiness = getHistoricalSpotifyChartSourceReadiness([
    normalizedCountry,
  ])[0];
  if (!readiness?.supportsHistoricalDates && source.requiresCityValidation) {
    return null;
  }

  const chart = mapHistoricalChart(source);
  if (!chart.csvUrlTemplate && !chart.fallbackUrl) return null;
  return chart;
}

export function getBackfillChartRegionKeys() {
  return historicalSourceConfigs.map((source) => source.regionId);
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getLatestCandidateDates() {
  const today = new Date();

  return [0, 1, 2].map((daysAgo) => {
    const candidate = new Date(today);
    candidate.setUTCDate(candidate.getUTCDate() - daysAgo);
    return formatUtcDate(candidate);
  });
}

function buildSourceUrl(template: string, chartDate: string) {
  return template.replaceAll("{date}", chartDate);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

function stripHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function parseInteger(value: string) {
  const normalized = value.replace(/[^\d-]/g, "");
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function convertKworbHtmlToCsv(html: string) {
  const dateMatch = html.match(
    /Spotify Daily Chart[^<]*-\s*(\d{4})\/(\d{2})\/(\d{2})/i,
  );
  const chartDate = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    : null;
  const tableMatch = html.match(
    /<table[^>]*id=["']spotifydaily["'][^>]*>([\s\S]*?)<\/table>/i,
  );

  if (!chartDate || !tableMatch) {
    throw new Error(
      "O Kworb nao retornou uma data e uma tabela de chart validas.",
    );
  }

  const csvRows = [
    [
      "rank",
      "previous_rank",
      "track_name",
      "artist_names",
      "spotify_track_uri",
      "streams",
      "source_type",
    ]
      .map(csvCell)
      .join(","),
  ];

  for (const rowMatch of tableMatch[1].matchAll(
    /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
  )) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 7) continue;

    const rank = parseInteger(stripHtml(cells[0][1]));
    const movement = stripHtml(cells[1][1]);
    const titleCell = cells[2][1];
    const trackMatch = titleCell.match(
      /href=["'][^"']*\/track\/([A-Za-z0-9]+)\.html["'][^>]*>([\s\S]*?)<\/a>/i,
    );

    if (!rank || !trackMatch) continue;

    const artistNames = Array.from(
      titleCell.matchAll(
        /href=["'][^"']*\/artist\/[A-Za-z0-9]+\.html["'][^>]*>([\s\S]*?)<\/a>/gi,
      ),
      (match) => stripHtml(match[1]),
    ).filter(Boolean);
    const movementAmount = parseInteger(movement);
    const previousRank =
      movement === "="
        ? rank
        : movement.startsWith("+") && movementAmount !== null
          ? rank + movementAmount
          : movement.startsWith("-") && movementAmount !== null
            ? Math.max(1, rank - Math.abs(movementAmount))
            : null;

    csvRows.push(
      [
        rank,
        previousRank,
        stripHtml(trackMatch[2]),
        Array.from(new Set(artistNames)).join(", "),
        `spotify:track:${trackMatch[1]}`,
        parseInteger(stripHtml(cells[6][1])),
        "kworb",
      ]
        .map(csvCell)
        .join(","),
    );

    if (csvRows.length > 200) break;
  }

  if (csvRows.length === 1) {
    throw new Error("O Kworb nao retornou faixas validas.");
  }

  return { chartDate, csvText: csvRows.join("\n") };
}

async function downloadOfficialChart(
  chart: AutomaticChart,
  chartDate: string,
): Promise<DownloadedSpotifyChart | null> {
  if (!chart.csvUrlTemplate) return null;

  const sourceUrl = buildSourceUrl(chart.csvUrlTemplate, chartDate);
  const response = await fetch(sourceUrl, {
    cache: "no-store",
    headers: {
      Accept: "text/csv,text/plain;q=0.9,*/*;q=0.1",
      "User-Agent": "MusicBusinessOS-SpotifyCharts/1.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Spotify Charts oficial retornou HTTP ${response.status}.`);
  }

  const csvText = await response.text();
  const normalizedStart = csvText.trimStart().slice(0, 100).toLowerCase();

  if (
    csvText.trim().length === 0 ||
    normalizedStart.startsWith("<!doctype html") ||
    normalizedStart.startsWith("<html")
  ) {
    throw new Error("Spotify Charts oficial nao retornou um CSV valido.");
  }

  return {
    chartDate,
    csvText,
    sourceUrl,
    sourceType: "spotify_official",
  };
}

async function downloadKworbLatest(
  chart: AutomaticChart,
): Promise<DownloadedSpotifyChart> {
  if (!chart.fallbackUrl) {
    throw new Error(
      `Fallback mais recente indisponivel para ${chart.country}.`,
    );
  }

  const response = await fetch(chart.fallbackUrl, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "MusicBusinessOS-SpotifyCharts/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Kworb retornou HTTP ${response.status}.`);
  }

  const converted = convertKworbHtmlToCsv(await response.text());
  return {
    ...converted,
    sourceUrl: chart.fallbackUrl,
    sourceType: "kworb",
  };
}

export async function downloadSpotifyChartForDate(
  chart: AutomaticChart,
  chartDate: string,
): Promise<DownloadedSpotifyChart> {
  const errors: string[] = [];

  try {
    const official = await downloadOfficialChart(chart, chartDate);
    if (official) return official;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "falha oficial");
  }

  try {
    if (chart.fallbackUrl) {
      const kworb = await downloadKworbLatest(chart);
      if (kworb.chartDate === chartDate) return kworb;
      errors.push(
        `Kworb disponibiliza ${kworb.chartDate}, nao a data solicitada ${chartDate}.`,
      );
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "falha no Kworb");
  }

  throw new Error(
    `Nenhuma fonte disponivel para ${chartDate}: ${errors.join("; ")}`,
  );
}

export async function downloadLatestAvailableChart(
  chart: AutomaticChart,
): Promise<DownloadedSpotifyChart> {
  const errors: string[] = [];
  const candidateDates = getLatestCandidateDates();

  if (chart.csvUrlTemplate) {
    for (const chartDate of candidateDates) {
      try {
        const official = await downloadOfficialChart(chart, chartDate);
        if (official) return official;
      } catch (error) {
        errors.push(
          `${chartDate}: ${error instanceof Error ? error.message : "falha oficial"}`,
        );
      }
    }
  }

  try {
    if (chart.fallbackUrl) {
      const kworb = await downloadKworbLatest(chart);
      if (candidateDates.includes(kworb.chartDate)) return kworb;
      errors.push(
        `Kworb disponibiliza ${kworb.chartDate}, fora da janela de hoje, ontem ou anteontem.`,
      );
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "falha no Kworb");
  }

  throw new Error(
    `Nenhum chart disponivel para hoje, ontem ou anteontem (${errors.join(" | ")}).`,
  );
}
