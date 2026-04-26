import type { MusicSignalSource } from "@/types/music-charts";
import type { MovementType } from "@/types/workspace";
import {
  buildIntelligenceTags,
  calculateOpportunityScore,
} from "./intelligence";

export type ChartCandidate = {
  trackId: string;
  trackName: string;
  artistName: string;
  artistIds: string[];
  albumName: string;
  imageUrl: string | null;
  spotifyUrl: string;
  popularity: number;
  sourceType: MusicSignalSource;
  sourceName: string;
  sourceNames: string[];
  country: string;
  genre: string;
  scopeGenre: string;
  genreHints: string[];
  saturationCount: number;
  explicit: boolean;
};

export type MusicChartSnapshotRecord = {
  spotify_track_id: string | null;
  track_name: string | null;
  artist_name: string | null;
  artist_ids: string[] | null;
  album_name: string | null;
  image_url: string | null;
  spotify_url: string | null;
  popularity: number | string | null;
  rank_position: number | string | null;
  source_type: string | null;
  source_name: string | null;
  country: string | null;
  genre: string | null;
  saturation_count: number | string | null;
  snapshot_day: string | null;
  captured_at: string | null;
};

export type ChartMovementRecord = ChartCandidate & {
  currentRank: number;
  previousRank: number | null;
  rankChange: number | null;
  movementType: MovementType;
  popularityCurrent: number;
  popularityPrevious: number | null;
  popularityChange: number | null;
  daysOnChart: number;
  opportunityScore: number;
  intelligenceTags: string[];
  seenBefore: boolean;
  snapshotDay: string;
  calculatedAt: string;
};

export type ChartMovementContext = {
  historyDaysTracked: number;
  previousSnapshotDay: string | null;
  hasSufficientHistory: boolean;
  returningTrackCount: number;
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return 0;
}

function pickLatestSnapshot(
  rows: MusicChartSnapshotRecord[],
  snapshotDay: string,
) {
  return rows
    .filter((row) => row.snapshot_day === snapshotDay)
    .sort((left, right) =>
      (right.captured_at ?? "").localeCompare(left.captured_at ?? ""),
    )[0] ?? null;
}

export function buildChartMovements({
  currentTracks,
  snapshotRows,
  snapshotDay,
  calculatedAt,
}: {
  currentTracks: ChartCandidate[];
  snapshotRows: MusicChartSnapshotRecord[];
  snapshotDay: string;
  calculatedAt: string;
}) {
  const uniqueDays = Array.from(
    new Set(
      snapshotRows
        .map((row) => row.snapshot_day)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => right.localeCompare(left));
  const previousSnapshotDay =
    uniqueDays.find((day) => day < snapshotDay) ?? null;
  const snapshotsByTrack = new Map<string, MusicChartSnapshotRecord[]>();

  for (const row of snapshotRows) {
    const trackId = row.spotify_track_id;

    if (!trackId) {
      continue;
    }

    const trackRows = snapshotsByTrack.get(trackId);

    if (trackRows) {
      trackRows.push(row);
    } else {
      snapshotsByTrack.set(trackId, [row]);
    }
  }

  const movements = currentTracks.map((track, index) => {
    const trackSnapshots = snapshotsByTrack.get(track.trackId) ?? [];
    const previousSnapshot = previousSnapshotDay
      ? pickLatestSnapshot(trackSnapshots, previousSnapshotDay)
      : null;
    const seenBefore = trackSnapshots.some(
      (row) => Boolean(row.snapshot_day) && (row.snapshot_day ?? "") < snapshotDay,
    );
    const daysOnChart = new Set(
      trackSnapshots
        .map((row) => row.snapshot_day)
        .filter((value): value is string => Boolean(value)),
    ).size;
    const currentRank = index + 1;
    const previousRankRaw = previousSnapshot
      ? toNumber(previousSnapshot.rank_position)
      : 0;
    const previousRank = previousRankRaw > 0 ? previousRankRaw : null;
    const rankChange = previousRank === null ? null : previousRank - currentRank;
    const popularityPreviousRaw = previousSnapshot
      ? toNumber(previousSnapshot.popularity)
      : 0;
    const popularityPrevious =
      previousSnapshot && popularityPreviousRaw >= 0 ? popularityPreviousRaw : null;
    const popularityChange =
      popularityPrevious === null ? null : track.popularity - popularityPrevious;

    let movementType: MovementType;

    if (previousRank === null) {
      movementType = seenBefore ? "reentry" : "new";
    } else if (currentRank < previousRank) {
      movementType = "up";
    } else if (currentRank > previousRank) {
      movementType = "down";
    } else {
      movementType = "same";
    }

    const opportunityScore = calculateOpportunityScore({
      popularity: track.popularity,
      rankChange,
      popularityChange,
      daysOnChart: Math.max(daysOnChart, 1),
      saturationCount: Math.max(track.saturationCount, 1),
    });

    return {
      ...track,
      currentRank,
      previousRank,
      rankChange,
      movementType,
      popularityCurrent: track.popularity,
      popularityPrevious,
      popularityChange,
      daysOnChart: Math.max(daysOnChart, 1),
      opportunityScore,
      intelligenceTags: buildIntelligenceTags({
        movementType,
        popularity: track.popularity,
        rankChange,
        popularityChange,
        daysOnChart: Math.max(daysOnChart, 1),
        saturationCount: Math.max(track.saturationCount, 1),
        opportunityScore,
        multipleSources: track.sourceNames.length > 1,
        multipleGenres: track.genreHints.length > 1,
        artistExpansion: false,
      }),
      seenBefore,
      snapshotDay,
      calculatedAt,
    };
  });

  return {
    movements,
    context: {
      historyDaysTracked: uniqueDays.length,
      previousSnapshotDay,
      hasSufficientHistory: Boolean(previousSnapshotDay),
      returningTrackCount: movements.filter(
        (track) => track.movementType === "reentry",
      ).length,
    } satisfies ChartMovementContext,
  };
}
