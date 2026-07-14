import "server-only";
import { CURRENT_AUTOMATIC_SPOTIFY_CHART_REGIONS } from "@/lib/charts/spotify-chart-region-catalog";
import {
  getSpotifyChartsServiceAccessToken,
  isSpotifyChartsServiceWorkspaceConfigured,
} from "@/lib/charts/spotify-chart-service-auth";
import {
  type ResolvedSpotifyChartSource,
  type SpotifyChartSourceProvider,
  getKnownSpotifyChartSourceRegionIds,
  getSpotifyChartRegionSourceDefinition,
  getSpotifyChartSourceConfiguration,
  isSpotifyCityBackfillSourceValidated,
  redactSpotifyChartSourceUrl,
  resolveSpotifyChartSources,
} from "@/lib/charts/spotify-chart-source-resolver";

export type SpotifyChartSourceType = "spotify_official" | "kworb";

export type AutomaticChart = {
  chartType: string;
  country: string;
  metadataMarket: string;
  sourceKey: string;
  csvUrlTemplate: string | null;
  fallbackUrl: string | null;
  officialChartAlias: string | null;
};

export type DownloadedSpotifyChart = {
  chartDate: string;
  csvText: string;
  sourceUrl: string;
  sourceType: SpotifyChartSourceType;
  sourceProvider: SpotifyChartSourceProvider;
  httpStatus: number;
  contentType: string | null;
  bytes: number;
  durationMs: number;
};

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const SOURCE_TIMEOUT_MS = 15_000;

export type SpotifyChartSourceAttempt = {
  provider: SpotifyChartSourceProvider;
  url: string;
  responseReceived: boolean;
  httpStatus: number | null;
  error: string;
};

class SpotifyChartSourceFetchError extends Error {
  readonly responseReceived: boolean;
  readonly httpStatus: number | null;

  constructor(
    message: string,
    input: { responseReceived: boolean; httpStatus: number | null },
  ) {
    super(message);
    this.name = "SpotifyChartSourceFetchError";
    this.responseReceived = input.responseReceived;
    this.httpStatus = input.httpStatus;
  }
}

export class SpotifyChartSourceDownloadError extends Error {
  readonly attempts: SpotifyChartSourceAttempt[];

  constructor(message: string, attempts: SpotifyChartSourceAttempt[]) {
    super(message);
    this.name = "SpotifyChartSourceDownloadError";
    this.attempts = attempts;
  }
}

type SpotifyChartRegionSourceOptions = {
  sourceKey?: string | null;
  metadataMarket?: string | null;
};

function mapHistoricalChart(
  regionId: string,
  options: SpotifyChartRegionSourceOptions = {},
): AutomaticChart {
  const configuration = getSpotifyChartSourceConfiguration(regionId, options);
  const { definition } = configuration;

  return {
    chartType: "top-songs",
    country: definition.regionId,
    metadataMarket: definition.metadataMarket,
    sourceKey: definition.sourceKey,
    csvUrlTemplate: configuration.csvUrlTemplate,
    fallbackUrl: definition.latestFallbackUrl,
    officialChartAlias: definition.officialChartAlias,
  };
}

export function getAutomaticCharts(): AutomaticChart[] {
  return CURRENT_AUTOMATIC_SPOTIFY_CHART_REGIONS.map((region) =>
    mapHistoricalChart(region.regionKey),
  );
}

export function getHistoricalSpotifyChartSourceReadiness(
  regionIds: readonly string[] = getKnownSpotifyChartSourceRegionIds(),
) {
  return regionIds.map((regionId) =>
    getHistoricalSpotifyChartRegionSourceReadiness(regionId),
  );
}

