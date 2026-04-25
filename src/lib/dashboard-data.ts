import "server-only";

import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type {
  ChannelDatum,
  ConversionDatum,
  DashboardData,
  DashboardMetric,
  PlaylistActivityDatum,
  PlaylistRecord,
  ScoreBreakdown,
} from "@/types/dashboard";
import { fetchPlaylistsFromSupabase, updatePlaylistInSupabase } from "./supabase-rest";
import {
  calculatePlaylistScore,
  extractSpotifyPlaylistId,
  fetchSpotifyPlaylistMetadata,
} from "./spotify";

type PlaylistRow = {
  id: string | number | null;
  created_at: string | null;
  url: string | null;
  name: string | null;
  followers: number | string | null;
  tracks: number | string | null;
  score: number | string | null;
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

function toDate(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function ratio(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 1 : 0;
  }

  return (current - previous) / previous;
}

function normalizePlaylists(rows: PlaylistRow[]): PlaylistRecord[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? index),
    createdAt: row.created_at,
    url: row.url?.trim() || "#",
    name: row.name?.trim() || "Playlist sem nome",
    coverUrl: null,
    followers: toNumber(row.followers),
    tracks: toNumber(row.tracks),
    score: toNumber(row.score),
  }));
}

async function enrichPlaylists(playlists: PlaylistRecord[]) {
  return Promise.all(
    playlists.map(async (playlist) => {
      const playlistId = extractSpotifyPlaylistId(playlist.url);

      if (!playlistId) {
        const score =
          playlist.score > 0
            ? playlist.score
            : calculatePlaylistScore({
                followers: playlist.followers,
                tracks: playlist.tracks,
              });

        return {
          ...playlist,
          score,
        };
      }

      try {
        const spotifyPlaylist = await fetchSpotifyPlaylistMetadata(playlistId);
        const score = calculatePlaylistScore({
          followers: spotifyPlaylist.followers,
          tracks: spotifyPlaylist.tracks,
        });

        const enrichedPlaylist: PlaylistRecord = {
          ...playlist,
          url: spotifyPlaylist.url,
          name: spotifyPlaylist.name,
          coverUrl: spotifyPlaylist.coverUrl,
          followers: spotifyPlaylist.followers,
          tracks: spotifyPlaylist.tracks,
          score,
        };

        const shouldPersist =
          enrichedPlaylist.url !== playlist.url ||
          enrichedPlaylist.name !== playlist.name ||
          enrichedPlaylist.followers !== playlist.followers ||
          enrichedPlaylist.tracks !== playlist.tracks ||
          enrichedPlaylist.score !== playlist.score;

        if (shouldPersist) {
          await updatePlaylistInSupabase(playlist.id, {
            url: enrichedPlaylist.url,
            name: enrichedPlaylist.name,
            followers: enrichedPlaylist.followers,
            tracks: enrichedPlaylist.tracks,
            score: enrichedPlaylist.score,
          }).catch(() => undefined);
        }

        return enrichedPlaylist;
      } catch {
        const score =
          playlist.score > 0
            ? playlist.score
            : calculatePlaylistScore({
                followers: playlist.followers,
                tracks: playlist.tracks,
              });

        return {
          ...playlist,
          score,
        };
      }
    }),
  );
}

function buildMetrics(playlists: PlaylistRecord[]): DashboardMetric[] {
  const datedRows = playlists
    .map((row) => ({
      ...row,
      createdDate: toDate(row.createdAt),
    }))
    .filter(
      (
        row,
      ): row is PlaylistRow & {
        createdDate: Date;
      } => Boolean(row.createdDate),
    );

  const referenceDate =
    [...datedRows].sort(
      (left, right) => right.createdDate.getTime() - left.createdDate.getTime(),
    )[0]?.createdDate ?? new Date();

  const currentStart = startOfMonth(referenceDate);
  const currentEnd = endOfMonth(referenceDate);
  const previousDate = subMonths(referenceDate, 1);
  const previousStart = startOfMonth(previousDate);
  const previousEnd = endOfMonth(previousDate);

  const currentRows = datedRows.filter(
    (row) => row.createdDate >= currentStart && row.createdDate <= currentEnd,
  );
  const previousRows = datedRows.filter(
    (row) => row.createdDate >= previousStart && row.createdDate <= previousEnd,
  );

  const totalFollowersCurrent = currentRows.reduce(
    (sum, row) => sum + row.followers,
    0,
  );
  const totalFollowersPrevious = previousRows.reduce(
    (sum, row) => sum + row.followers,
    0,
  );
  const averageTracksCurrent =
    currentRows.length > 0
      ? currentRows.reduce((sum, row) => sum + row.tracks, 0) / currentRows.length
      : 0;
  const averageTracksPrevious =
    previousRows.length > 0
      ? previousRows.reduce((sum, row) => sum + row.tracks, 0) /
        previousRows.length
      : 0;
  const bestScoreCurrent = currentRows.reduce(
    (maxValue, row) => Math.max(maxValue, row.score),
    0,
  );
  const bestScorePrevious = previousRows.reduce(
    (maxValue, row) => Math.max(maxValue, row.score),
    0,
  );

  return [
    {
      title: "Total Playlists",
      value: formatCount(currentRows.length),
      change: ratio(currentRows.length, previousRows.length),
    },
    {
      title: "Total Followers",
      value: formatCount(totalFollowersCurrent),
      change: ratio(totalFollowersCurrent, totalFollowersPrevious),
    },
    {
      title: "Average Tracks",
      value: formatDecimal(averageTracksCurrent),
      change: ratio(averageTracksCurrent, averageTracksPrevious),
    },
    {
      title: "Best Score",
      value: formatCount(bestScoreCurrent),
      change: ratio(bestScoreCurrent, bestScorePrevious),
    },
  ];
}

