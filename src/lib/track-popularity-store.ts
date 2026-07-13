import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PopularitySource = {
  table: string;
  trackIdColumn: string;
  popularityColumn: string;
  timestampColumn: string;
};

type PopularityCandidate = {
  popularity: number;
  capturedAt: number;
};

const POPULARITY_SOURCES: PopularitySource[] = [
  {
    table: "playlist_track_snapshots",
    trackIdColumn: "track_id",
    popularityColumn: "popularity",
    timestampColumn: "captured_at",
  },
  {
    table: "music_chart_snapshots",
    trackIdColumn: "spotify_track_id",
    popularityColumn: "popularity",
    timestampColumn: "captured_at",
  },
  {
    table: "music_track_snapshots",
    trackIdColumn: "track_id",
    popularityColumn: "popularity",
    timestampColumn: "captured_at",
  },
  {
    table: "music_chart_movements",
    trackIdColumn: "spotify_track_id",
    popularityColumn: "popularity_current",
    timestampColumn: "calculated_at",
  },
];

function toPopularity(value: unknown) {
  const popularity = Number(value);

  if (!Number.isFinite(popularity) || popularity <= 0) {
    return null;
  }

  return Math.min(100, Math.round(popularity));
}

export async function fetchStoredTrackPopularities(trackIds: string[]) {
  const uniqueTrackIds = Array.from(
    new Set(trackIds.map((trackId) => trackId.trim()).filter(Boolean)),
  );

  if (uniqueTrackIds.length === 0) {
    return new Map<string, number>();
  }

  const candidates = new Map<string, PopularityCandidate>();
  let client;

  try {
    client = createAdminClient() ?? await createClient();
  } catch {
    return new Map<string, number>();
  }

  await Promise.all(
    POPULARITY_SOURCES.map(async (source) => {
      try {
        const columns = [
          source.trackIdColumn,
          source.popularityColumn,
          source.timestampColumn,
        ].join(",");
        const { data, error } = await client
          .from(source.table)
          .select(columns)
          .in(source.trackIdColumn, uniqueTrackIds)
          .gt(source.popularityColumn, 0)
          .order(source.timestampColumn, { ascending: false })
          .limit(5000);

        if (error || !Array.isArray(data)) {
          return;
        }

        for (const rawRow of data) {
          const row = rawRow as unknown as Record<string, unknown>;
          const trackId = String(row[source.trackIdColumn] ?? "").trim();
          const popularity = toPopularity(row[source.popularityColumn]);

          if (!trackId || popularity === null) {
            continue;
          }

          const parsedTimestamp = Date.parse(
            String(row[source.timestampColumn] ?? ""),
          );
          const capturedAt = Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0;
          const current = candidates.get(trackId);

          if (!current || capturedAt > current.capturedAt) {
            candidates.set(trackId, { popularity, capturedAt });
          }
        }
      } catch {
        // Snapshot enrichment is optional and must never block playlist loading.
        return;
      }
    }),
  );

  return new Map(
    Array.from(candidates, ([trackId, candidate]) => [
      trackId,
      candidate.popularity,
    ]),
  );
}
