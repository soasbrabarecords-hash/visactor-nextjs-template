import "server-only";

import type {
  ChannelDatum,
  ConversionDatum,
  DashboardMetric,
  ScoreBreakdown,
} from "@/types/dashboard";
import type { ChartsData, TrackInsight } from "@/types/charts";
import { fetchPlaylistsFromSupabase } from "./supabase-rest";
import {
  extractSpotifyPlaylistId,
  fetchSpotifyPlaylistTracks,
  type SpotifyTrackRecord,
} from "./spotify";

type AggregatedTrack = {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  popularity: number;
  playlistsCount: number;
  durationMs: number;
  explicit: boolean;
  spotifyUrl: string;
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function emptyChartsData(): ChartsData {
  return {
    metrics: [
      { title: "Analyzed Tracks", value: "0", change: 0 },
      { title: "Unique Artists", value: "0", change: 0 },
      { title: "Avg. Popularity", value: "0.0", change: 0 },
      { title: "Repeated Tracks", value: "0", change: 0 },
    ],
    topTracks: [],
    artistDistribution: [],
    popularityHealth: {
      positive: 0,
      neutral: 0,
      negative: 0,
    },
    analyzedPlaylists: 0,
    tracks: [],
    topRepeatedTrack: "No data yet",
    explicitShare: "0%",
  };
}

function aggregateTracks(trackGroups: SpotifyTrackRecord[][]) {
  const trackMap = new Map<string, AggregatedTrack>();

  for (const group of trackGroups) {
    const seenInPlaylist = new Set<string>();

    for (const track of group) {
      const existing = trackMap.get(track.id);
      const artists = track.artists.join(", ");

      if (existing) {
        existing.popularity = Math.max(existing.popularity, track.popularity);
        existing.explicit = existing.explicit || track.explicit;
      } else {
        trackMap.set(track.id, {
          id: track.id,
          name: track.name,
          artists,
          albumName: track.albumName,
          popularity: track.popularity,
          playlistsCount: 0,
          durationMs: track.durationMs,
          explicit: track.explicit,
          spotifyUrl: track.spotifyUrl,
        });
      }

      if (!seenInPlaylist.has(track.id)) {
        seenInPlaylist.add(track.id);
        const aggregated = trackMap.get(track.id);

        if (aggregated) {
          aggregated.playlistsCount += 1;
        }
      }
    }
  }

  return Array.from(trackMap.values()).sort((left, right) => {
    if (right.playlistsCount !== left.playlistsCount) {
      return right.playlistsCount - left.playlistsCount;
    }

    return right.popularity - left.popularity;
  });
}

function buildMetrics(tracks: AggregatedTrack[]): DashboardMetric[] {
  const uniqueArtists = new Set<string>();
  let popularitySum = 0;
  let repeatedTracks = 0;

  for (const track of tracks) {
    popularitySum += track.popularity;

    if (track.playlistsCount > 1) {
      repeatedTracks += 1;
    }

    for (const artist of track.artists.split(", ").filter(Boolean)) {
      uniqueArtists.add(artist);
    }
  }

  const averagePopularity =
    tracks.length > 0 ? popularitySum / tracks.length : 0;

  return [
    { title: "Analyzed Tracks", value: formatCount(tracks.length), change: 0 },
    {
      title: "Unique Artists",
      value: formatCount(uniqueArtists.size),
      change: 0,
    },
    {
      title: "Avg. Popularity",
      value: formatDecimal(averagePopularity),
      change: 0,
    },
    {
      title: "Repeated Tracks",
      value: formatCount(repeatedTracks),
      change: 0,
    },
  ];
}

function buildTopTracks(tracks: AggregatedTrack[]): ConversionDatum[] {
  return tracks.slice(0, 8).map((track) => ({
    name: track.name,
    value: track.popularity,
  }));
}

function buildArtistDistribution(tracks: AggregatedTrack[]): ChannelDatum[] {
  const artists = new Map<string, number>();

  for (const track of tracks) {
    for (const artist of track.artists.split(", ").filter(Boolean)) {
      artists.set(artist, (artists.get(artist) ?? 0) + 1);
    }
  }

  return Array.from(artists.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([type, value]) => ({ type, value }));
}

function buildPopularityHealth(tracks: AggregatedTrack[]): ScoreBreakdown {
  if (tracks.length === 0) {
    return {
      positive: 0,
      neutral: 0,
      negative: 0,
    };
  }

  let positive = 0;
  let neutral = 0;
  let negative = 0;

  for (const track of tracks) {
    if (track.popularity >= 70) {
      positive += 1;
    } else if (track.popularity >= 40) {
      neutral += 1;
    } else {
      negative += 1;
    }
  }

  return {
    positive: positive / tracks.length,
    neutral: neutral / tracks.length,
    negative: negative / tracks.length,
  };
}

function buildTrackInsights(tracks: AggregatedTrack[]): TrackInsight[] {
  return tracks.slice(0, 20).map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists,
    albumName: track.albumName,
    popularity: track.popularity,
    playlistsCount: track.playlistsCount,
    durationLabel: formatDuration(track.durationMs),
    explicit: track.explicit,
    spotifyUrl: track.spotifyUrl,
  }));
}

export async function getChartsData(): Promise<ChartsData> {
  try {
    const playlists = await fetchPlaylistsFromSupabase();

    const playlistTrackGroups = await Promise.all(
      playlists.map(async (playlist) => {
        const playlistId = extractSpotifyPlaylistId(playlist.url ?? "");

        if (!playlistId) {
          return [];
        }

        return fetchSpotifyPlaylistTracks(playlistId).catch(() => []);
      }),
    );

    const validTrackGroups = playlistTrackGroups.filter(
      (group) => group.length > 0,
    );
    const aggregatedTracks = aggregateTracks(validTrackGroups);
    const explicitTracks = aggregatedTracks.filter((track) => track.explicit);
    const topRepeatedTrack = aggregatedTracks[0]?.name ?? "No data yet";

    return {
      metrics: buildMetrics(aggregatedTracks),
      topTracks: buildTopTracks(aggregatedTracks),
      artistDistribution: buildArtistDistribution(aggregatedTracks),
      popularityHealth: buildPopularityHealth(aggregatedTracks),
      analyzedPlaylists: validTrackGroups.length,
      tracks: buildTrackInsights(aggregatedTracks),
      topRepeatedTrack,
      explicitShare:
        aggregatedTracks.length > 0
          ? `${Math.round((explicitTracks.length / aggregatedTracks.length) * 100)}%`
          : "0%",
    };
  } catch {
    return emptyChartsData();
  }
}
