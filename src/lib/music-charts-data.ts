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
  fetchFeaturedPlaylists,
  fetchSpotifyPlaylistTracks,
  fetchSpotifyTracksByGenre,
  type SpotifyFeaturedPlaylist,
  type SpotifyTrackRecord,
} from "./spotify";
import {
  fetchMusicTrackSnapshots,
  upsertMusicTrackSnapshots,
  type MusicTrackSnapshotInput,
  type MusicTrackSnapshotRow,
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
};

type TrackHistoryStats = {
  snapshotCount: number;
  previousDaySeen: boolean;
  popularityDelta: number;
  signalDelta: number;
  latestSnapshot: MusicTrackSnapshotRow | null;
  previousSnapshot: MusicTrackSnapshotRow | null;
};

type SnapshotHistoryMeta = {
  historyByTrack: Map<string, TrackHistoryStats>;
  historyDaysTracked: number;
  previousSnapshotDate: string | null;
};

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

function getSignalCount(track: Pick<AggregatedTrack, "marketSignals" | "searchSignals">) {
  return track.marketSignals + track.searchSignals;
}

function parseSnapshotNumber(value: number | string | null) {
  const parsedValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getSnapshotDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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

function getTractionLabel(track: AggregatedTrack) {
  const signalCount = getSignalCount(track);

  if (track.popularity >= 75 || (track.marketSignals > 0 && track.popularity >= 68)) {
    return "Alta tracao";
  }

  if (track.popularity >= 55 || signalCount >= 3) {
    return "Media tracao";
  }

  return "Sinal inicial";
}

function getSaturationLabel(track: AggregatedTrack) {
  const signalCount = getSignalCount(track);

  if (signalCount <= 1) {
    return "Baixa saturacao";
  }

  if (signalCount >= 4) {
    return "Alta saturacao";
  }

  return "Saturacao moderada";
}

function getMomentumScore(track: AggregatedTrack, maxSignalCount: number) {
  const normalizedSignals =
    maxSignalCount > 0 ? getSignalCount(track) / maxSignalCount : 0;
  const editorialBonus = track.marketSignals > 0 ? 8 : 0;
  const hybridBonus = track.marketSignals > 0 && track.searchSignals > 0 ? 6 : 0;

  return clamp(
    Math.round(track.popularity * 0.6 + normalizedSignals * 26 + editorialBonus + hybridBonus),
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

  return clamp(
    Math.round(
      track.popularity * 0.48 +
        normalizedSignals * 18 +
        lowSaturationBonus +
        discoveryBonus +
        editorialBonus +
        hybridBonus -
        saturationPenalty,
    ),
    0,
    100,
  );
}

function sortTracks(tracks: AggregatedTrack[]) {
  return [...tracks].sort((left, right) => {
    const signalDifference = getSignalCount(right) - getSignalCount(left);

    if (signalDifference !== 0) {
      return signalDifference;
    }

    return right.popularity - left.popularity;
  });
}

function aggregateTracks(
  trackGroups: SpotifyTrackRecord[][],
  source: "market" | "search",
): AggregatedTrack[] {
  const trackMap = new Map<string, AggregatedTrack>();

  for (const group of trackGroups) {
    const seenInGroup = new Set<string>();

    for (const track of group) {
      const existing = trackMap.get(track.id);
      const artists = track.artists.join(", ");

      if (existing) {
        existing.popularity = Math.max(existing.popularity, track.popularity);
        existing.explicit = existing.explicit || track.explicit;
        existing.coverUrl = existing.coverUrl ?? track.coverUrl ?? null;
        existing.albumName = existing.albumName || track.albumName || "Unknown album";
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

  return sortTracks(Array.from(trackMap.values()));
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
  };
}

function mergeGenreAndMarketTracks(
  marketTracks: AggregatedTrack[],
  genreTracks: AggregatedTrack[],
  includeMarketUnion: boolean,
): AggregatedTrack[] {
  if (genreTracks.length === 0) {
    return sortTracks(marketTracks);
  }

  if (marketTracks.length === 0) {
    return sortTracks(genreTracks);
  }

  const marketTrackMap = new Map(
    marketTracks.map((track) => [track.id, track] as const),
  );

  if (!includeMarketUnion) {
    return sortTracks(
      genreTracks.map((track) => {
        const marketTrack = marketTrackMap.get(track.id);

        return marketTrack ? mergeTracks(track, marketTrack) : track;
      }),
    );
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

  return sortTracks(Array.from(mergedMap.values()));
}

function buildSnapshotRows(
  tracks: AggregatedTrack[],
  market: string,
  genre: string,
  snapshotDate: string,
  capturedAt: string,
): MusicTrackSnapshotInput[] {
  return tracks.map((track) => ({
    market,
    genre,
    track_id: track.id,
    snapshot_date: snapshotDate,
    captured_at: capturedAt,
    track_name: track.name,
    artists: track.artists,
    album_name: track.albumName,
    cover_url: track.coverUrl,
    spotify_url: track.spotifyUrl,
    popularity: track.popularity,
    signal_count: getSignalCount(track),
    source_mode: getTrackSignalSource(track),
    explicit: track.explicit,
  }));
}

function buildSnapshotHistoryMeta(
  rows: MusicTrackSnapshotRow[],
  currentSnapshotDate: string,
): SnapshotHistoryMeta {
  const uniqueDates = Array.from(
    new Set(
      rows
        .map((row) => row.snapshot_date)
        .filter((date): date is string => Boolean(date)),
    ),
  )
    .sort((left, right) => right.localeCompare(left));
  const previousSnapshotDate =
    uniqueDates.find((date) => date < currentSnapshotDate) ?? null;
  const rowsByTrack = new Map<string, MusicTrackSnapshotRow[]>();

  for (const row of rows) {
    const trackId = row.track_id;

    if (!trackId) {
      continue;
    }

    const trackRows = rowsByTrack.get(trackId);

    if (trackRows) {
      trackRows.push(row);
    } else {
      rowsByTrack.set(trackId, [row]);
    }
  }

  const historyByTrack = new Map<string, TrackHistoryStats>();

  for (const [trackId, trackRows] of rowsByTrack.entries()) {
    const sortedRows = [...trackRows].sort((left, right) => {
      const rightDate = right.snapshot_date ?? "";
      const leftDate = left.snapshot_date ?? "";

      if (rightDate !== leftDate) {
        return rightDate.localeCompare(leftDate);
      }

      return (right.captured_at ?? "").localeCompare(left.captured_at ?? "");
    });
    const latestSnapshot = sortedRows[0] ?? null;
    const previousSnapshot =
      sortedRows.find(
        (row) =>
          Boolean(row.snapshot_date) &&
          (row.snapshot_date ?? "") < currentSnapshotDate,
      ) ?? null;
    const snapshotCount = new Set(
      sortedRows
        .map((row) => row.snapshot_date)
        .filter((date): date is string => Boolean(date)),
    ).size;
    const previousDaySeen = previousSnapshotDate
      ? sortedRows.some((row) => row.snapshot_date === previousSnapshotDate)
      : false;

    historyByTrack.set(trackId, {
      snapshotCount,
      previousDaySeen,
      popularityDelta:
        latestSnapshot && previousSnapshot
          ? parseSnapshotNumber(latestSnapshot.popularity) -
            parseSnapshotNumber(previousSnapshot.popularity)
          : 0,
      signalDelta:
        latestSnapshot && previousSnapshot
          ? parseSnapshotNumber(latestSnapshot.signal_count) -
            parseSnapshotNumber(previousSnapshot.signal_count)
          : 0,
      latestSnapshot,
      previousSnapshot,
    });
  }

  return {
    historyByTrack,
    historyDaysTracked: uniqueDates.length,
    previousSnapshotDate,
  };
}

function buildSummaryCards(
  tracks: AggregatedTrack[],
  workbenchTracks: MusicWorkbenchTrack[],
  historyDaysTracked: number,
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
      value: formatCount(historyDaysTracked),
      caption:
        historyDaysTracked > 1
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
  tracks: AggregatedTrack[],
  historyMeta: SnapshotHistoryMeta,
): MusicTrackHighlight[] {
  const maxSignalCount = tracks.reduce(
    (maxValue, track) => Math.max(maxValue, getSignalCount(track)),
    0,
  );
  const hasHistory = historyMeta.historyDaysTracked > 1;
  const historyCandidates = tracks.filter((track) => {
    const history = historyMeta.historyByTrack.get(track.id);

    return Boolean(history?.previousSnapshot) && (history?.signalDelta ?? 0) > 0;
  });
  const source =
    hasHistory && historyCandidates.length > 0 ? historyCandidates : tracks;

  return [...source]
    .sort((left, right) => {
      const rightHistory = historyMeta.historyByTrack.get(right.id);
      const leftHistory = historyMeta.historyByTrack.get(left.id);
      const rightScore = rightHistory?.previousSnapshot
        ? rightHistory.signalDelta * 18 +
          rightHistory.popularityDelta * 4 +
          rightHistory.snapshotCount * 2
        : getMomentumScore(right, maxSignalCount);
      const leftScore = leftHistory?.previousSnapshot
        ? leftHistory.signalDelta * 18 +
          leftHistory.popularityDelta * 4 +
          leftHistory.snapshotCount * 2
        : getMomentumScore(left, maxSignalCount);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return right.popularity - left.popularity;
    })
    .slice(0, 6)
    .map((track) => {
      const source = getTrackSignalSource(track);
      const signalCount = getSignalCount(track);
      const history = historyMeta.historyByTrack.get(track.id);
      const hasPreviousSnapshot = Boolean(history?.previousSnapshot);

      return {
        id: track.id,
        name: track.name,
        artists: track.artists,
        coverUrl: track.coverUrl,
        spotifyUrl: track.spotifyUrl,
        badgeLabel:
          source === "hybrid"
            ? "Dominio hibrido"
            : source === "featured"
              ? "Forca editorial"
              : "Busca aquecida",
        primaryMetric: hasPreviousSnapshot
          ? `${formatSignedValue(history?.signalDelta ?? 0)} sinais`
          : `${getMomentumScore(track, maxSignalCount)} pts`,
        secondaryMetric: hasPreviousSnapshot
          ? `${history?.snapshotCount ?? 1} dias · ${formatSignedValue(history?.popularityDelta ?? 0)} pop`
          : `${signalCount} sinais · ${track.popularity} pop`,
        summary:
          hasPreviousSnapshot
            ? `Subiu ${formatSignedValue(history?.signalDelta ?? 0)} sinais e ${formatSignedValue(history?.popularityDelta ?? 0)} pontos de popularidade desde a ultima captura.`
            : source === "hybrid"
              ? "Dominando playlists destaque e busca ao mesmo tempo."
              : source === "featured"
                ? `Ja ganhou espaco editorial e sustenta ${signalCount} sinais ativos no radar.`
                : signalCount > 1
                  ? "Recorrencia forte nas buscas do radar, com espaco para escalar."
                  : "Faixa liderando o radar por performance acima da media.",
      };
    });
}

function buildNewEntries(
  tracks: AggregatedTrack[],
  excludedIds: Set<string>,
  historyMeta: SnapshotHistoryMeta,
): MusicTrackHighlight[] {
  const maxSignalCount = tracks.reduce(
    (maxValue, track) => Math.max(maxValue, getSignalCount(track)),
    0,
  );
  const hasHistoricalBaseline = Boolean(historyMeta.previousSnapshotDate);
  const historicalCandidates = tracks.filter((track) => {
    const history = historyMeta.historyByTrack.get(track.id);

    return !excludedIds.has(track.id) && !history?.previousDaySeen;
  });
  const candidates = tracks.filter((track) => {
    const signalCount = getSignalCount(track);

    return !excludedIds.has(track.id) && signalCount <= 2 && track.popularity >= 55;
  });
  const fallbackCandidates = tracks.filter(
    (track) => !excludedIds.has(track.id) && getSignalCount(track) <= 3,
  );
  const source = hasHistoricalBaseline
    ? historicalCandidates.length >= 4
      ? historicalCandidates
      : candidates.length >= 6
        ? candidates
        : fallbackCandidates
    : candidates.length >= 6
      ? candidates
      : fallbackCandidates;

  return [...source]
    .sort((left, right) => {
      const rightScore = getOpportunityScore(right, maxSignalCount);
      const leftScore = getOpportunityScore(left, maxSignalCount);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return right.popularity - left.popularity;
    })
    .slice(0, 6)
    .map((track) => {
      const signalCount = getSignalCount(track);
      const sourceLabel = getTrackSignalSource(track);
      const history = historyMeta.historyByTrack.get(track.id);
      const isNewToday = hasHistoricalBaseline && !history?.previousDaySeen;

      return {
        id: track.id,
        name: track.name,
        artists: track.artists,
        coverUrl: track.coverUrl,
        spotifyUrl: track.spotifyUrl,
        badgeLabel: isNewToday
          ? "Nova no radar"
          : signalCount <= 1
            ? "Early signal"
            : "Discovery wave",
        primaryMetric: isNewToday
          ? "Nova hoje"
          : `${getOpportunityScore(track, maxSignalCount)} pts`,
        secondaryMetric: isNewToday
          ? `${history?.snapshotCount ?? 1} dia · ${track.popularity} pop`
          : `${getSaturationLabel(track)} · ${track.popularity} pop`,
        summary:
          isNewToday
            ? "Nao aparecia na ultima leitura e entrou agora no radar deste mercado."
            : sourceLabel === "featured"
              ? "Entrou pelo radar editorial com pouca saturacao e bom potencial de descoberta."
              : signalCount <= 1
                ? "Ainda pouco saturada e pronta para discovery rapido."
                : "Sinal fresco com recorrencia inicial e chance de subir nas proximas leituras.",
      };
    });
}

function buildRecurringTracks(
  tracks: AggregatedTrack[],
  historyMeta: SnapshotHistoryMeta,
): TrackInsight[] {
  const historicalRecurring = tracks.filter((track) => {
    const history = historyMeta.historyByTrack.get(track.id);

    return Boolean(history) && history.snapshotCount >= 2;
  });
  const currentRecurring = tracks.filter(
    (track) => track.marketSignals >= 2 || getSignalCount(track) >= 3,
  );
  const fallback = tracks.filter((track) => getSignalCount(track) >= 2);
  const source =
    historicalRecurring.length > 0
      ? historicalRecurring
      : currentRecurring.length > 0
        ? currentRecurring
        : fallback.length > 0
          ? fallback
          : tracks;

  return [...source]
    .sort((left, right) => {
      const rightHistory = historyMeta.historyByTrack.get(right.id);
      const leftHistory = historyMeta.historyByTrack.get(left.id);
      const rightCount = rightHistory?.snapshotCount ?? 1;
      const leftCount = leftHistory?.snapshotCount ?? 1;

      if (rightCount !== leftCount) {
        return rightCount - leftCount;
      }

      const rightSignals = getSignalCount(right);
      const leftSignals = getSignalCount(left);

      if (rightSignals !== leftSignals) {
        return rightSignals - leftSignals;
      }

      return right.popularity - left.popularity;
    })
    .slice(0, 12)
    .map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists,
      artistIds: track.artistIds,
      albumName: track.albumName,
      popularity: track.popularity,
      playlistsCount: historyMeta.historyByTrack.get(track.id)?.snapshotCount ?? 1,
      durationLabel: formatDuration(track.durationMs),
      explicit: track.explicit,
      spotifyUrl: track.spotifyUrl,
      coverUrl: track.coverUrl,
    }));
}

function buildWorkbenchTracks(
  tracks: AggregatedTrack[],
  topMoverIds: Set<string>,
  newEntryIds: Set<string>,
  recurringIds: Set<string>,
  historyMeta: SnapshotHistoryMeta,
): MusicWorkbenchTrack[] {
  const maxSignalCount = tracks.reduce(
    (maxValue, track) => Math.max(maxValue, getSignalCount(track)),
    0,
  );

  const rankedTracks = [...tracks].sort((left, right) => {
    const rightHistory = historyMeta.historyByTrack.get(right.id);
    const leftHistory = historyMeta.historyByTrack.get(left.id);
    const rightScore =
      getOpportunityScore(right, maxSignalCount) +
      Math.max((rightHistory?.signalDelta ?? 0) * 8, 0) +
      Math.max((rightHistory?.popularityDelta ?? 0) * 2, 0) +
      (rightHistory?.snapshotCount ?? 1);
    const leftScore =
      getOpportunityScore(left, maxSignalCount) +
      Math.max((leftHistory?.signalDelta ?? 0) * 8, 0) +
      Math.max((leftHistory?.popularityDelta ?? 0) * 2, 0) +
      (leftHistory?.snapshotCount ?? 1);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const rightMomentum = getMomentumScore(right, maxSignalCount);
    const leftMomentum = getMomentumScore(left, maxSignalCount);

    if (rightMomentum !== leftMomentum) {
      return rightMomentum - leftMomentum;
    }

    return right.popularity - left.popularity;
  });

  return rankedTracks.map((track, index) => {
    const signalCount = getSignalCount(track);
    const source = getTrackSignalSource(track);
    const history = historyMeta.historyByTrack.get(track.id);
    const opportunityScore = getOpportunityScore(track, maxSignalCount);
    const highTraction =
      track.popularity >= 75 ||
      (track.marketSignals > 0 && track.popularity >= 68) ||
      opportunityScore >= 82;
    const lowSaturation = signalCount <= 2;
    const tags = [
      topMoverIds.has(track.id) ? "Mover" : null,
      newEntryIds.has(track.id) ? "Nova" : null,
      recurringIds.has(track.id) ? "Recorrente" : null,
      lowSaturation ? "Baixa saturacao" : null,
      track.explicit ? "Explicit" : null,
    ].filter((tag): tag is string => Boolean(tag));

    return {
      rank: index + 1,
      id: track.id,
      name: track.name,
      artists: track.artists,
      albumName: track.albumName,
      popularity: track.popularity,
      signalCount,
      durationLabel: formatDuration(track.durationMs),
      explicit: track.explicit,
      spotifyUrl: track.spotifyUrl,
      coverUrl: track.coverUrl,
      opportunityScore,
      sourceLabel: getSignalSourceLabel(source),
      signalSource: source,
      tractionLabel: getTractionLabel(track),
      saturationLabel: getSaturationLabel(track),
      historyLabel: history?.previousSnapshot
        ? `${history.snapshotCount} dias · ${formatSignedValue(history.signalDelta)} sinais`
        : history && history.snapshotCount > 1
          ? `${history.snapshotCount} dias no historico`
          : "Ainda sem base historica",
      tags,
      isMover: topMoverIds.has(track.id),
      isNewEntry: newEntryIds.has(track.id),
      isRecurring: recurringIds.has(track.id),
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
          return await fetchSpotifyPlaylistTracks(playlist.id, country);
        } catch {
          return [];
        }
      }),
    );

    return {
      featuredPlaylists: buildFeaturedPlaylistInsights(featuredPlaylists),
      aggregatedTracks: aggregateTracks(
        playlistTrackGroups.filter((group) => group.length > 0),
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
            query,
            tracks,
          };
        } catch {
          return {
            query,
            tracks: [] as SpotifyTrackRecord[],
          };
        }
      }),
    );

    const nonEmptyGroups = groups.filter((group) => group.tracks.length > 0);

    return {
      aggregatedTracks: aggregateTracks(
        nonEmptyGroups.map((group) => group.tracks),
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
  const snapshotDate = getSnapshotDateKey(new Date());
  const capturedAt = new Date().toISOString();

  if (focusTracks.length > 0) {
    await upsertMusicTrackSnapshots(
      buildSnapshotRows(
        focusTracks,
        marketOption.value,
        genreOption.value,
        snapshotDate,
        capturedAt,
      ),
    );
  }

  const historyMeta = buildSnapshotHistoryMeta(
    await fetchMusicTrackSnapshots({
      market: marketOption.value,
      genre: genreOption.value,
      days: 30,
    }),
    snapshotDate,
  );
  const topMovers = buildTopMovers(focusTracks, historyMeta);
  const topMoverIds = new Set(topMovers.map((track) => track.id));
  const newEntries = buildNewEntries(focusTracks, topMoverIds, historyMeta);
  const newEntryIds = new Set(newEntries.map((track) => track.id));
  const recurringTracks = buildRecurringTracks(focusTracks, historyMeta);
  const recurringIds = new Set(recurringTracks.map((track) => track.id));
  const workbenchTracks = buildWorkbenchTracks(
    focusTracks,
    topMoverIds,
    newEntryIds,
    recurringIds,
    historyMeta,
  );
  const dataTrust = buildDataTrustContext({
    tracks: focusTracks,
    featuredPlaylistCount: marketData.featuredPlaylists.length,
    activeQueryCount: genreData.activeQueryCount,
    historyDaysTracked: historyMeta.historyDaysTracked,
    countryLabel: marketOption.label,
    genreLabel: genreOption.label,
  });

  return {
    summaryCards: buildSummaryCards(
      focusTracks,
      workbenchTracks,
      historyMeta.historyDaysTracked,
    ),
    topTracks: buildTopTracks(focusTracks),
    artistDistribution: buildArtistDistribution(focusTracks),
    popularityHealth: buildPopularityHealth(focusTracks),
    tracks: buildTrackInsights(focusTracks),
    topMovers,
    newEntries,
    recurringTracks,
    workbenchTracks,
    opportunities: buildOpportunities(
      focusTracks,
      marketOption.label,
      genreOption.label,
    ),
    featuredPlaylists: marketData.featuredPlaylists,
    dataTrust,
    countryValue: marketOption.value,
    countryLabel: marketOption.label,
    genreValue: genreOption.value,
    genreLabel: genreOption.label,
  };
}
