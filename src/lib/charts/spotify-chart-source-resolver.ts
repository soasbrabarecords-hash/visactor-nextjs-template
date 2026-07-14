import "server-only";

export type SpotifyChartSourceMode = "latest" | "historical";
export type SpotifyChartSourceProvider =
  "csv_template" | "spotify_official_api" | "kworb_latest";

export type SpotifyChartRegionSourceDefinition = {
  regionId: string;
  sourceKey: string;
  metadataMarket: string;
  officialChartAlias: string | null;
  latestFallbackUrl: string | null;
  requiresCityValidation: boolean;
};

export type ResolvedSpotifyChartSource = {
  regionId: string;
  sourceKey: string;
  mode: SpotifyChartSourceMode;
  provider: SpotifyChartSourceProvider;
  url: string;
  authenticated: boolean;
};

const SPOTIFY_CHARTS_API_BASE_URL =
  process.env.SPOTIFY_CHARTS_API_BASE_URL?.trim() ||
  "https://charts-spotify-com-service.spotify.com/auth/v0/charts";
const SPOTIFY_ACCOUNTS_TOKEN_URL =
  process.env.SPOTIFY_ACCOUNTS_TOKEN_URL?.trim() ||
  "https://accounts.spotify.com/api/token";
const KWORB_SPOTIFY_COUNTRY_BASE_URL =
  process.env.KWORB_SPOTIFY_COUNTRY_BASE_URL?.trim() ||
  "https://kworb.net/spotify/country";

// This is the only region/source mapping in the application. Adding a future
// city means adding its database source_key (or an override here if the
// official Spotify alias differs); downloaders and workers must not own URLs.
const REGION_SOURCE_OVERRIDES: Record<
  string,
  Omit<SpotifyChartRegionSourceDefinition, "regionId">
> = {
  BR: {
    sourceKey: "br",
    metadataMarket: "BR",
    officialChartAlias: "regional-br-daily",
    latestFallbackUrl: `${KWORB_SPOTIFY_COUNTRY_BASE_URL}/br_daily.html`,
    requiresCityValidation: false,
  },
  GLOBAL: {
    sourceKey: "global",
    metadataMarket: "US",
    officialChartAlias: "regional-global-daily",
    latestFallbackUrl: `${KWORB_SPOTIFY_COUNTRY_BASE_URL}/global_daily.html`,
    requiresCityValidation: false,
  },
  "BR-SP-SAO-PAULO": {
    sourceKey: "br-sao-paulo",
    metadataMarket: "BR",
    officialChartAlias: null,
    latestFallbackUrl: null,
    requiresCityValidation: true,
  },
  "BR-RJ-RIO-DE-JANEIRO": {
    sourceKey: "br-rio-de-janeiro",
    metadataMarket: "BR",
    officialChartAlias: null,
    latestFallbackUrl: null,
    requiresCityValidation: true,
  },
  "BR-RS-PORTO-ALEGRE": {
    sourceKey: "br-porto-alegre",
    metadataMarket: "BR",
    officialChartAlias: null,
    latestFallbackUrl: null,
    requiresCityValidation: true,
  },
};

function normalizeRegionId(value: string) {
  return value.trim().toUpperCase();
}

