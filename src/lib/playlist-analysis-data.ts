import "server-only";

import type {
  ChannelDatum,
  DashboardMetric,
  PlaylistRecord,
  ScoreBreakdown,
} from "@/types/dashboard";
import type { SuggestedTrackInsight } from "@/types/playlist-analysis";
import type { PlaylistAnalysisData } from "@/types/playlist-analysis";
import type { TrackInsight } from "@/types/charts";
import {
  fetchPlaylistByIdFromSupabase,
  updatePlaylistInSupabase,
  type SupabasePlaylistRow,
} from "./supabase-rest";
import { getChartsData, getRelatedTrackSuggestions } from "./charts-data";
import {
  calculatePlaylistScore,
  extractSpotifyPlaylistId,
  fetchSpotifyPlaylistMetadata,
  fetchSpotifyPlaylistTracks,
} from "./spotify";

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function normalizePlaylist(row: SupabasePlaylistRow): PlaylistRecord {
  return {
    id: String(row.id ?? ""),
    createdAt: row.created_at,
    url: row.url?.trim() || "#",
    name: row.name?.trim() || "Playlist sem nome",
    coverUrl: row.image_url?.trim() || null,
    followers: toNumber(row.followers),
    tracks: toNumber(row.tracks),
    score: toNumber(row.score),
  };
}

async function enrichPlaylist(playlist: PlaylistRecord): Promise<PlaylistRecord> {
  const playlistId = extractSpotifyPlaylistId(playlist.url);

  if (!playlistId) {
    return playlist;
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

    await updatePlaylistInSupabase(playlist.id, {
      url: enrichedPlaylist.url,
      name: enrichedPlaylist.name,
      image_url: enrichedPlaylist.coverUrl,
      followers: enrichedPlaylist.followers,
      tracks: enrichedPlaylist.tracks,
      score: enrichedPlaylist.score,
    }).catch(() => undefined);

    return enrichedPlaylist;
  } catch {
    return playlist;
  }
}

function buildMetrics(
  playlist: PlaylistRecord,
  tracks: TrackInsight[],
  overlapWithMarket: number,
  suggestionCount: number,
): DashboardMetric[] {
  const averagePopularity =
    tracks.length > 0
      ? tracks.reduce((sum, track) => sum + track.popularity, 0) / tracks.length
      : 0;

  return [
    {
      title: "Followers",
      value: formatCount(playlist.followers),
      change: 0,
    },
    {
      title: "Tracks",
      value: formatCount(playlist.tracks),
      change: 0,
    },
    {
      title: "Market Overlap",
      value: formatCount(overlapWithMarket),
      change: 0,
    },
    {
      title: "Suggested Adds",
      value: formatCount(suggestionCount),
      change: 0,
    },
    {
      title: "Playlist Score",
      value: formatCount(playlist.score),
      change: 0,
    },
    {
      title: "Avg. Popularity",
      value: averagePopularity.toFixed(1),
      change: 0,
    },
  ];
}

function buildArtistDistribution(tracks: TrackInsight[]): ChannelDatum[] {
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

function buildPopularityHealth(tracks: TrackInsight[]): ScoreBreakdown {
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

function buildCuratorNotes(
  playlist: PlaylistRecord,
  overlapWithMarket: number,
  tracks: TrackInsight[],
  suggestedTracks: SuggestedTrackInsight[],
): string[] {
  const averagePopularity =
    tracks.length > 0
      ? tracks.reduce((sum, track) => sum + track.popularity, 0) / tracks.length
      : 0;

  const notes = [
    overlapWithMarket > 0
      ? `A playlist ja tem ${overlapWithMarket} faixas com aderencia ao mercado em movimento.`
      : "A playlist ainda nao tem overlap forte com o mercado em movimento.",
    averagePopularity >= 65
      ? "O repertorio atual ja entra com boa tracao de catalogo no Spotify."
      : "O repertorio ainda pode subir a media de popularidade para ganhar mais tracao.",
    suggestedTracks.length > 0
      ? `Existem ${suggestedTracks.length} oportunidades claras de add relacionadas ao DNA atual da playlist.`
      : "Nao encontramos oportunidades relacionadas suficientes neste momento.",
  ];

  if (playlist.score < 60) {
    notes.push(
      "O score da playlist ainda esta abaixo do ideal para competir com playlists fortes do nicho.",
    );
  }

  return notes;
}

export async function getPlaylistAnalysisData(
  playlistId: string,
): Promise<PlaylistAnalysisData | null> {
  const row = await fetchPlaylistByIdFromSupabase(playlistId);

  if (!row) {
    return null;
  }

  const basePlaylist = normalizePlaylist(row);
  const playlist = await enrichPlaylist(basePlaylist);
  const spotifyPlaylistId = extractSpotifyPlaylistId(playlist.url);

  if (!spotifyPlaylistId) {
    return {
      playlist,
      metrics: buildMetrics(playlist, [], 0, 0),
      artistDistribution: [],
      popularityHealth: {
        positive: 0,
        neutral: 0,
        negative: 0,
      },
      overlapWithMarket: 0,
      currentTracks: [],
      suggestedTracks: [],
      curatorNotes: [
        "Essa playlist ainda nao tem uma URL valida do Spotify para analise.",
      ],
    };
  }

  const [currentSpotifyTracks, chartsData] = await Promise.all([
    fetchSpotifyPlaylistTracks(spotifyPlaylistId),
    getChartsData(),
  ]);

  const currentTracks: TrackInsight[] = currentSpotifyTracks.map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists.join(", "),
    artistIds: track.artistIds,
    albumName: track.albumName,
    popularity: track.popularity,
    playlistsCount: 1,
    durationLabel: `${Math.floor(track.durationMs / 60000)}:${Math.floor(
      (track.durationMs % 60000) / 1000,
    )
      .toString()
      .padStart(2, "0")}`,
    explicit: track.explicit,
    spotifyUrl: track.spotifyUrl,
    coverUrl: track.coverUrl,
  }));

  const currentTrackIds = currentTracks.map((track) => track.id);
  const marketTrackIds = new Set(chartsData.marketTracks.map((track) => track.id));
  const overlapWithMarket = currentTracks.filter((track) =>
    marketTrackIds.has(track.id),
  ).length;

  const rawSuggestions = await getRelatedTrackSuggestions(
    currentTracks,
    currentTrackIds,
  );

  const suggestedTracks: SuggestedTrackInsight[] = rawSuggestions.map((track) => ({
    ...track,
    reason: marketTrackIds.has(track.id)
      ? "Ja esta bombando no mercado em movimento."
      : "Conversa com os artistas e a assinatura atual da playlist.",
  }));

  return {
    playlist,
    metrics: buildMetrics(
      playlist,
      currentTracks,
      overlapWithMarket,
      suggestedTracks.length,
    ),
    artistDistribution: buildArtistDistribution(currentTracks),
    popularityHealth: buildPopularityHealth(currentTracks),
    overlapWithMarket,
    currentTracks,
    suggestedTracks,
    curatorNotes: buildCuratorNotes(
      playlist,
      overlapWithMarket,
      currentTracks,
      suggestedTracks,
    ),
  };
}
