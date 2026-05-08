import "server-only";

import type { ChannelDatum, ConversionDatum, ScoreBreakdown } from "@/types/dashboard";
import type { FeaturedPlaylistInsight, TrackInsight } from "@/types/charts";
import type {
  MusicChartsData,
  MusicDataTrustContext,
  MusicFilterOption,
  MusicOpportunity,
  MusicSignalSource,
  MusicTrackHighlight,
  MusicWorkbenchMetric,
  MusicWorkbenchTrack,
} from "@/types/music-charts";
import {
  applyArtistIntelligenceTags,
  buildArtistDominanceInsights,
  buildGenreHeatInsights,
} from "./charts/genres";
import type { ChartCandidate, ChartMovementContext, ChartMovementRecord } from "./charts/movements";
import { buildChartMovements } from "./charts/movements";
import {
  fetchFeaturedPlaylists,
  fetchSpotifyPlaylistTracks,
  fetchSpotifyTracksByGenre,
  type SpotifyFeaturedPlaylist,
  type SpotifyTrackRecord,
} from "./spotify";
import {
  fetchLatestFromSnapshotTracks,
  fetchTrackStreamSnapshots,
  type SpotifyChartEntryRow,
  type TrackStreamSnapshotRow,
} from "./spotify-charts-store";
import { upsertMusicChartMovements } from "./music-movement-store";
import {
  fetchMusicTrackSnapshots,
  saveMusicTrackSnapshots,
  type MusicTrackSnapshotInput,
} from "./music-snapshot-store";

type MusicGenreOption = MusicFilterOption & {
  queries: string[];
};

type MusicMarketOption = MusicFilterOption & {
  locale: string;
};

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
  marketSignals: number;
  searchSignals: number;
  sourceNames: string[];
  genreHints: string[];
  dailyStreams: number | null;
  streamRank: number | null;
  streamGrowth: number | null;
  streamVelocityLabel: string;
  streamScore: number | null;
};

type MusicChartsDataCacheEntry = {
  value: MusicChartsData;
  expiresAt: number;
};

const MUSIC_CHARTS_DATA_TTL_MS = 2 * 60 * 1000;
const musicChartsDataCache = new Map<string, MusicChartsDataCacheEntry>();
const musicChartsDataInFlight = new Map<string, Promise<MusicChartsData>>();

const MUSIC_MARKET_OPTIONS: MusicMarketOption[] = [
  { value: "BR", label: "Brasil", locale: "pt_BR" },
  { value: "US", label: "Estados Unidos", locale: "en_US" },
  { value: "MX", label: "Mexico", locale: "es_MX" },
  { value: "AR", label: "Argentina", locale: "es_AR" },
  { value: "CO", label: "Colombia", locale: "es_CO" },
  { value: "ES", label: "Espanha", locale: "es_ES" },
  { value: "PT", label: "Portugal", locale: "pt_PT" },
  { value: "FR", label: "Franca", locale: "fr_FR" },
  { value: "GB", label: "Reino Unido", locale: "en_GB" },
];

const MUSIC_GENRE_OPTIONS: MusicGenreOption[] = [
  { value: "all", label: "Todos os generos", queries: [] },
  { value: "trap", label: "Trap", queries: ['genre:"trap"', "trap"] },
  { value: "rap", label: "Rap", queries: ['genre:"rap"', "rap"] },
  {
    value: "hip-hop",
    label: "Hip Hop",
    queries: ['genre:"hip hop"', '"hip hop"'],
  },
  { value: "funk", label: "Funk", queries: ['genre:"funk"', "funk"] },
  { value: "phonk", label: "Phonk", queries: ['genre:"phonk"', "phonk"] },
  { value: "pop", label: "Pop", queries: ['genre:"pop"', "pop"] },
  { value: "latin", label: "Latin", queries: ['genre:"latin"', "latin"] },
  {
    value: "reggaeton",
    label: "Reggaeton",
    queries: ['genre:"reggaeton"', "reggaeton"],
  },
  {
    value: "electronic",
    label: "Electronic",
    queries: ['genre:"electronic"', "electronic"],
  },
  { value: "house", label: "House", queries: ['genre:"house"', "house"] },
  { value: "indie", label: "Indie", queries: ['genre:"indie"', "indie"] },
  { value: "r-n-b", label: "R&B", queries: ['genre:"r-n-b"', '"r&b"'] },
  { value: "samba", label: "Samba", queries: ['genre:"samba"', "samba"] },
  { value: "pagode", label: "Pagode", queries: ['genre:"pagode"', "pagode"] },
  {
    value: "sertanejo",
    label: "Sertanejo",
    queries: ['genre:"sertanejo"', "sertanejo"],
  },
];

const MARKET_PROBE_QUERIES: Record<string, string[]> = {
  BR: [
    'genre:"trap"',
    'genre:"rap"',
    'genre:"funk"',
    'genre:"pop"',
    'genre:"sertanejo"',
  ],
  US: [
    'genre:"hip hop"',
    'genre:"pop"',
    'genre:"rap"',
    'genre:"r-n-b"',
    'genre:"electronic"',
  ],
  MX: [
    'genre:"reggaeton"',
    'genre:"latin"',
    'genre:"pop"',
    'genre:"rap"',
  ],
  AR: [
    'genre:"reggaeton"',
    'genre:"latin"',
    'genre:"trap"',
    'genre:"pop"',
  ],
  CO: [
    'genre:"reggaeton"',
    'genre:"latin"',
    'genre:"trap"',
    'genre:"pop"',
  ],
  ES: [
    'genre:"reggaeton"',
    'genre:"latin"',
    'genre:"pop"',
    'genre:"indie"',
  ],
  PT: [
    'genre:"trap"',
    'genre:"hip hop"',
    'genre:"pop"',
    'genre:"house"',
  ],
  FR: [
    'genre:"rap"',
    'genre:"pop"',
    'genre:"electronic"',
    'genre:"house"',
  ],
  GB: [
    'genre:"hip hop"',
    'genre:"pop"',
    'genre:"house"',
    'genre:"electronic"',
  ],
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(Math.max(value, minValue), maxValue);
}

