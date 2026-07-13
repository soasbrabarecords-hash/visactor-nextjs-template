export type SpotifyChartRegionType = "global" | "country" | "city";

export type SpotifyChartRegion = {
  regionKey: string;
  displayName: string;
  type: SpotifyChartRegionType;
  countryCode: string | null;
  cityName: string | null;
  parentRegionKey: string | null;
  sourceKey: string;
  enabled: boolean;
  backfillEnabled: boolean;
  priority: number;
};

// This fallback is deliberately limited to the two regions the current cron
// already imports. Database availability must never be a new dependency for the
// established BR/Global ingestion path during this rollout.
export const CURRENT_AUTOMATIC_SPOTIFY_CHART_REGIONS = [
  {
    regionKey: "BR",
    displayName: "Brasil",
    type: "country",
    countryCode: "BR",
    cityName: null,
    parentRegionKey: null,
    sourceKey: "br",
    enabled: true,
    backfillEnabled: true,
    priority: 10,
  },
  {
    regionKey: "GLOBAL",
    displayName: "Global",
    type: "global",
    countryCode: null,
    cityName: null,
    parentRegionKey: null,
    sourceKey: "global",
    enabled: true,
    backfillEnabled: true,
    priority: 20,
  },
] as const satisfies readonly SpotifyChartRegion[];

export function normalizeSpotifyChartRegionKey(value: string) {
  return value.trim().toUpperCase();
}

export function resolveSpotifyChartMarket(region: SpotifyChartRegion) {
  return region.countryCode ?? "US";
}

export function getCurrentAutomaticSpotifyChartRegionKeys() {
  return CURRENT_AUTOMATIC_SPOTIFY_CHART_REGIONS.map(
    (region) => region.regionKey,
  );
}
