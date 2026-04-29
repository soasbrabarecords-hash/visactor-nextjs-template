import "server-only";

import type {
  ChannelDatum,
  ConversionDatum,
  DashboardMetric,
  ScoreBreakdown,
} from "@/types/dashboard";
import type {
  ChartsData,
  FeaturedPlaylistInsight,
  TrackInsight,
} from "@/types/charts";
import { fetchPlaylistsFromSupabase } from "./supabase-rest";
import {
  extractSpotifyPlaylistId,
  fetchArtistTopTracks,
  fetchFeaturedPlaylists,
  fetchSpotifyPlaylistTracks,
  type SpotifyFeaturedPlaylist,
  type SpotifyTrackRecord,
} from "./spotify";

type AggregatedTrack = {
  id: string;
  name: string;
  artists: string;
  artistIds: string[];
  albumName: string;
  popularity: number;
  playlistsCount: number;
  durationMs: number;
  explicit: boolean;
  spotifyUrl: string;
  coverUrl: string | null;
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
      { title: "Radar Tracks", value: "0", change: 0 },
      { title: "Mercado Agora", value: "0", change: 0 },
      { title: "Shared Momentum", value: "0", change: 0 },
      { title: "Avg. Popularity", value: "0.0", change: 0 },
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
    marketTracks: [],
    featuredPlaylists: [],
    topRepeatedTrack: "No data yet",
    explicitShare: "0%",
    marketHighlight: "Sem leitura de mercado ainda.",
    sharedMomentumCount: 0,
  };
}

function aggregateTracks(trackGroups: SpotifyTrackRecord[][]): AggregatedTrack[] {
  const trackMap = new Map<string, AggregatedTrack>();

  for (const group of trackGroups) {
    const seenInGroup = new Set<string>();

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
          artistIds: track.artistIds,
          albumName: track.albumName,
          popularity: track.popularity,
          playlistsCount: 0,
          durationMs: track.durationMs,
          explicit: track.explicit,
          spotifyUrl: track.spotifyUrl,
          coverUrl: track.coverUrl,
        });
      }

      if (!seenInGroup.has(track.id)) {
        seenInGroup.add(track.id);
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

function buildMetrics(
  radarTracks: AggregatedTrack[],
  marketTracks: AggregatedTrack[],
): DashboardMetric[] {
  const averagePopularity =
    radarTracks.length > 0
      ? radarTracks.reduce((sum, track) => sum + track.popularity, 0) /
        radarTracks.length
      : 0;

  const radarIds = new Set(radarTracks.map((track) => track.id));
  const sharedMomentumCount = marketTracks.filter((track) =>
    radarIds.has(track.id),
  ).length;

  return [
    {
      title: "Radar Tracks",
      value: formatCount(radarTracks.length),
      change: 0,
    },
    {
      title: "Mercado Agora",
      value: formatCount(marketTracks.length),
      change: 0,
    },
    {
      title: "Shared Momentum",
      value: formatCount(sharedMomentumCount),
      change: 0,
    },
    {
      title: "Avg. Popularity",
      value: formatDecimal(averagePopularity),
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
    artistIds: track.artistIds,
    albumName: track.albumName,
    popularity: track.popularity,
    playlistsCount: track.playlistsCount,
    durationLabel: formatDuration(track.durationMs),
    explicit: track.explicit,
    spotifyUrl: track.spotifyUrl,
    coverUrl: track.coverUrl,
  }));
}

function buildFeaturedPlaylistInsights(
  playlists: SpotifyFeaturedPlaylist[],
): FeaturedPlaylistInsight[] {
  return playlists.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    coverUrl: playlist.coverUrl,
    spotifyUrl: playlist.spotifyUrl,
    tracksTotal: playlist.tracksTotal,
  }));
}

function buildMarketHighlight(
  featuredPlaylists: FeaturedPlaylistInsight[],
  sharedMomentumCount: number,
) {
  if (featuredPlaylists.length === 0) {
    return "Sem leitura de mercado ainda.";
  }

  if (sharedMomentumCount > 0) {
    return `${sharedMomentumCount} faixas do seu radar tambem aparecem no mercado em destaque.`;
  }

  return `As playlists destaque ${featuredPlaylists[0]?.name ? `como ${featuredPlaylists[0].name}` : "do momento"} ainda nao cruzaram com o seu radar.`;
}