function getMarketOption(country?: string) {
  return (
    MUSIC_MARKET_OPTIONS.find((option) => option.value === country) ??
    MUSIC_MARKET_OPTIONS[0]
  );
}

function getGenreOption(genre?: string) {
  return (
    MUSIC_GENRE_OPTIONS.find((option) => option.value === genre) ??
    MUSIC_GENRE_OPTIONS[0]
  );
}

function getGenreLabel(genre?: string) {
  return getGenreOption(genre).label;
}

function getGenreHintFromQuery(query: string) {
  const normalized = query.toLowerCase().replace(/"/g, "");

  return (
    MUSIC_GENRE_OPTIONS.find((option) =>
      option.value !== "all" &&
      option.queries.some((candidate) =>
        normalized.includes(candidate.toLowerCase().replace(/"/g, "")),
      ),
    )?.value ?? null
  );
}

function getSignalCount(track: Pick<AggregatedTrack, "marketSignals" | "searchSignals">) {
  return track.marketSignals + track.searchSignals;
}

function getSnapshotDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseStoreNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

function formatSignedValue(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function getTrackSignalSource(track: Pick<AggregatedTrack, "marketSignals" | "searchSignals">): MusicSignalSource {
  if (track.marketSignals > 0 && track.searchSignals > 0) {
    return "hybrid";
  }

  if (track.marketSignals > 0) {
    return "featured";
  }

  if (track.searchSignals > 0) {
    return "search";
  }

  return "empty";
}

function getSignalSourceLabel(source: MusicSignalSource) {
  switch (source) {
    case "featured":
      return "Featured";
    case "search":
      return "Search fallback";
    case "hybrid":
      return "Featured + Search";
    default:
      return "Sem fonte";
  }
}

function hasStreamData(tracks: AggregatedTrack[]) {
  return tracks.some((track) => typeof track.dailyStreams === "number");
}

function getStreamVelocityLabel(
  track: Pick<AggregatedTrack, "dailyStreams" | "streamGrowth">,
) {
  if (track.dailyStreams === null) {
    return "Sem leitura de streams";
  }

  if (track.streamGrowth === null) {
    return "Sem historico";
  }

  if (track.streamGrowth > 0) {
    return "Acelerando";
  }

  if (track.streamGrowth < 0) {
    return "Perdendo forca";
  }

  return "Fluxo estavel";
}

function normalizeStreamScores(tracks: AggregatedTrack[]) {
  const maxDailyStreams = tracks.reduce((maxValue, track) => {
    const dailyStreams = track.dailyStreams ?? 0;
    return Math.max(maxValue, dailyStreams);
  }, 0);

  return tracks.map((track) => ({
    ...track,
    streamScore:
      track.dailyStreams !== null && maxDailyStreams > 0
        ? clamp(
            Math.round((track.dailyStreams / maxDailyStreams) * 100),
            0,
            100,
          )
        : null,
  }));
}

function getSourceMode(
  featuredPlaylistCount: number,
  activeQueryCount: number,
): MusicSignalSource {
  if (featuredPlaylistCount > 0 && activeQueryCount > 0) {
    return "hybrid";
  }

  if (featuredPlaylistCount > 0) {
    return "featured";
  }

  if (activeQueryCount > 0) {
    return "search";
  }

  return "empty";
}

function getSourceModeLabel(sourceMode: MusicSignalSource) {
  switch (sourceMode) {
    case "hybrid":
      return "Radar hibrido";
    case "featured":
      return "Radar editorial";
    case "search":
      return "Search fallback";
    default:
      return "Sem leitura ativa";
  }
}

function getSourceModeDescription(sourceMode: MusicSignalSource) {
  switch (sourceMode) {
    case "hybrid":
      return "Cruza playlists destaque com buscas editoriais para ampliar cobertura sem perder contexto.";
    case "featured":
      return "Baseado diretamente nas playlists em destaque do Spotify para este mercado.";
    case "search":
      return "Spotify nao trouxe playlists destaque suficientes e a leitura foi sustentada por buscas editoriais.";
    default:
      return "Ainda sem base suficiente para produzir um radar confiavel.";
  }
}

function getMomentumScore(track: AggregatedTrack, maxSignalCount: number) {
  const normalizedSignals =
    maxSignalCount > 0 ? getSignalCount(track) / maxSignalCount : 0;
  const editorialBonus = track.marketSignals > 0 ? 8 : 0;
  const hybridBonus = track.marketSignals > 0 && track.searchSignals > 0 ? 6 : 0;
  const streamBonus = track.streamScore !== null ? track.streamScore * 0.24 : 0;

  return clamp(
    Math.round(
      track.popularity * 0.6 +
        normalizedSignals * 26 +
        editorialBonus +
        hybridBonus +
        streamBonus,
    ),
    0,
    100,
  );
}

function getOpportunityScore(track: AggregatedTrack, maxSignalCount: number) {
  const normalizedSignals =
    maxSignalCount > 0 ? getSignalCount(track) / maxSignalCount : 0;
  const lowSaturationBonus = getSignalCount(track) <= 2 ? 16 : 0;
  const discoveryBonus =
    track.popularity >= 60 && getSignalCount(track) <= 2 ? 12 : 0;
  const editorialBonus = track.marketSignals > 0 ? 10 : 0;
  const hybridBonus = track.marketSignals > 0 && track.searchSignals > 0 ? 6 : 0;
  const saturationPenalty = getSignalCount(track) >= 5 ? 8 : 0;
  const streamBonus = track.streamScore !== null ? track.streamScore * 0.2 : 0;
  const streamGrowthBonus =
    track.streamGrowth !== null && track.streamGrowth > 0
      ? Math.min(12, Math.log10(track.streamGrowth + 1) * 4)
      : 0;

  return clamp(
    Math.round(
      track.popularity * 0.48 +
        normalizedSignals * 18 +
        lowSaturationBonus +
        discoveryBonus +
        editorialBonus +
        hybridBonus -
        saturationPenalty +
        streamBonus +
        streamGrowthBonus,
    ),
    0,
    100,
  );
}

function sortTracks(tracks: AggregatedTrack[]) {
  const streamAwareRanking = hasStreamData(tracks);

  return [...tracks].sort((left, right) => {
    if (streamAwareRanking) {
      const rightDailyStreams = right.dailyStreams ?? -1;
      const leftDailyStreams = left.dailyStreams ?? -1;

      if (rightDailyStreams !== leftDailyStreams) {
        return rightDailyStreams - leftDailyStreams;
      }
    }

    const signalDifference = getSignalCount(right) - getSignalCount(left);

    if (signalDifference !== 0) {
      return signalDifference;
    }

    return right.popularity - left.popularity;
  });
}

function aggregateTracks(
  trackGroups: Array<{
    tracks: SpotifyTrackRecord[];
    sourceName: string;
    genreHint: string | null;
  }>,
  source: "market" | "search",
): AggregatedTrack[] {
  const trackMap = new Map<string, AggregatedTrack>();

  for (const group of trackGroups) {
    const seenInGroup = new Set<string>();

    for (const track of group.tracks) {
      const existing = trackMap.get(track.id);
      const artists = track.artists.join(", ");

      if (existing) {
        existing.popularity = Math.max(existing.popularity, track.popularity);
        existing.explicit = existing.explicit || track.explicit;
        existing.coverUrl = existing.coverUrl ?? track.coverUrl ?? null;
        existing.albumName = existing.albumName || track.albumName || "Unknown album";
        if (!existing.sourceNames.includes(group.sourceName)) {
          existing.sourceNames.push(group.sourceName);
        }
        if (group.genreHint && !existing.genreHints.includes(group.genreHint)) {
          existing.genreHints.push(group.genreHint);
        }
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
          marketSignals: 0,
          searchSignals: 0,
          sourceNames: [group.sourceName],
          genreHints: group.genreHint ? [group.genreHint] : [],
          dailyStreams: null,
          streamRank: null,
          streamGrowth: null,
          streamVelocityLabel: "Sem leitura de streams",
          streamScore: null,
        });
      }

      if (!seenInGroup.has(track.id)) {
        seenInGroup.add(track.id);
        const aggregated = trackMap.get(track.id);

        if (aggregated) {
          aggregated.playlistsCount += 1;

          if (source === "market") {
            aggregated.marketSignals += 1;
          } else {
            aggregated.searchSignals += 1;
          }
        }
      }
    }
  }

  return normalizeStreamScores(sortTracks(Array.from(trackMap.values())));
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

function buildTrackInsights(tracks: AggregatedTrack[], limit = tracks.length): TrackInsight[] {
  return tracks.slice(0, limit).map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists,
    artistIds: track.artistIds,
    albumName: track.albumName,
    popularity: track.popularity,
    playlistsCount: getSignalCount(track),
    durationLabel: formatDuration(track.durationMs),
    explicit: track.explicit,
    spotifyUrl: track.spotifyUrl,
    coverUrl: track.coverUrl,
  }));
}