function buildPlaylistActivity(playlists: PlaylistRecord[]): PlaylistActivityDatum[] {
  const byDay = new Map<string, PlaylistActivityDatum>();

  for (const row of playlists) {
    const createdDate = toDate(row.createdAt);

    if (!createdDate) {
      continue;
    }

    const dateKey = format(createdDate, "yyyy-MM-dd");
    const entry = byDay.get(dateKey) ?? { date: dateKey, created: 0, scored: 0 };
    entry.created += 1;
    entry.scored += row.score > 0 ? 1 : 0;
    byDay.set(dateKey, entry);
  }

  return Array.from(byDay.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function buildTopFollowers(playlists: PlaylistRecord[]): ConversionDatum[] {
  return playlists
    .map((playlist) => ({
      name: playlist.name,
      value: playlist.followers,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
}

function buildScoreDistribution(playlists: PlaylistRecord[]): ChannelDatum[] {
  const buckets = [
    { type: "High Score", value: 0 },
    { type: "Medium Score", value: 0 },
    { type: "Low Score", value: 0 },
  ];

  for (const playlist of playlists) {
    if (playlist.score >= 80) {
      buckets[0].value += 1;
    } else if (playlist.score >= 50) {
      buckets[1].value += 1;
    } else {
      buckets[2].value += 1;
    }
  }

  return buckets;
}

function buildScoreHealth(playlists: PlaylistRecord[]): {
  scoreHealth: ScoreBreakdown;
  playlistCount: number;
} {
  let positive = 0;
  let neutral = 0;
  let negative = 0;

  for (const playlist of playlists) {
    if (playlist.score >= 80) {
      positive += 1;
    } else if (playlist.score >= 50) {
      neutral += 1;
    } else {
      negative += 1;
    }
  }

  const playlistCount = playlists.length;
  const safeTotal = playlistCount || 1;

  return {
    scoreHealth: {
      positive: positive / safeTotal,
      neutral: neutral / safeTotal,
      negative: negative / safeTotal,
    },
    playlistCount,
  };
}

function emptyDashboardData(): DashboardData {
  return {
    metrics: [
      { title: "Total Playlists", value: "0", change: 0 },
      { title: "Total Followers", value: "0", change: 0 },
      { title: "Average Tracks", value: "0.0", change: 0 },
      { title: "Best Score", value: "0", change: 0 },
    ],
    playlistActivity: [],
    topFollowers: [],
    scoreDistribution: [],
    scoreHealth: {
      positive: 0,
      neutral: 0,
      negative: 0,
    },
    playlistCount: 0,
    playlists: [],
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const rows = (await fetchPlaylistsFromSupabase()) as PlaylistRow[];
    const playlists = normalizePlaylists(rows);
    const enrichedPlaylists = await enrichPlaylists(playlists);
    const scoreHealth = buildScoreHealth(enrichedPlaylists);

    return {
      metrics: buildMetrics(enrichedPlaylists),
      playlistActivity: buildPlaylistActivity(enrichedPlaylists),
      topFollowers: buildTopFollowers(enrichedPlaylists),
      scoreDistribution: buildScoreDistribution(enrichedPlaylists),
      scoreHealth: scoreHealth.scoreHealth,
      playlistCount: scoreHealth.playlistCount,
      playlists: enrichedPlaylists,
    };
  } catch {
    return emptyDashboardData();
  }
}
