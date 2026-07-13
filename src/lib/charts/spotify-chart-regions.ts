import "server-only";
import {
  CURRENT_AUTOMATIC_SPOTIFY_CHART_REGIONS,
  type SpotifyChartRegion,
  type SpotifyChartRegionType,
  normalizeSpotifyChartRegionKey,
} from "@/lib/charts/spotify-chart-region-catalog";
import { createAdminClient } from "@/lib/supabase/admin";

type SpotifyChartRegionRow = {
  region_key: string;
  display_name: string;
  type: SpotifyChartRegionType;
  country_code: string | null;
  city_name: string | null;
  parent_region_key: string | null;
  source_key: string;
  enabled: boolean;
  backfill_enabled: boolean;
  priority: number;
};

export type SpotifyChartRegionFilter = {
  enabledOnly?: boolean;
  backfillOnly?: boolean;
};

function mapSpotifyChartRegion(row: SpotifyChartRegionRow): SpotifyChartRegion {
  return {
    regionKey: normalizeSpotifyChartRegionKey(row.region_key),
    displayName: row.display_name,
    type: row.type,
    countryCode: row.country_code?.trim().toUpperCase() || null,
    cityName: row.city_name,
    parentRegionKey: row.parent_region_key
      ? normalizeSpotifyChartRegionKey(row.parent_region_key)
      : null,
    sourceKey: row.source_key,
    enabled: row.enabled,
    backfillEnabled: row.backfill_enabled,
    priority: row.priority,
  };
}

function filterFallbackRegions(filter: SpotifyChartRegionFilter) {
  return CURRENT_AUTOMATIC_SPOTIFY_CHART_REGIONS.filter((region) => {
    if (filter.enabledOnly && !region.enabled) return false;
    if (filter.backfillOnly && !region.backfillEnabled) return false;
    return true;
  });
}

export async function getSpotifyChartRegions(
  filter: SpotifyChartRegionFilter = {},
): Promise<SpotifyChartRegion[]> {
  const admin = createAdminClient();

  if (!admin) {
    return [...filterFallbackRegions(filter)];
  }

  let query = admin
    .from("spotify_chart_regions")
    .select(
      "region_key,display_name,type,country_code,city_name,parent_region_key,source_key,enabled,backfill_enabled,priority",
    )
    .order("priority", { ascending: true })
    .order("region_key", { ascending: true });

  if (filter.enabledOnly) {
    query = query.eq("enabled", true);
  }

  if (filter.backfillOnly) {
    query = query.eq("backfill_enabled", true);
  }

  const { data, error } = await query;

  if (error) {
    return [...filterFallbackRegions(filter)];
  }

  return ((data ?? []) as SpotifyChartRegionRow[]).map(mapSpotifyChartRegion);
}

export async function getSpotifyChartRegion(regionKey: string) {
  const normalizedKey = normalizeSpotifyChartRegionKey(regionKey);
  const regions = await getSpotifyChartRegions();

  return regions.find((region) => region.regionKey === normalizedKey) ?? null;
}