async function loadPlaylistTrackGroups() {
  const playlists = await fetchPlaylistsFromSupabase();
  const spotifyPlaylists = playlists.filter((playlist) =>
    Boolean(extractSpotifyPlaylistId(playlist.url ?? "")),
  );

  const trackGroups = await Promise.all(
    spotifyPlaylists.map(async (playlist) => {
      const playlistId = extractSpotifyPlaylistId(playlist.url ?? "");

      if (!playlistId) {
        return [];
      }

      try {
        return await fetchSpotifyPlaylistTracks(playlistId);
      } catch {
        return [];
      }
    }),
  );

  return {
    analyzedPlaylists: spotifyPlaylists.length,
    trackGroups: trackGroups.filter((group) => group.length > 0),
  };
}

async function loadMarketTrackGroups() {
  try {
    const featuredPlaylists = await fetchFeaturedPlaylists("BR", 6);
    const trackGroups = await Promise.all(
      featuredPlaylists.map(async (playlist) => {
        try {
          return await fetchSpotifyPlaylistTracks(playlist.id);
        } catch {
          return [];
        }
      }),
    );

    return {
      featuredPlaylists: buildFeaturedPlaylistInsights(featuredPlaylists),
      trackGroups: trackGroups.filter((group) => group.length > 0),
    };
  } catch {
    return {
      featuredPlaylists: [] as FeaturedPlaylistInsight[],
      trackGroups: [] as SpotifyTrackRecord[][],
    };
  }
}

export async function getChartsData(): Promise<ChartsData> {
  try {
    const [{ analyzedPlaylists, trackGroups }, marketData] = await Promise.all([
      loadPlaylistTrackGroups(),
      loadMarketTrackGroups(),
    ]);

    const radarTracks = aggregateTracks(trackGroups);
    const marketTracks = aggregateTracks(marketData.trackGroups);
    const radarTrackInsights = buildTrackInsights(radarTracks);
    const marketTrackInsights = buildTrackInsights(marketTracks);
    const explicitTracks = radarTracks.filter((track) => track.explicit);
    const topRepeatedTrack = radarTracks[0]?.name ?? "No data yet";
    const radarIds = new Set(radarTracks.map((track) => track.id));
    const sharedMomentumCount = marketTracks.filter((track) =>
      radarIds.has(track.id),
    ).length;

    return {
      metrics: buildMetrics(radarTracks, marketTracks),
      topTracks: buildTopTracks(radarTracks),
      artistDistribution: buildArtistDistribution(radarTracks),
      popularityHealth: buildPopularityHealth(radarTracks),
      analyzedPlaylists,
      tracks: radarTrackInsights,
      marketTracks: marketTrackInsights,
      featuredPlaylists: marketData.featuredPlaylists,
      topRepeatedTrack,
      explicitShare:
        radarTracks.length > 0
          ? `${Math.round((explicitTracks.length / radarTracks.length) * 100)}%`
          : "0%",
      marketHighlight: buildMarketHighlight(
        marketData.featuredPlaylists,
        sharedMomentumCount,
      ),
      sharedMomentumCount,
    };
  } catch {
    return emptyChartsData();
  }
}

export async function getRelatedTrackSuggestions(
  seedTracks: TrackInsight[],
  excludedTrackIds: string[],
): Promise<TrackInsight[]> {
  const excludedIds = new Set(excludedTrackIds);
  const artistFrequency = new Map<string, number>();

  for (const track of seedTracks) {
    for (const artistId of track.artistIds) {
      artistFrequency.set(artistId, (artistFrequency.get(artistId) ?? 0) + 1);
    }
  }

  const topArtistIds = Array.from(artistFrequency.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([artistId]) => artistId);

  const suggestionGroups = await Promise.all(
    topArtistIds.map(async (artistId) => {
      try {
        return await fetchArtistTopTracks(artistId, "BR");
      } catch {
        return [];
      }
    }),
  );

  const suggestions = aggregateTracks(suggestionGroups)
    .filter((track) => !excludedIds.has(track.id))
    .slice(0, 12);

  return buildTrackInsights(suggestions);
}