function getHistoricalSpotifyChartRegionSourceReadiness(
  regionId: string,
  options: SpotifyChartRegionSourceOptions = {},
) {
  const normalizedRegionId = regionId.trim().toUpperCase();
  const configuration = getSpotifyChartSourceConfiguration(
    normalizedRegionId,
    options,
  );
  const hasHistoricalTemplate = configuration.csvTemplateHasDate;
  const hasOfficialHistoricalApiDefinition = Boolean(
    configuration.definition.officialChartAlias,
  );
  const hasOfficialHistoricalApi =
    hasOfficialHistoricalApiDefinition &&
    isSpotifyChartsServiceWorkspaceConfigured();
  const citySourceValidated =
    !configuration.definition.requiresCityValidation ||
    isSpotifyCityBackfillSourceValidated();
  const supportsHistoricalDates =
    citySourceValidated && (hasHistoricalTemplate || hasOfficialHistoricalApi);

  return {
    regionId: normalizedRegionId,
    supportsHistoricalDates,
    provider: hasOfficialHistoricalApi
      ? ("spotify_official_api" as const)
      : hasHistoricalTemplate
        ? ("csv_template" as const)
        : null,
    requiredEnvironmentVariable: supportsHistoricalDates
      ? null
      : hasOfficialHistoricalApiDefinition
        ? "SPOTIFY_CHARTS_SOURCE_WORKSPACE_ID"
        : configuration.csvTemplateEnvironmentVariable,
    reason:
      configuration.definition.requiresCityValidation && !citySourceValidated
        ? "historical_city_source_not_validated"
        : supportsHistoricalDates
          ? null
          : hasOfficialHistoricalApiDefinition && !hasOfficialHistoricalApi
            ? "historical_service_workspace_not_configured"
            : configuration.csvUrlTemplate
              ? "template_missing_date_placeholder"
              : "historical_source_not_configured",
  };
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

export function getBackfillChart(
  country: string,
  chartType: string,
  options: SpotifyChartRegionSourceOptions = {},
) {
  const normalizedCountry = country.trim().toUpperCase();
  const normalizedChartType = chartType.trim().toLowerCase();

  if (normalizedChartType !== "top-songs") return null;

  const readiness = getHistoricalSpotifyChartRegionSourceReadiness(
    normalizedCountry,
    options,
  );

  return readiness?.supportsHistoricalDates
    ? mapHistoricalChart(normalizedCountry, options)
    : null;
}

export function getBackfillChartRegionKeys() {
  return getKnownSpotifyChartSourceRegionIds();
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

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
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
      "chart_date",
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
        chartDate,
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

type SpotifyOfficialChartPayload = {
  date?: string;
  displayChart?: { date?: string };
  entries?: Array<{
    chartEntryData?: {
      currentRank?: number;
      previousRank?: number;
      rankingMetric?: { value?: number | string };
    };
    trackMetadata?: {
      trackName?: string;
      trackUri?: string;
      displayImageUri?: string;
      artists?: Array<{ name?: string; spotifyUri?: string }>;
    };
    albumMetadata?: { albumName?: string };
  }>;
};

function convertSpotifyOfficialJsonToCsv(
  payload: SpotifyOfficialChartPayload,
  requestedDate: string,
) {
  const responseDate =
    payload.displayChart?.date?.slice(0, 10) || payload.date?.slice(0, 10);

  if (!responseDate) {
    throw new Error(
      "Spotify Charts nao informou a data do snapshot na resposta.",
    );
  }

  if (responseDate !== requestedDate) {
    throw new Error(
      `Spotify Charts retornou ${responseDate}, nao ${requestedDate}.`,
    );
  }

  const csvRows = [
    [
      "chart_date",
      "rank",
      "previous_rank",
      "track_name",
      "artist_names",
      "spotify_track_uri",
      "streams",
      "image_url",
      "album_name",
      "source_type",
    ]
      .map(csvCell)
      .join(","),
  ];

  for (const entry of payload.entries ?? []) {
    const rank = entry.chartEntryData?.currentRank;
    const trackName = entry.trackMetadata?.trackName?.trim();
    const trackUri = entry.trackMetadata?.trackUri?.trim();
    const artistNames = (entry.trackMetadata?.artists ?? [])
      .map((artist) => artist.name?.trim())
      .filter((name): name is string => Boolean(name));

    if (!rank || !trackName || !trackUri || artistNames.length === 0) {
      continue;
    }

    csvRows.push(
      [
        responseDate,
        rank,
        entry.chartEntryData?.previousRank ?? null,
        trackName,
        artistNames.join(", "),
        trackUri,
        entry.chartEntryData?.rankingMetric?.value ?? null,
        entry.trackMetadata?.displayImageUri ?? null,
        entry.albumMetadata?.albumName ?? null,
        "spotify_official",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  if (csvRows.length === 1) {
    throw new Error("Spotify Charts oficial nao retornou faixas validas.");
  }

  return { chartDate: responseDate, csvText: csvRows.join("\n") };
}

async function readResponseText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);

  if (declaredLength > MAX_SOURCE_BYTES) {
    throw new Error("A fonte excedeu o limite de 5 MB.");
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let completed = false;

  while (!completed) {
    const { value, done } = await reader.read();
    completed = done;
    if (done) continue;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("A fonte excedeu o limite de 5 MB.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

async function fetchResolvedSource(
  source: ResolvedSpotifyChartSource,
  chartDate: string,
): Promise<DownloadedSpotifyChart> {
  const startedAt = Date.now();
  const headers: Record<string, string> = {
    "User-Agent": "MusicBusinessOS-SpotifyCharts/1.0",
  };

  if (source.provider === "spotify_official_api") {
    headers.Accept = "application/json";
    headers.Authorization = `Bearer ${await getSpotifyChartsServiceAccessToken()}`;
  } else if (source.provider === "kworb_latest") {
    headers.Accept = "text/html,application/xhtml+xml";
  } else {
    headers.Accept = "text/csv,text/plain;q=0.9,*/*;q=0.1";
  }

  const response = await fetch(source.url, {
    cache: "no-store",
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
  });
  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    throw new SpotifyChartSourceFetchError(
      `${source.provider} retornou HTTP ${response.status} para ${chartDate}.`,
      { responseReceived: true, httpStatus: response.status },
    );
  }

  try {
    const responseText = await readResponseText(response);
    let converted: { chartDate: string; csvText: string };
    let sourceType: SpotifyChartSourceType;

    if (source.provider === "spotify_official_api") {
      const payload = JSON.parse(responseText) as SpotifyOfficialChartPayload;
      converted = convertSpotifyOfficialJsonToCsv(payload, chartDate);
      sourceType = "spotify_official";
    } else if (source.provider === "kworb_latest") {
      converted = convertKworbHtmlToCsv(responseText);
      sourceType = "kworb";
    } else {
      const normalizedStart = responseText
        .trimStart()
        .slice(0, 100)
        .toLowerCase();

      if (
        responseText.trim().length === 0 ||
        normalizedStart.startsWith("<!doctype html") ||
        normalizedStart.startsWith("<html")
      ) {
        throw new Error("A fonte configurada nao retornou um CSV valido.");
      }

      converted = { chartDate, csvText: responseText };
      sourceType = "spotify_official";
    }

    return {
      ...converted,
      sourceUrl: response.url || source.url,
      sourceType,
      sourceProvider: source.provider,
      httpStatus: response.status,
      contentType,
      bytes: new TextEncoder().encode(responseText).byteLength,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof SpotifyChartSourceFetchError) throw error;

    throw new SpotifyChartSourceFetchError(
      error instanceof Error
        ? error.message
        : "A resposta da fonte historica nao pode ser interpretada.",
      { responseReceived: true, httpStatus: response.status },
    );
  }
}

export async function downloadResolvedSpotifyChartSource(input: {
  regionId: string;
  chartDate: string;
  mode: "latest" | "historical";
  provider?: SpotifyChartSourceProvider;
  sourceKey?: string | null;
  metadataMarket?: string | null;
}) {
  const candidates = resolveSpotifyChartSources(input).filter(
    (candidate) => !input.provider || candidate.provider === input.provider,
  );
  const errors: string[] = [];
  const attempts: SpotifyChartSourceAttempt[] = [];

  for (const candidate of candidates) {
    try {
      return await fetchResolvedSource(candidate, input.chartDate);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "falha desconhecida";
      errors.push(`${candidate.provider}: ${message}`);
      attempts.push({
        provider: candidate.provider,
        url: redactSpotifyChartSourceUrl(candidate.url),
        responseReceived:
          error instanceof SpotifyChartSourceFetchError
            ? error.responseReceived
            : false,
        httpStatus:
          error instanceof SpotifyChartSourceFetchError
            ? error.httpStatus
            : null,
        error: message,
      });
    }
  }

  throw new SpotifyChartSourceDownloadError(
    `Nenhuma fonte ${input.mode} disponivel para ${input.regionId}/${input.chartDate}: ${errors.length > 0 ? errors.join("; ") : "fonte nao configurada"}`,
    attempts,
  );
}

export async function downloadSpotifyChartForDate(
  chart: AutomaticChart,
  chartDate: string,
): Promise<DownloadedSpotifyChart> {
  return downloadResolvedSpotifyChartSource({
    regionId: chart.country,
    chartDate,
    mode: "historical",
    sourceKey: chart.sourceKey,
    metadataMarket: chart.metadataMarket,
  });
}

export async function downloadLatestAvailableChart(
  chart: AutomaticChart,
): Promise<DownloadedSpotifyChart> {
  const errors: string[] = [];
  const candidateDates = getLatestCandidateDates();

  for (const chartDate of candidateDates) {
    try {
      const sources = resolveSpotifyChartSources({
        regionId: chart.country,
        chartDate,
        mode: "latest",
      });
      const csvSource = sources.find(
        (source) => source.provider === "csv_template",
      );

      if (csvSource) {
        return await fetchResolvedSource(csvSource, chartDate);
      }
    } catch (error) {
      errors.push(
        `${chartDate}: ${error instanceof Error ? error.message : "falha CSV"}`,
      );
    }
  }

  try {
    const latestDate = candidateDates[0];
    const kworbSource = resolveSpotifyChartSources({
      regionId: chart.country,
      chartDate: latestDate,
      mode: "latest",
    }).find((source) => source.provider === "kworb_latest");

    if (kworbSource) {
      const kworb = await fetchResolvedSource(kworbSource, latestDate);
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

export function getSpotifyChartMetadataMarket(regionId: string) {
  return getSpotifyChartRegionSourceDefinition(regionId).metadataMarket;
}