function fallbackSourceKey(regionId: string) {
  return regionId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sourceTemplateEnvironmentVariable(sourceKey: string) {
  return `SPOTIFY_CHARTS_${sourceKey.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_CSV_URL_TEMPLATE`;
}

function readCsvTemplate(definition: SpotifyChartRegionSourceDefinition) {
  const environmentVariable = sourceTemplateEnvironmentVariable(
    definition.sourceKey,
  );

  return {
    environmentVariable,
    template: process.env[environmentVariable]?.trim() || null,
  };
}

function buildTemplateUrl(
  template: string,
  input: {
    chartDate: string;
    sourceKey: string;
    regionId: string;
  },
) {
  return template
    .replaceAll("{date}", input.chartDate)
    .replaceAll("{region}", input.sourceKey)
    .replaceAll("{region_id}", input.regionId);
}

export function getSpotifyAccountsTokenUrl() {
  return SPOTIFY_ACCOUNTS_TOKEN_URL;
}

export function buildSpotifyOfficialChartUrl(alias: string, chartDate: string) {
  return `${SPOTIFY_CHARTS_API_BASE_URL.replace(/\/+$/, "")}/${encodeURIComponent(alias)}/${encodeURIComponent(chartDate)}`;
}

export function getSpotifyChartRegionSourceDefinition(
  regionId: string,
  options: {
    sourceKey?: string | null;
    metadataMarket?: string | null;
  } = {},
): SpotifyChartRegionSourceDefinition {
  const normalizedRegionId = normalizeRegionId(regionId);
  const override = REGION_SOURCE_OVERRIDES[normalizedRegionId];

  if (override) {
    return {
      regionId: normalizedRegionId,
      ...override,
      sourceKey: options.sourceKey?.trim().toLowerCase() || override.sourceKey,
      metadataMarket:
        options.metadataMarket?.trim().toUpperCase() || override.metadataMarket,
    };
  }

  const sourceKey =
    options.sourceKey?.trim().toLowerCase() ||
    fallbackSourceKey(normalizedRegionId);

  return {
    regionId: normalizedRegionId,
    sourceKey,
    metadataMarket:
      options.metadataMarket?.trim().toUpperCase() ||
      (normalizedRegionId.startsWith("BR-") ? "BR" : "US"),
    officialChartAlias: null,
    latestFallbackUrl: null,
    requiresCityValidation: normalizedRegionId.includes("-"),
  };
}

export function getSpotifyChartSourceConfiguration(
  regionId: string,
  options: {
    sourceKey?: string | null;
    metadataMarket?: string | null;
  } = {},
) {
  const definition = getSpotifyChartRegionSourceDefinition(regionId, options);
  const template = readCsvTemplate(definition);

  return {
    definition,
    csvUrlTemplate: template.template,
    csvTemplateEnvironmentVariable: template.environmentVariable,
    csvTemplateHasDate: Boolean(template.template?.includes("{date}")),
  };
}

export function resolveSpotifyChartSources(input: {
  regionId: string;
  chartDate: string;
  mode: SpotifyChartSourceMode;
  sourceKey?: string | null;
  metadataMarket?: string | null;
}): ResolvedSpotifyChartSource[] {
  const configuration = getSpotifyChartSourceConfiguration(input.regionId, {
    sourceKey: input.sourceKey,
    metadataMarket: input.metadataMarket,
  });
  const { definition } = configuration;
  const resolved: ResolvedSpotifyChartSource[] = [];

  // BR/Global historical reads use Spotify's date-addressable API first. A
  // configured CSV remains an explicit fallback; cities currently rely on it.
  if (input.mode === "historical" && definition.officialChartAlias) {
    resolved.push({
      regionId: definition.regionId,
      sourceKey: definition.sourceKey,
      mode: input.mode,
      provider: "spotify_official_api",
      url: buildSpotifyOfficialChartUrl(
        definition.officialChartAlias,
        input.chartDate,
      ),
      authenticated: true,
    });
  }

  if (configuration.csvUrlTemplate) {
    const supportsRequestedMode =
      input.mode === "latest" || configuration.csvTemplateHasDate;

    if (supportsRequestedMode) {
      resolved.push({
        regionId: definition.regionId,
        sourceKey: definition.sourceKey,
        mode: input.mode,
        provider: "csv_template",
        url: buildTemplateUrl(configuration.csvUrlTemplate, {
          chartDate: input.chartDate,
          sourceKey: definition.sourceKey,
          regionId: definition.regionId,
        }),
        authenticated: false,
      });
    }
  }

  // The daily 10h path deliberately keeps its existing CSV -> Kworb order.
  // The authenticated API is used only for historical dates.
  if (input.mode === "latest" && definition.latestFallbackUrl) {
    resolved.push({
      regionId: definition.regionId,
      sourceKey: definition.sourceKey,
      mode: input.mode,
      provider: "kworb_latest",
      url: definition.latestFallbackUrl,
      authenticated: false,
    });
  }

  return resolved;
}

export function redactSpotifyChartSourceUrl(value: string) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";

    if (url.search) {
      url.search = "?redacted=1";
    }

    return url.toString();
  } catch {
    return "invalid-source-url";
  }
}

export function isSpotifyCityBackfillSourceValidated() {
  return process.env.SPOTIFY_CHARTS_CITY_BACKFILL_VALIDATED === "1";
}

export function getKnownSpotifyChartSourceRegionIds() {
  return Object.keys(REGION_SOURCE_OVERRIDES);
}