function buildSeedTracks(tracks: AggregatedTrack[], limit = 3) {
  return tracks.slice(0, limit).map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists,
    coverUrl: track.coverUrl,
    spotifyUrl: track.spotifyUrl,
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

function mergeTracks(left: AggregatedTrack, right: AggregatedTrack): AggregatedTrack {
  return {
    ...left,
    popularity: Math.max(left.popularity, right.popularity),
    playlistsCount: left.playlistsCount + right.playlistsCount,
    coverUrl: left.coverUrl ?? right.coverUrl ?? null,
    albumName: left.albumName || right.albumName || "Unknown album",
    marketSignals: left.marketSignals + right.marketSignals,
    searchSignals: left.searchSignals + right.searchSignals,
    sourceNames: Array.from(new Set([...left.sourceNames, ...right.sourceNames])),
    genreHints: Array.from(new Set([...left.genreHints, ...right.genreHints])),
    dailyStreams:
      left.dailyStreams !== null && right.dailyStreams !== null
        ? Math.max(left.dailyStreams, right.dailyStreams)
        : left.dailyStreams ?? right.dailyStreams,
    streamRank:
      left.streamRank !== null && right.streamRank !== null
        ? Math.min(left.streamRank, right.streamRank)
        : left.streamRank ?? right.streamRank,
    streamGrowth:
      left.streamGrowth !== null && right.streamGrowth !== null
        ? Math.max(left.streamGrowth, right.streamGrowth)
        : left.streamGrowth ?? right.streamGrowth,
    streamVelocityLabel:
      left.dailyStreams !== null
        ? left.streamVelocityLabel
        : right.streamVelocityLabel,
    streamScore:
      left.streamScore !== null && right.streamScore !== null
        ? Math.max(left.streamScore, right.streamScore)
        : left.streamScore ?? right.streamScore,
  };
}

function mergeGenreAndMarketTracks(
  marketTracks: AggregatedTrack[],
  genreTracks: AggregatedTrack[],
  includeMarketUnion: boolean,
): AggregatedTrack[] {
  if (genreTracks.length === 0) {
    return normalizeStreamScores(sortTracks(marketTracks));
  }

  if (marketTracks.length === 0) {
    return normalizeStreamScores(sortTracks(genreTracks));
  }

  const marketTrackMap = new Map(
    marketTracks.map((track) => [track.id, track] as const),
  );

  if (!includeMarketUnion) {
    return normalizeStreamScores(sortTracks(
      genreTracks.map((track) => {
        const marketTrack = marketTrackMap.get(track.id);

        return marketTrack ? mergeTracks(track, marketTrack) : track;
      }),
    ));
  }

  const mergedMap = new Map(
    marketTracks.map((track) => [track.id, track] as const),
  );

  for (const track of genreTracks) {
    const existing = mergedMap.get(track.id);

    if (existing) {
      mergedMap.set(track.id, mergeTracks(existing, track));
    } else {
      mergedMap.set(track.id, track);
    }
  }

  return normalizeStreamScores(sortTracks(Array.from(mergedMap.values())));
}

function buildTracksFromSpotifyChartEntries({
  rows,
  country,
  genre,
}: {
  rows: SpotifyChartEntryRow[];
  country: string;
  genre: string;
}): AggregatedTrack[] {
  const trackMap = new Map<string, AggregatedTrack>();

  for (const row of rows) {
    const trackId = row.spotify_track_id?.trim();
    const trackName = row.track_name?.trim();
    const artistName = row.artist_name?.trim();
    const spotifyUrl = row.spotify_url?.trim();
    const rowCountry = row.country?.trim();
    const rowGenre = row.genre?.trim() ?? null;

    if (!trackId || !trackName || !artistName || !spotifyUrl) {
      continue;
    }

    if (rowCountry && rowCountry !== country) {
      continue;
    }

    if (genre !== "all" && rowGenre !== genre) {
      continue;
    }

    const currentStreams = parseStoreNumber(row.daily_streams);
    const streamRank = parseStoreNumber(row.rank_position);
    const sourceName =
      row.chart_name?.trim() || `Spotify Charts ${country}`;
    const genreHints = rowGenre ? [rowGenre] : [];
    const existing = trackMap.get(trackId);

    const nextTrack: AggregatedTrack = {
      id: trackId,
      name: trackName,
      artists: artistName,
      artistIds: row.artist_ids ?? [],
      albumName: row.album_name?.trim() || "Spotify Charts",
      popularity: 0,
      playlistsCount: 1,
      durationMs: 0,
      explicit: false,
      spotifyUrl,
      coverUrl: row.image_url?.trim() || null,
      marketSignals: 1,
      searchSignals: 0,
      sourceNames: [sourceName],
      genreHints,
      dailyStreams: currentStreams,
      streamRank,
      streamGrowth: null,
      streamVelocityLabel: getStreamVelocityLabel({
        dailyStreams: currentStreams,
        streamGrowth: null,
      }),
      streamScore: null,
    };

    if (existing) {
      trackMap.set(trackId, mergeTracks(existing, nextTrack));
    } else {
      trackMap.set(trackId, nextTrack);
    }
  }

  return normalizeStreamScores(sortTracks(Array.from(trackMap.values())));
}

function buildLatestStreamEntryMap(rows: SpotifyChartEntryRow[]) {
  const entriesByTrack = new Map<string, SpotifyChartEntryRow>();

  for (const row of rows) {
    if (!row.spotify_track_id) {
      continue;
    }

    const existing = entriesByTrack.get(row.spotify_track_id);

    if (
      !existing ||
      (row.captured_at ?? "").localeCompare(existing.captured_at ?? "") > 0
    ) {
      entriesByTrack.set(row.spotify_track_id, row);
    }
  }

  return entriesByTrack;
}

function buildPreviousStreamSnapshotMap(
  rows: TrackStreamSnapshotRow[],
  latestChartDate: string,
) {
  const snapshotsByTrack = new Map<string, TrackStreamSnapshotRow>();

  for (const row of rows) {
    if (!row.spotify_track_id || !row.chart_date || row.chart_date >= latestChartDate) {
      continue;
    }

    const existing = snapshotsByTrack.get(row.spotify_track_id);

    if (
      !existing ||
      row.chart_date > (existing.chart_date ?? "") ||
      (row.chart_date === existing.chart_date &&
        (row.captured_at ?? "").localeCompare(existing.captured_at ?? "") > 0)
    ) {
      snapshotsByTrack.set(row.spotify_track_id, row);
    }
  }

  return snapshotsByTrack;
}

function enrichTracksWithStreamData({
  tracks,
  chartEntries,
  streamSnapshots,
}: {
  tracks: AggregatedTrack[];
  chartEntries: SpotifyChartEntryRow[];
  streamSnapshots: TrackStreamSnapshotRow[];
}) {
  if (chartEntries.length === 0) {
    return tracks;
  }

  const latestChartDate = chartEntries[0]?.chart_date;

  if (!latestChartDate) {
    return tracks;
  }

  const latestEntriesByTrack = buildLatestStreamEntryMap(chartEntries);
  const previousSnapshotsByTrack = buildPreviousStreamSnapshotMap(
    streamSnapshots,
    latestChartDate,
  );

  return normalizeStreamScores(
    sortTracks(
      tracks.map((track) => {
        const latestEntry = latestEntriesByTrack.get(track.id);

        if (!latestEntry) {
          return track;
        }

        const currentStreams = parseStoreNumber(latestEntry.daily_streams);
        const previousSnapshot = previousSnapshotsByTrack.get(track.id);
        const previousStreams = parseStoreNumber(previousSnapshot?.daily_streams);
        const streamGrowth =
          currentStreams === null || previousStreams === null
            ? null
            : currentStreams - previousStreams;

        return {
          ...track,
          dailyStreams: currentStreams,
          streamRank: parseStoreNumber(latestEntry.rank_position),
          streamGrowth,
          streamVelocityLabel: getStreamVelocityLabel({
            dailyStreams: currentStreams,
            streamGrowth,
          }),
        };
      }),
    ),
  );
}

function buildChartCandidates({
  tracks,
  market,
  genre,
}: {
  tracks: AggregatedTrack[];
  market: string;
  genre: string;
}): ChartCandidate[] {
  return sortTracks(tracks).map((track) => {
    const trackGenre =
      genre === "all" ? track.genreHints[0] ?? "all" : genre;
    const sourceType = getTrackSignalSource(track);
    const sourceNames = Array.from(new Set(track.sourceNames));
    const saturationCount = Math.max(sourceNames.length, getSignalCount(track), 1);

    return {
      trackId: track.id,
      trackName: track.name,
      artistName: track.artists,
      artistIds: track.artistIds,
      albumName: track.albumName,
      imageUrl: track.coverUrl,
      spotifyUrl: track.spotifyUrl,
      popularity: track.popularity,
      sourceType,
      sourceName:
        sourceNames.length > 1
          ? `${sourceNames[0]} +${sourceNames.length - 1}`
          : sourceNames[0] ?? getSignalSourceLabel(sourceType),
      sourceNames,
      country: market,
      genre: trackGenre,
      scopeGenre: genre,
      genreHints: track.genreHints.length > 0 ? track.genreHints : [trackGenre],
      saturationCount,
      explicit: track.explicit,
      dailyStreams: track.dailyStreams,
      streamRank: track.streamRank,
      streamGrowth: track.streamGrowth,
      streamVelocityLabel: track.streamVelocityLabel,
      streamScore: track.streamScore,
    };
  });
}

function buildSnapshotRows(
  tracks: ChartCandidate[],
  snapshotDate: string,
  capturedAt: string,
): MusicTrackSnapshotInput[] {
  return tracks.map((track) => ({
    market: track.country,
    genre: track.scopeGenre,
    track_id: track.trackId,
    snapshot_date: snapshotDate,
    captured_at: capturedAt,
    track_name: track.trackName,
    artists: track.artistName,
    album_name: track.albumName,
    cover_url: track.imageUrl,
    spotify_url: track.spotifyUrl,
    popularity: track.popularity,
    signal_count: track.saturationCount,
    source_mode: track.sourceType,
    explicit: track.explicit,
  }));
}

function buildMovementRows(movements: ChartMovementRecord[]) {
  return movements.map((movement) => ({
    spotify_track_id: movement.trackId,
    current_rank: movement.currentRank,
    previous_rank: movement.previousRank,
    rank_change: movement.rankChange,
    movement_type: movement.movementType,
    popularity_current: movement.popularityCurrent,
    popularity_previous: movement.popularityPrevious,
    popularity_change: movement.popularityChange,
    days_on_chart: movement.daysOnChart,
    saturation_count: movement.saturationCount,
    opportunity_score: movement.opportunityScore,
    intelligence_tags: movement.intelligenceTags,
    country: movement.country,
    genre: movement.scopeGenre,
    snapshot_day: movement.snapshotDay,
    calculated_at: movement.calculatedAt,
  }));
}

function buildSummaryCards(
  tracks: AggregatedTrack[],
  workbenchTracks: MusicWorkbenchTrack[],
  movementContext: ChartMovementContext,
): MusicWorkbenchMetric[] {
  const highTractionCount = workbenchTracks.filter((track) => track.highTraction).length;
  const opportunityCount = workbenchTracks.filter(
    (track) => track.lowSaturation && track.opportunityScore >= 70,
  ).length;

  return [
    {
      title: "Tracks analisadas",
      value: formatCount(tracks.length),
      caption: "Amostra real usada para esta leitura do radar.",
    },
    {
      title: "Dias rastreados",
      value: formatCount(movementContext.historyDaysTracked),
      caption:
        movementContext.hasSufficientHistory
          ? "Base temporal valida para ler subida, entrada e persistencia."
          : "Historico ainda curto e em fase inicial de coleta.",
    },
    {
      title: "Alta tracao",
      value: formatCount(highTractionCount),
      caption: "Faixas com aderencia imediata para playlisting.",
    },
    {
      title: "Oportunidades",
      value: formatCount(opportunityCount),
      caption: "Sinais com baixa saturacao e alto potencial editorial.",
    },
  ];
}

function buildTopMovers(
  movements: ChartMovementRecord[],
  movementContext: ChartMovementContext,
): MusicTrackHighlight[] {
  const source =
    movementContext.hasSufficientHistory
      ? movements.filter(
          (track) =>
            (track.rankChange ?? 0) > 0 ||
            (track.popularityChange ?? 0) > 0,
        )
      : movements;

  return [...(source.length > 0 ? source : movements)]
    .sort((left, right) => {
      const rightScore =
        Math.max(right.rankChange ?? 0, 0) * 10 +
        Math.max(right.popularityChange ?? 0, 0) * 4 +
        right.opportunityScore;
      const leftScore =
        Math.max(left.rankChange ?? 0, 0) * 10 +
        Math.max(left.popularityChange ?? 0, 0) * 4 +
        left.opportunityScore;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return right.popularityCurrent - left.popularityCurrent;
    })
    .slice(0, 6)
    .map((track) => {
      return {
        id: track.trackId,
        name: track.trackName,
        artists: track.artistName,
        coverUrl: track.imageUrl,
        spotifyUrl: track.spotifyUrl,
        badgeLabel: track.movementType === "up" ? "Subida forte" : "Radar quente",
        primaryMetric:
          track.rankChange === null
            ? "Sem historico"
            : `▲ ${formatSignedValue(track.rankChange)}`,
        secondaryMetric:
          track.popularityChange === null
            ? `${track.daysOnChart} dias · ${track.popularityCurrent} pop`
            : `${formatSignedValue(track.popularityChange)} pop · ${track.daysOnChart} dias`,
        summary:
          track.rankChange === null
            ? "Historico insuficiente para leitura de movimento. Continue coletando snapshots."
            : `${track.trackName} ganhou ${formatSignedValue(track.rankChange)} posicoes e virou leitura quente de curadoria.`,
      };
    });
}

function buildNewEntries(
  movements: ChartMovementRecord[],
  excludedIds: Set<string>,
): MusicTrackHighlight[] {
  const entryCandidates = movements.filter(
    (track) =>
      !excludedIds.has(track.trackId) &&
      (track.movementType === "new" || track.movementType === "reentry"),
  );
  const fallbackCandidates = movements.filter(
    (track) => !excludedIds.has(track.trackId) && track.saturationCount <= 3,
  );

  return [...(entryCandidates.length > 0 ? entryCandidates : fallbackCandidates)]
    .sort((left, right) => {
      if (right.opportunityScore !== left.opportunityScore) {
        return right.opportunityScore - left.opportunityScore;
      }

      return right.popularityCurrent - left.popularityCurrent;
    })
    .slice(0, 6)
    .map((track) => {
      return {
        id: track.trackId,
        name: track.trackName,
        artists: track.artistName,
        coverUrl: track.imageUrl,
        spotifyUrl: track.spotifyUrl,
        badgeLabel:
          track.movementType === "reentry" ? "Reentrada" : "Nova no radar",
        primaryMetric:
          track.movementType === "reentry" ? "Voltou ao radar" : "NEW",
        secondaryMetric: `${track.saturationCount} fontes · ${track.popularityCurrent} pop`,
        summary:
          track.movementType === "reentry"
            ? "A musica saiu do radar em snapshots anteriores e voltou a ganhar tracao agora."
            : "Entrada fresca no chart, com espaco real para teste editorial antes de saturar.",
      };
    });
}

function buildRecurringTracks(
  movements: ChartMovementRecord[],
): TrackInsight[] {
  const source = movements.filter((track) => track.daysOnChart >= 3);

  return [...(source.length > 0 ? source : movements)]
    .sort((left, right) => {
      if (right.daysOnChart !== left.daysOnChart) {
        return right.daysOnChart - left.daysOnChart;
      }

      if (right.saturationCount !== left.saturationCount) {
        return right.saturationCount - left.saturationCount;
      }

      return right.popularityCurrent - left.popularityCurrent;
    })
    .slice(0, 12)
    .map((track) => ({
      id: track.trackId,
      name: track.trackName,
      artists: track.artistName,
      artistIds: track.artistIds,
      albumName: track.albumName,
      popularity: track.popularityCurrent,
      playlistsCount: track.daysOnChart,
      durationLabel: "n/a",
      explicit: track.explicit,
      spotifyUrl: track.spotifyUrl,
      coverUrl: track.imageUrl,
    }));
}

function buildWorkbenchTracks(
  movements: ChartMovementRecord[],
): MusicWorkbenchTrack[] {
  return movements.map((track) => {
    const lowSaturation = track.saturationCount <= 3;
    const isRecurring = track.daysOnChart >= 3;
    const isNewEntry =
      track.movementType === "new" || track.movementType === "reentry";
    const isMover = track.movementType === "up" && (track.rankChange ?? 0) > 0;
    const highTraction =
      track.popularityCurrent >= 75 ||
      track.opportunityScore >= 82 ||
      track.intelligenceTags.includes("Hit forte");

    return {
      rank: track.currentRank,
      id: track.trackId,
      name: track.trackName,
      artists: track.artistName,
      genre: getGenreLabel(track.genre),
      albumName: track.albumName,
      popularity: track.popularityCurrent,
      dailyStreams: track.dailyStreams,
      streamRank: track.streamRank,
      streamGrowth: track.streamGrowth,
      streamVelocityLabel: track.streamVelocityLabel,
      popularityChange: track.popularityChange,
      previousRank: track.previousRank,
      rankChange: track.rankChange,
      movementType: track.movementType,
      daysOnChart: track.daysOnChart,
      saturationCount: track.saturationCount,
      signalCount: track.saturationCount,
      durationLabel: "n/a",
      explicit: track.explicit,
      spotifyUrl: track.spotifyUrl,
      coverUrl: track.imageUrl,
      opportunityScore: track.opportunityScore,
      sourceLabel: getSignalSourceLabel(track.sourceType),
      signalSource: track.sourceType,
      tractionLabel: track.intelligenceTags.includes("Explodindo")
        ? "Explodindo"
        : track.intelligenceTags.includes("Subindo")
          ? "Subindo"
          : "Estavel",
      saturationLabel:
        track.saturationCount <= 3
          ? "Baixa saturacao"
          : track.saturationCount >= 15
            ? "Saturada"
            : "Saturacao moderada",
      historyLabel:
        track.previousRank === null
          ? "Historico insuficiente"
          : `${track.daysOnChart} dias · ${formatSignedValue(track.rankChange ?? 0)} pos`,
      tags: track.intelligenceTags,
      intelligenceTags: track.intelligenceTags,
      sourceNames: track.sourceNames,
      isMover,
      isNewEntry,
      isRecurring,
      lowSaturation,
      highTraction,
    };
  });
}

function buildOpportunities(
  tracks: AggregatedTrack[],
  countryLabel: string,
  genreLabel: string,
): MusicOpportunity[] {
  const maxSignalCount = tracks.reduce(
    (maxValue, track) => Math.max(maxValue, getSignalCount(track)),
    0,
  );
  const anchorTracks = [...tracks]
    .filter((track) => track.marketSignals >= 1 && track.popularity >= 68)
    .sort((left, right) => {
      const rightMomentum = getMomentumScore(right, maxSignalCount);
      const leftMomentum = getMomentumScore(left, maxSignalCount);

      if (rightMomentum !== leftMomentum) {
        return rightMomentum - leftMomentum;
      }

      return right.popularity - left.popularity;
    });
  const discoveryTracks = [...tracks]
    .filter((track) => getSignalCount(track) <= 2 && track.popularity >= 58)
    .sort((left, right) => {
      const rightScore = getOpportunityScore(right, maxSignalCount);
      const leftScore = getOpportunityScore(left, maxSignalCount);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return right.popularity - left.popularity;
    });
  const artistFrequency = new Map<string, number>();

  for (const track of tracks) {
    for (const artist of track.artists.split(", ").filter(Boolean)) {
      artistFrequency.set(artist, (artistFrequency.get(artist) ?? 0) + 1);
    }
  }

  const topArtists = Array.from(artistFrequency.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([artist]) => artist);
  const artistWaveTracks = tracks.filter((track) =>
    topArtists.some((artist) => track.artists.includes(artist)),
  );
  const focusLabel =
    genreLabel === "Todos os generos" ? `${countryLabel} agora` : `${genreLabel} em ${countryLabel}`;

  return [
    {
      title: "Frente ancora de alta tracao",
      description: `Monte uma playlist principal para ${focusLabel} usando as faixas que ja ganharam aderencia editorial no radar.`,
      rationale:
        anchorTracks.length > 0
          ? "As seeds abaixo ja performam com equilibrio entre popularidade e contexto de mercado."
          : "Quando faltarem anchors fortes, use os movers como bloco de teste inicial.",
      badge: "Anchor build",
      playlistAngle: "Mainstream com entrada rapida",
      potential: anchorTracks.length >= 3 ? "Alta conversao" : "Conversao moderada",
      risk: anchorTracks.length >= 3 ? "Saturacao controlada" : "Base curta",
      callToAction: "Abrir shortlist de anchors",
      seeds: buildSeedTracks(anchorTracks.length > 0 ? anchorTracks : tracks),
    },
    {
      title: "Janela de discovery",
      description:
        "Use entradas frescas com baixa saturacao para capturar tendencia antes de virar consenso editorial.",
      rationale:
        discoveryTracks.length > 0
          ? "Essas faixas ainda nao estao saturadas e ajudam a abrir uma frente de descoberta."
          : "Se o discovery estiver curto, trabalhe com os movers menos recorrentes para criar janela cedo.",
      badge: "Early discovery",
      playlistAngle: "Discovery / baixa saturacao",
      potential: discoveryTracks.length >= 3 ? "Alta chance de descoberta" : "Leitura inicial",
      risk: discoveryTracks.length >= 3 ? "Conversao instavel" : "Pouca amostra",
      callToAction: "Montar shortlist de discovery",
      seeds: buildSeedTracks(discoveryTracks.length > 0 ? discoveryTracks : tracks),
    },
    {
      title: "Dominio de artista",
      description:
        "Crie uma frente editorial baseada no cluster de artistas que mais esta empurrando o radar neste recorte.",
      rationale:
        topArtists.length > 0
          ? `Os nomes que mais aparecem agora sao ${topArtists.join(", ")}.`
          : "Ainda nao houve concentracao forte em poucos artistas para formar um cluster.",
      badge: "Artist wave",
      playlistAngle: "Cluster por artista dominante",
      potential: topArtists.length >= 3 ? "Alta afinidade editorial" : "Afinidade moderada",
      risk: topArtists.length >= 3 ? "Dependencia de poucos nomes" : "Cluster disperso",
      callToAction: "Testar frente por artista",
      seeds: buildSeedTracks(
        artistWaveTracks.length > 0 ? artistWaveTracks : tracks,
      ),
    },
  ];
}

function buildMarketHighlight(
  countryLabel: string,
  genreLabel: string,
  sourceMode: MusicSignalSource,
  featuredPlaylistCount: number,
  activeQueryCount: number,
  hybridCount: number,
) {
  const focusLabel =
    genreLabel === "Todos os generos" ? `mercado aberto de ${countryLabel}` : `${genreLabel} em ${countryLabel}`;

  switch (sourceMode) {
    case "hybrid":
      return `${hybridCount} faixas cruzam playlists destaque com busca editorial no recorte ${focusLabel}.`;
    case "featured":
      return `Leitura baseada nas ${featuredPlaylistCount} playlists destaque do Spotify para ${focusLabel}.`;
    case "search":
      return `Sem playlists destaque suficientes; radar sustentado por ${activeQueryCount} buscas editoriais em ${focusLabel}.`;
    default:
      return `Ainda sem sinal suficiente para produzir um radar confiavel em ${focusLabel}.`;
  }
}

function buildDataTrustContext({
  tracks,
  featuredPlaylistCount,
  activeQueryCount,
  historyDaysTracked,
  countryLabel,
  genreLabel,
}: {
  tracks: AggregatedTrack[];
  featuredPlaylistCount: number;
  activeQueryCount: number;
  historyDaysTracked: number;
  countryLabel: string;
  genreLabel: string;
}): MusicDataTrustContext {
  const sourceMode = getSourceMode(featuredPlaylistCount, activeQueryCount);
  const featuredOnlyCount = tracks.filter(
    (track) => track.marketSignals > 0 && track.searchSignals === 0,
  ).length;
  const searchOnlyCount = tracks.filter(
    (track) => track.marketSignals === 0 && track.searchSignals > 0,
  ).length;
  const hybridCount = tracks.filter(
    (track) => track.marketSignals > 0 && track.searchSignals > 0,
  ).length;
  const explicitCount = tracks.filter((track) => track.explicit).length;
  const topTrack =
    sortTracks(tracks)[0]?.name ?? "Sem faixa lider ainda";
  const activeSourceCount = featuredPlaylistCount + activeQueryCount;

  return {
    sourceMode,
    sourceModeLabel: getSourceModeLabel(sourceMode),
    sourceModeDescription: getSourceModeDescription(sourceMode),
    fallbackActive: sourceMode === "search",
    updatedAtLabel: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
    sampleSize: tracks.length,
    activeSourceCount,
    featuredPlaylistCount,
    queryCount: activeQueryCount,
    featuredOnlyCount,
    searchOnlyCount,
    hybridCount,
    historyDaysTracked,
    marketHighlight: buildMarketHighlight(
      countryLabel,
      genreLabel,
      sourceMode,
      featuredPlaylistCount,
      activeQueryCount,
      hybridCount,
    ),
    topTrackName: topTrack,
    explicitShare:
      tracks.length > 0
        ? `${Math.round((explicitCount / tracks.length) * 100)}%`
        : "0%",
    countryLabel,
    genreLabel,
  };
}

async function loadFeaturedPlaylistTracks(
  country: string,
  locale: string,
): Promise<{
  featuredPlaylists: FeaturedPlaylistInsight[];
  aggregatedTracks: AggregatedTrack[];
}> {
  try {
    const featuredPlaylists = await fetchFeaturedPlaylists(country, 6, locale);
    const playlistTrackGroups = await Promise.all(
      featuredPlaylists.map(async (playlist) => {
        try {
          return {
            sourceName: playlist.name,
            genreHint: null as string | null,
            tracks: await fetchSpotifyPlaylistTracks(playlist.id, country),
          };
        } catch {
          return {
            sourceName: playlist.name,
            genreHint: null as string | null,
            tracks: [] as SpotifyTrackRecord[],
          };
        }
      }),
    );

    return {
      featuredPlaylists: buildFeaturedPlaylistInsights(featuredPlaylists),
      aggregatedTracks: aggregateTracks(
        playlistTrackGroups.filter((group) => group.tracks.length > 0),
        "market",
      ),
    };
  } catch {
    return {
      featuredPlaylists: [],
      aggregatedTracks: [],
    };
  }
}

async function loadGenreTracks(
  queries: string[],
  country: string,
): Promise<{
  aggregatedTracks: AggregatedTrack[];
  activeQueryCount: number;
}> {
  if (queries.length === 0) {
    return {
      aggregatedTracks: [],
      activeQueryCount: 0,
    };
  }

  try {
    const groups = await Promise.all(
      queries.map(async (query) => {
        try {
          const tracks = await fetchSpotifyTracksByGenre(query, country, 20);

          return {
            sourceName: query,
            genreHint: getGenreHintFromQuery(query),
            tracks,
          };
        } catch {
          return {
            sourceName: query,
            genreHint: getGenreHintFromQuery(query),
            tracks: [] as SpotifyTrackRecord[],
          };
        }
      }),
    );

    const nonEmptyGroups = groups.filter((group) => group.tracks.length > 0);

    return {
      aggregatedTracks: aggregateTracks(
        nonEmptyGroups,
        "search",
      ),
      activeQueryCount: nonEmptyGroups.length,
    };
  } catch {
    return {
      aggregatedTracks: [],
      activeQueryCount: 0,
    };
  }
}

export function getMusicMarketOptions(): MusicFilterOption[] {
  return MUSIC_MARKET_OPTIONS.map(({ value, label }) => ({
    value,
    label,
  }));
}

export function getMusicGenreOptions(): MusicFilterOption[] {
  return MUSIC_GENRE_OPTIONS.map(({ value, label }) => ({
    value,
    label,
  }));
}

export async function getMusicChartsData({
  country,
  genre,
}: {
  country?: string;
  genre?: string;
}): Promise<MusicChartsData> {
  const cacheKey = `${country?.trim().toUpperCase() || "BR"}:${genre?.trim().toLowerCase() || "all"}`;
  const cachedEntry = musicChartsDataCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.value;
  }

  const inFlight = musicChartsDataInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
  const marketOption = getMarketOption(country);
  const genreOption = getGenreOption(genre);
  const marketData = await loadFeaturedPlaylistTracks(
    marketOption.value,
    marketOption.locale,
  );
  const fallbackQueries =
    genreOption.value === "all"
      ? MARKET_PROBE_QUERIES[marketOption.value] ?? MARKET_PROBE_QUERIES.BR
      : genreOption.queries;
  const genreData = await loadGenreTracks(fallbackQueries, marketOption.value);
  const focusTracks =
    marketData.aggregatedTracks.length > 0
      ? mergeGenreAndMarketTracks(
          marketData.aggregatedTracks,
          genreData.aggregatedTracks,
          genreOption.value === "all",
        )
      : genreData.aggregatedTracks;
  const latestSpotifyChartEntries = await fetchLatestFromSnapshotTracks({
    country: marketOption.value,
    genre: genreOption.value !== "all" ? genreOption.value : undefined,
    limit: 200,
  });
  const importedChartTracks = buildTracksFromSpotifyChartEntries({
    rows: latestSpotifyChartEntries,
    country: marketOption.value,
    genre: genreOption.value,
  });
  const radarSeedTracks =
    importedChartTracks.length > 0
      ? mergeGenreAndMarketTracks(
          importedChartTracks,
          focusTracks,
          true,
        )
      : focusTracks;
  const latestChartTrackIds = latestSpotifyChartEntries
    .map((row) => row.spotify_track_id)
    .filter((trackId): trackId is string => Boolean(trackId));
  const streamSnapshots =
    latestChartTrackIds.length > 0
      ? await fetchTrackStreamSnapshots({
          trackIds: latestChartTrackIds,
          country: marketOption.value,
          chartName: "top-songs",
          limit: 1000,
        })
      : [];
  const streamAwareFocusTracks = enrichTracksWithStreamData({
    tracks: radarSeedTracks,
    chartEntries: latestSpotifyChartEntries,
    streamSnapshots,
  });
  const snapshotDate = getSnapshotDateKey(new Date());
  const capturedAt = new Date().toISOString();
  const chartCandidates = buildChartCandidates({
    tracks: streamAwareFocusTracks,
    market: marketOption.value,
    genre: genreOption.value,
  });

  if (chartCandidates.length > 0) {
    await saveMusicTrackSnapshots(
      buildSnapshotRows(chartCandidates, snapshotDate, capturedAt),
    );
  }

  const snapshotRows = await fetchMusicTrackSnapshots({
    market: marketOption.value,
    genre: genreOption.value,
    days: 30,
  });
  const movementResult = buildChartMovements({
    currentTracks: chartCandidates,
    snapshotRows,
    snapshotDay: snapshotDate,
    calculatedAt: capturedAt,
  });
  const genreHeat = buildGenreHeatInsights({
    movements: movementResult.movements,
    getGenreLabel,
  });
  const dominantArtists = buildArtistDominanceInsights(
    movementResult.movements,
  );
  const enrichedMovements = applyArtistIntelligenceTags({
    movements: movementResult.movements,
    artists: dominantArtists,
  });

  if (enrichedMovements.length > 0) {
    await upsertMusicChartMovements(buildMovementRows(enrichedMovements));
  }

  const topMovers = buildTopMovers(
    enrichedMovements,
    movementResult.context,
  );
  const topMoverIds = new Set(topMovers.map((track) => track.id));
  const newEntries = buildNewEntries(enrichedMovements, topMoverIds);
  const recurringTracks = buildRecurringTracks(enrichedMovements);
  const workbenchTracks = buildWorkbenchTracks(enrichedMovements);
  const dataTrust = buildDataTrustContext({
    tracks: streamAwareFocusTracks,
    featuredPlaylistCount: marketData.featuredPlaylists.length,
    activeQueryCount: genreData.activeQueryCount,
    historyDaysTracked: movementResult.context.historyDaysTracked,
    countryLabel: marketOption.label,
    genreLabel: genreOption.label,
  });

    const result = {
      summaryCards: buildSummaryCards(
        streamAwareFocusTracks,
        workbenchTracks,
        movementResult.context,
      ),
      topTracks: buildTopTracks(streamAwareFocusTracks),
      artistDistribution: buildArtistDistribution(streamAwareFocusTracks),
      popularityHealth: buildPopularityHealth(streamAwareFocusTracks),
      tracks: buildTrackInsights(streamAwareFocusTracks),
      topMovers,
      newEntries,
      recurringTracks,
      workbenchTracks,
      opportunities: buildOpportunities(
        streamAwareFocusTracks,
        marketOption.label,
        genreOption.label,
      ),
      featuredPlaylists: marketData.featuredPlaylists,
      dataTrust,
      movementContext: movementResult.context,
      hottestGenres: genreHeat,
      dominantArtists,
      countryValue: marketOption.value,
      countryLabel: marketOption.label,
      genreValue: genreOption.value,
      genreLabel: genreOption.label,
    } satisfies MusicChartsData;

    musicChartsDataCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + MUSIC_CHARTS_DATA_TTL_MS,
    });

    return result;
  })();

  musicChartsDataInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    musicChartsDataInFlight.delete(cacheKey);
  }
}
