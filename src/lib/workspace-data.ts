import "server-only";

import { subDays } from "date-fns";
import {
  getSnapshotByDate,
  getSnapshotDates,
  getSnapshotTracks,
  getSnapshotWithComparison,
  type ChartSnapshotTrack,
} from "@/lib/chart-snapshots";
import { getChartsData } from "@/lib/charts-data";
import { getDashboardData } from "@/lib/dashboard-data";
import {
  type TrackGenre,
} from "@/lib/genre-detection";
import { getMusicChartsData, getMusicGenreOptions, getMusicMarketOptions } from "@/lib/music-charts-data";
import {
  fetchPlaylistSnapshots,
  type PlaylistSnapshotRow,
} from "@/lib/playlist-snapshot-store";
import {
  extractSpotifyPlaylistId,
  fetchSpotifyPlaylistTracks,
} from "@/lib/spotify";
import {
  buildSpotifyAccountProfile,
  extractSpotifyArtistNames as extractArtistNames,
  getSpotifyGenreDisplayLabel as getGenreDisplayLabel,
  resolveSpotifyTrackGenre as resolveTrackGenre,
  type SpotifyAccountProfile as DashboardAccountProfile,
} from "@/lib/spotify-account-profile";
import {
  fetchSpotifyAccountPlaylists,
} from "@/lib/spotify-user";
import { getCurrentWorkspaceContext } from "@/lib/workspaces";
import { fetchTikTokPublicChart, type TikTokPublicChartTrack } from "@/lib/tiktok-public-charts";
import type { PlaylistRecord } from "@/types/dashboard";
import type { TrackInsight } from "@/types/charts";
import type {
  MusicArtistDominance,
  MusicGenreHeat,
  MusicMovementContext,
  MusicWorkbenchTrack,
} from "@/types/music-charts";
import type {
  CurationPageData,
  DashboardEditorialSpotlight,
  DashboardWorkspaceData,
  DecisionTrack,
  HeroInsight,
  MovementDescriptor,
  MovementType,
  PeriodFilter,
  PlaylistBaseData,
  PlaylistBaseRow,
  RadarMusicEditorialHero,
  RadarMusicGenreSpotlight,
  RadarMusicPageData,
  RadarMusicRow,
  RadarMusicSummaryCard,
  RadarPlaylistRow,
  RadarPlaylistsData,
  RadarStatusFilter,
  StatusTone,
  WorkspaceMetric,
} from "@/types/workspace";

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Novas" },
  { value: "up", label: "Subindo" },
  { value: "down", label: "Caindo" },
  { value: "recurring", label: "Recorrentes" },
  { value: "low-saturation", label: "Baixa saturacao" },
] as const;

const RADAR_GENRE_LANES: Record<string, string[]> = {
  BR: ["trap", "funk", "rap", "pop", "sertanejo"],
  US: ["hip-hop", "rap", "pop", "r-n-b", "electronic"],
  MX: ["latin", "reggaeton", "pop", "rap", "indie"],
  AR: ["trap", "latin", "pop", "reggaeton", "indie"],
  CO: ["reggaeton", "latin", "trap", "pop", "rap"],
  ES: ["reggaeton", "latin", "pop", "indie", "house"],
  PT: ["trap", "hip-hop", "pop", "house", "electronic"],
  FR: ["rap", "pop", "electronic", "house", "r-n-b"],
  GB: ["hip-hop", "house", "pop", "electronic", "r-n-b"],
};

const GENRE_CHIP_COPY: Record<string, string> = {
  all: "Radar amplo",
  trap: "Trap em foco",
  funk: "Funk em foco",
  rap: "Rap em foco",
  "hip-hop": "Hip hop em foco",
  pop: "Pop em foco",
  sertanejo: "Sertanejo em foco",
  latin: "Latin em foco",
  reggaeton: "Reggaeton em foco",
  electronic: "Electronic em foco",
  house: "House em foco",
  indie: "Indie em foco",
  "r-n-b": "R&B em foco",
};

type DashboardAccountSignals = {
  alreadyInPlaylists: boolean;
  fitLabel: string;
  accountPlaylistCount: number;
  accountPlaylistNames: string[];
  accountArtistCount: number;
  accountGenre: string;
  accountGenreStrength: number;
  accountFitContext: string;
  suggestedPlaylistName: string | null;
};

function inferTargetPlaylistName({
  accountProfile,
  trackId,
  artistNames,
  genre,
}: {
  accountProfile: DashboardAccountProfile;
  trackId: string;
  artistNames: string[];
  genre: TrackGenre;
}) {
  let bestMatch: { name: string; score: number } | null = null;

  for (const playlist of accountProfile.playlistTargets) {
    if (playlist.trackIds.has(trackId)) {
      continue;
    }

    let score = 0;

    if (genre !== "unknown") {
      if (playlist.genre === genre) {
        score += 28;
      } else {
        score += Math.min((playlist.genreCounts.get(genre) ?? 0) * 4, 20);
      }
    }

    const matchingArtists = artistNames.filter((artist) =>
      playlist.artistNames.has(artist),
    ).length;

    score += matchingArtists * 12;

    if (score >= 18 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        name: playlist.name,
        score,
      };
    }
  }

  return bestMatch?.name ?? null;
}

function buildAccountSignals({
  accountProfile,
  trackId,
  artists,
  trackName,
  genreLabel,
  fallbackAlreadyInPlaylists,
  fallbackArtistFit,
  lowSaturation,
  recurring,
  rank,
  weeklyRankChange,
}: {
  accountProfile: DashboardAccountProfile | null;
  trackId: string;
  artists: string;
  trackName: string;
  genreLabel: string | null | undefined;
  fallbackAlreadyInPlaylists: boolean;
  fallbackArtistFit: boolean;
  lowSaturation: boolean;
  recurring: boolean;
  rank: number;
  weeklyRankChange: number | null;
}): DashboardAccountSignals {
  if (!accountProfile) {
    const fitLabel = fallbackAlreadyInPlaylists
      ? "Fit alto"
      : fallbackArtistFit || lowSaturation || recurring || rank <= 50 || (weeklyRankChange ?? 0) >= 8
        ? "Fit medio"
        : "Fit baixo";

    return {
      alreadyInPlaylists: fallbackAlreadyInPlaylists,
      fitLabel,
      accountPlaylistCount: fallbackAlreadyInPlaylists ? 1 : 0,
      accountPlaylistNames: [],
      accountArtistCount: fallbackArtistFit ? 1 : 0,
      accountGenre: getGenreDisplayLabel(resolveTrackGenre(genreLabel, artists, trackName)) ?? "Radar aberto",
      accountGenreStrength: 0,
      accountFitContext: fallbackAlreadyInPlaylists
        ? "Ja esta na base monitorada"
        : fallbackArtistFit
          ? "Artista ja funciona na base monitorada"
          : lowSaturation
            ? "Janela de discovery aberta"
            : "Ainda fora da base atual",
      suggestedPlaylistName: null,
    };
  }

  const accountPlaylistNames = accountProfile.trackPlaylistNamesById.get(trackId) ?? [];
  const accountPlaylistCount = accountPlaylistNames.length;
  const artistNames = extractArtistNames(artists);
  const accountArtistCount = Math.max(
    0,
    ...artistNames.map(
      (artistName) => accountProfile.artistPlaylistCountByName.get(artistName) ?? 0,
    ),
  );
  const accountGenreType = resolveTrackGenre(genreLabel, artists, trackName);
  const accountGenreLabel = getGenreDisplayLabel(accountGenreType) ?? "Radar aberto";
  const accountGenreStrength =
    accountGenreType === "unknown"
      ? 0
      : accountProfile.genreTrackCountByType.get(accountGenreType) ?? 0;
  const suggestedPlaylistName =
    accountPlaylistCount > 0
      ? null
      : inferTargetPlaylistName({
          accountProfile,
          trackId,
          artistNames,
          genre: accountGenreType,
        });
  const fitSignal =
    accountPlaylistCount * 18 +
    accountArtistCount * 5 +
    Math.min(accountGenreStrength, 12) +
    (suggestedPlaylistName ? 8 : 0);
  const fitLabel =
    accountPlaylistCount >= 2 || fitSignal >= 30
      ? "Fit alto"
      : accountPlaylistCount >= 1 ||
          accountArtistCount >= 1 ||
          accountGenreStrength >= 4 ||
          Boolean(suggestedPlaylistName) ||
          lowSaturation ||
          recurring
        ? "Fit medio"
        : "Fit baixo";

  let accountFitContext = "Ainda sem ancora forte na tua base";

  if (accountPlaylistCount >= 2) {
    accountFitContext = `Ja aparece em ${accountPlaylistCount} playlists da conta`;
  } else if (accountPlaylistCount === 1) {
    accountFitContext = `Ja esta em ${accountPlaylistNames[0]}`;
  } else if (suggestedPlaylistName) {
    accountFitContext = `Boa candidata para ${suggestedPlaylistName}`;
  } else if (accountArtistCount >= 3) {
    accountFitContext = `Artista recorrente em ${accountArtistCount} playlists da conta`;
  } else if (accountGenreStrength >= 6 && accountGenreType !== "unknown") {
    accountFitContext = `${accountGenreLabel} com espaco forte na tua base`;
  } else if (lowSaturation) {
    accountFitContext = "Janela de discovery fora da base";
  }

  return {
    alreadyInPlaylists: accountPlaylistCount > 0,
    fitLabel,
    accountPlaylistCount,
    accountPlaylistNames,
    accountArtistCount,
    accountGenre: accountGenreLabel,
    accountGenreStrength,
    accountFitContext,
    suggestedPlaylistName,
  };
}

async function buildDashboardAccountProfile(): Promise<DashboardAccountProfile | null> {
  const { result } = await fetchSpotifyAccountPlaylists();

  if (!result.connected || result.playlists.length === 0) {
    return null;
  }

  return buildSpotifyAccountProfile(result.playlists);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function formatSignedCount(value: number) {
  const roundedValue = Math.round(value);

  if (roundedValue > 0) {
    return `+${formatCount(roundedValue)}`;
  }

  if (roundedValue < 0) {
    return `-${formatCount(Math.abs(roundedValue))}`;
  }

  return "0";
}

function formatSignedValue(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function formatStreamsValue(value: number | null) {
  return value === null ? "Sem dado de streams" : `${formatCount(value)} streams 24h`;
}

function formatStreamRankValue(value: number | null) {
  return value === null ? "Sem dado de streams" : `#${value} por streams`;
}

function formatStreamGrowthValue(
  dailyStreams: number | null,
  streamGrowth: number | null,
) {
  if (dailyStreams === null) {
    return "Sem dado de streams";
  }

  if (streamGrowth === null) {
    return "Sem historico";
  }

  if (streamGrowth === 0) {
    return "0 em streams";
  }

  return `${formatSignedCount(streamGrowth)} em streams`;
}

function formatPercentage(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "Sem registro";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

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

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(Math.max(value, minValue), maxValue);
}

function getPeriodLabel(period: PeriodFilter) {
  return PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "7 dias";
}

function normalizePeriod(value?: string): PeriodFilter {
  return value === "today" || value === "30d" ? value : "7d";
}

function normalizeStatus(value?: string): RadarStatusFilter {
  switch (value) {
    case "new":
    case "up":
    case "down":
    case "recurring":
    case "low-saturation":
      return value;
    default:
      return "all";
  }
}

function buildMovementDescriptor(type: MovementType): MovementDescriptor {
  switch (type) {
    case "up":
      return {
        type,
        label: "Subiu",
        icon: "▲",
        tone: "green",
        valueLabel: "▲",
      };
    case "down":
      return {
        type,
        label: "Caiu",
        icon: "▼",
        tone: "red",
        valueLabel: "▼",
      };
    case "same":
      return {
        type,
        label: "Estavel",
        icon: "●",
        tone: "slate",
        valueLabel: "●",
      };
    case "reentry":
      return {
        type,
        label: "RE",
        icon: "RE",
        tone: "purple",
        valueLabel: "RE",
      };
    default:
      return {
        type,
        label: "NEW",
        icon: "NEW",
        tone: "purple",
        valueLabel: "NEW",
      };
  }
}

function getMovementComponentScore(
  movementType: MovementType,
  rankChange: number | null,
) {
  if (movementType === "new") {
    return 82;
  }

  if (movementType === "reentry") {
    return 74;
  }

  if (rankChange === null) {
    return 50;
  }

  return clamp(50 + rankChange * 6, 0, 100);
}

function getFitComponentScore(fitLabel: string) {
  switch (fitLabel) {
    case "Fit alto":
      return 88;
    case "Fit medio":
      return 64;
    default:
      return 36;
  }
}

function getBreakdownTone(value: number): StatusTone {
  if (value >= 75) {
    return "green";
  }

  if (value >= 55) {
    return "yellow";
  }

  if (value >= 40) {
    return "blue";
  }

  return "red";
}

function buildRadarRows(
  workbenchTracks: MusicWorkbenchTrack[],
  playlistTracks: TrackInsight[],
  dominantArtists: string[],
): RadarMusicRow[] {
  const playlistTrackIds = new Set(playlistTracks.map((track) => track.id));

  return workbenchTracks.map((track) => {
    const alreadyInPlaylists = playlistTrackIds.has(track.id);
    const normalizedArtists = track.artists.toLowerCase();
    const artistFit = dominantArtists.some((artist) =>
      normalizedArtists.includes(artist.toLowerCase()),
    );
    const fitLabel = alreadyInPlaylists || artistFit
      ? "Fit alto"
      : track.lowSaturation || track.daysOnChart >= 3
        ? "Fit medio"
        : "Fit baixo";
    const movementType = track.movementType;

    return {
      rank: track.rank,
      movement: buildMovementDescriptor(movementType),
      trackId: track.id,
      spotifyTrackId: track.id,
      name: track.name,
      artists: track.artists,
      genre: track.genre,
      albumName: track.albumName,
      popularity: track.popularity,
      dailyStreams: track.dailyStreams,
      streamRank: track.streamRank,
      streamGrowth: track.streamGrowth,
      streamGrowthPercent: null,
      streamVelocityLabel: track.streamVelocityLabel,
      popularityChange: track.popularityChange,
      previousRank: track.previousRank,
      rankChange: track.rankChange,
      daysOnRadar: track.daysOnChart,
      saturationCount: track.saturationCount,
      opportunityScore: track.opportunityScore,
      spotifyUrl: track.spotifyUrl,
      coverUrl: track.coverUrl,
      statusTags: track.tags,
      intelligenceTags: track.intelligenceTags,
      tiktokViral: false,
      tiktokRank: null,
      tiktokSnapshotDate: null,
      tiktokMovementLabel: null,
      lowSaturation: track.lowSaturation,
      recurring: track.daysOnChart >= 3 || track.isRecurring,
      alreadyInPlaylists,
      fitLabel,
      scoreBreakdown: buildScoreBreakdown({
        popularity: track.popularity,
        movementType,
        rankChange: track.rankChange,
        lowSaturation: track.lowSaturation,
        recurring: track.daysOnChart >= 3 || track.isRecurring,
        fitLabel,
      }),
    };
  });
}

function normalizeRadarMatchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\((feat|ft|with)[^)]+\)/gi, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildRadarMatchVariants(value: string) {
  const normalized = normalizeRadarMatchText(value);

  if (!normalized) {
    return [];
  }

  const compact = normalized
    .replace(/\b(feat|ft|with)\b.*$/i, "")
    .replace(/\b(slowed|sped up|speed up|instrumental|acoustic|remix|live)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return Array.from(new Set([normalized, compact].filter(Boolean)));
}

function artistNamesOverlap(left: string, right: string) {
  const leftTokens = buildRadarMatchVariants(left)
    .flatMap((value) => value.split(/\s*&\s*|\s*,\s*|\s+x\s+/))
    .map((value) => value.trim())
    .filter((value) => value.length >= 3);
  const rightTokens = new Set(
    buildRadarMatchVariants(right)
      .flatMap((value) => value.split(/\s*&\s*|\s*,\s*|\s+x\s+/))
      .map((value) => value.trim())
      .filter((value) => value.length >= 3),
  );

  return leftTokens.some((token) => rightTokens.has(token));
}

function trackNamesMatch(left: string, right: string) {
  const leftVariants = buildRadarMatchVariants(left);
  const rightVariants = buildRadarMatchVariants(right);

  return leftVariants.some((leftVariant) =>
    rightVariants.some(
      (rightVariant) =>
        leftVariant === rightVariant ||
        leftVariant.includes(rightVariant) ||
        rightVariant.includes(leftVariant),
    ),
  );
}

function getTikTokMovementBoost(movementLabel: string | null | undefined) {
  if (!movementLabel) {
    return 4;
  }

  if (movementLabel === "NEW") {
    return 10;
  }

  if (movementLabel.startsWith("+")) {
    return clamp(Number(movementLabel.replace(/\D/g, "")) * 2, 4, 14);
  }

  if (movementLabel.startsWith("-")) {
    return -4;
  }

  return 3;
}

function getTikTokRankBoost(rank: number) {
  if (rank <= 10) {
    return 14;
  }

  if (rank <= 25) {
    return 11;
  }

  if (rank <= 50) {
    return 8;
  }

  return 5;
}

function enrichRadarRowsWithTikTokSignals(
  rows: RadarMusicRow[],
  tiktokTracks: TikTokPublicChartTrack[],
  snapshotDate: string | null,
) {
  const matchedTrackIds = new Set<string>();
  const tracksBySpotifyId = new Map(
    tiktokTracks
      .filter((track) => Boolean(track.spotifyTrackId))
      .map((track) => [track.spotifyTrackId as string, track]),
  );

  const enrichedRows = rows.map((row) => {
    const matchedTikTokTrack =
      (row.spotifyTrackId ? tracksBySpotifyId.get(row.spotifyTrackId) : null) ??
      tiktokTracks.find(
        (track) =>
          trackNamesMatch(row.name, track.trackName) &&
          artistNamesOverlap(row.artists, track.artistName),
      );

    if (!matchedTikTokTrack) {
      return row;
    }

    matchedTrackIds.add(row.trackId);
    const tiktokBoost =
      getTikTokRankBoost(matchedTikTokTrack.rank) +
      getTikTokMovementBoost(matchedTikTokTrack.movementLabel) +
      (!row.alreadyInPlaylists && row.lowSaturation ? 4 : 0);

    return {
      ...row,
      tiktokViral: true,
      tiktokRank: matchedTikTokTrack.rank,
      tiktokSnapshotDate: snapshotDate,
      tiktokMovementLabel: matchedTikTokTrack.movementLabel,
      opportunityScore: clamp(row.opportunityScore + tiktokBoost, 0, 100),
      intelligenceTags: Array.from(
        new Set([
          `TikTok #${matchedTikTokTrack.rank}`,
          matchedTikTokTrack.movementLabel === "NEW"
            ? "TikTok novo"
            : matchedTikTokTrack.movementLabel.startsWith("+")
              ? "TikTok acelerando"
              : matchedTikTokTrack.movementLabel.startsWith("-")
                ? "TikTok esfriando"
                : "TikTok estavel",
          ...row.intelligenceTags,
        ]),
      ),
    };
  });

  return {
    rows: enrichedRows.sort((left, right) => {
      if (left.tiktokViral !== right.tiktokViral) {
        return left.tiktokViral ? -1 : 1;
      }

      return left.rank - right.rank;
    }),
    matches: enrichedRows.filter((row) => matchedTrackIds.has(row.trackId)),
  };
}

function filterRadarRows(
  rows: RadarMusicRow[],
  status: RadarStatusFilter,
): RadarMusicRow[] {
  switch (status) {
    case "new":
      return rows.filter(
        (row) => row.movement.type === "new" || row.movement.type === "reentry",
      );
    case "up":
      return rows.filter((row) => row.movement.type === "up");
    case "down":
      return rows.filter((row) => row.movement.type === "down");
    case "recurring":
      return rows.filter((row) => row.recurring);
    case "low-saturation":
      return rows.filter((row) => row.lowSaturation);
    default:
      return rows;
  }
}

function buildRadarMusicSummary(
  rows: RadarMusicRow[],
  hasSufficientHistory: boolean,
): RadarMusicSummaryCard[] {
  const topTrack = rows[0];
  const biggestRise = [...rows]
    .filter((row) => (row.rankChange ?? 0) > 0)
    .sort((left, right) => (right.rankChange ?? 0) - (left.rankChange ?? 0))[0];
  const biggestDrop = [...rows]
    .filter((row) => (row.rankChange ?? 0) < 0)
    .sort((left, right) => (left.rankChange ?? 0) - (right.rankChange ?? 0))[0];
  const newEntries = rows.filter(
    (row) => row.movement.type === "new" || row.movement.type === "reentry",
  ).length;
  const opportunities = rows.filter(
    (row) => row.lowSaturation && row.opportunityScore >= 70,
  ).length;
  const firstNewEntry = rows.find(
    (row) => row.movement.type === "new" || row.movement.type === "reentry",
  );
  const topOpportunity = rows.find(
    (row) => row.lowSaturation && row.opportunityScore >= 70,
  );

  return [
    {
      title: "Top musica agora",
      value: topTrack?.name ?? "Sem dado",
      helper: topTrack
        ? topTrack.dailyStreams === null
          ? "Sem dado de streams"
          : `${formatStreamsValue(topTrack.dailyStreams)} · ${formatStreamRankValue(topTrack.streamRank)}`
        : "Sem leitura",
      tone: "green" as const,
      coverUrl: topTrack?.coverUrl ?? null,
      accentLabel: topTrack?.artists ?? "Mercado em leitura",
      detail: topTrack
        ? `${topTrack.genre} · variação ${topTrack.rankChange === null ? topTrack.movement.label : formatSignedValue(topTrack.rankChange)} · ${formatStreamGrowthValue(topTrack.dailyStreams, topTrack.streamGrowth)}`
        : "Sem faixa lider agora",
    },
    {
      title: "Maior subida",
      value: biggestRise?.name ?? "Historico em coleta",
      helper:
        biggestRise && biggestRise.rankChange !== null
          ? `${formatSignedValue(biggestRise.rankChange)} posicoes · ${formatStreamsValue(biggestRise.dailyStreams)}`
          : "Sem comparacao valida ainda",
      tone: "green" as const,
      coverUrl: biggestRise?.coverUrl ?? null,
      accentLabel: biggestRise?.movement.label ?? "Sem movimento",
      detail: biggestRise
        ? `${biggestRise.artists} ganhou espaco no chart · ${formatStreamGrowthValue(biggestRise.dailyStreams, biggestRise.streamGrowth)}`
        : hasSufficientHistory
          ? "Nenhuma faixa acelerou acima da media neste recorte."
          : "Historico insuficiente para leitura de subida. Continue coletando snapshots.",
    },
    {
      title: "Maior queda",
      value: biggestDrop?.name ?? "Historico em coleta",
      helper:
        biggestDrop && biggestDrop.rankChange !== null
          ? `${formatSignedValue(biggestDrop.rankChange)} posicoes · ${formatStreamsValue(biggestDrop.dailyStreams)}`
          : "Sem comparacao valida ainda",
      tone: "red" as const,
      coverUrl: biggestDrop?.coverUrl ?? null,
      accentLabel: biggestDrop?.movement.label ?? "Sem movimento",
      detail: biggestDrop
        ? `${biggestDrop.artists} perdeu tracao neste recorte · ${formatStreamGrowthValue(biggestDrop.dailyStreams, biggestDrop.streamGrowth)}`
        : hasSufficientHistory
          ? "Mercado estavel: nenhuma queda forte apareceu neste recorte."
          : "Historico insuficiente para leitura de queda. Continue coletando snapshots.",
    },
    {
      title: "Novas entradas",
      value: formatCount(newEntries),
      helper: "Novas ou retornando",
      tone: "purple" as const,
      coverUrl: firstNewEntry?.coverUrl ?? null,
      accentLabel: `${newEntries} tracks`,
      detail: firstNewEntry
        ? `${formatStreamsValue(firstNewEntry.dailyStreams)} · ${formatStreamRankValue(firstNewEntry.streamRank)}`
        : "Entrada fresca para discovery e playlist building.",
    },
    {
      title: "Oportunidades",
      value: formatCount(opportunities),
      helper: "Baixa saturacao",
      tone: "yellow" as const,
      coverUrl: topOpportunity?.coverUrl ?? null,
      accentLabel: `${opportunities} janelas`,
      detail: topOpportunity
        ? `${formatStreamsValue(topOpportunity.dailyStreams)} · ${formatStreamGrowthValue(topOpportunity.dailyStreams, topOpportunity.streamGrowth)}`
        : "Faixas prontas para virar recorte editorial novo.",
    },
  ];
}

function buildRadarMusicEditorialHero({
  rows,
  countryLabel,
  genreLabel,
  periodLabel,
  movementContext,
  hottestGenres,
  dominantArtists,
}: {
  rows: RadarMusicRow[];
  countryLabel: string;
  genreLabel: string;
  periodLabel: string;
  movementContext: MusicMovementContext;
  hottestGenres: MusicGenreHeat[];
  dominantArtists: MusicArtistDominance[];
}): RadarMusicEditorialHero {
  const leader = rows[0];

  if (!leader) {
    return {
      badge: "Mercado em observacao",
      headline: "Ainda sem um lider claro para destacar neste radar",
      summary:
        "Assim que o sistema receber sinais suficientes, a capa e o destaque principal aparecem aqui com prioridade editorial.",
      coverUrl: null,
      trackName: "Sem lider",
      artists: "Mercado em leitura",
      rankLabel: "Sem rank",
      movementLabel: "Sem historico",
      genreLabel,
      countryLabel,
      periodLabel,
      spotifyUrl: "#",
      stats: [
        {
          label: "Faixas ativas",
          value: formatCount(rows.length),
          tone: "blue",
        },
      ],
    };
  }

  const dominantArtist = dominantArtists.find((artist) => artist.top20Count >= 3);
  const hottestGenre = hottestGenres[0];
  const biggestRise = [...rows]
    .filter((row) => (row.rankChange ?? 0) > 0)
    .sort((left, right) => (right.rankChange ?? 0) - (left.rankChange ?? 0))[0];

  let headline = `${leader.name} lidera o radar com score ${leader.opportunityScore}`;
  let summary =
    "A leitura atual cruza rank, movimento, recorrencia e saturacao para apontar o que merece playlist agora.";

  if (!movementContext.hasSufficientHistory) {
    headline = `${leader.name} lidera o radar com score ${leader.opportunityScore}`;
    summary =
      "Historico insuficiente para leitura de movimento. Continue coletando snapshots para liberar setas de subida, queda e reentrada com confianca.";
  } else if (dominantArtist) {
    headline = `${dominantArtist.artistName} domina o chart com ${dominantArtist.top20Count} faixas no top 20`;
    summary =
      "Concentracao forte de repertorio em um mesmo artista, sinal de dominio claro do recorte atual.";
  } else if (leader.tiktokViral && leader.tiktokRank !== null) {
    headline = `${leader.name} confirmou Spotify + TikTok com TikTok #${leader.tiktokRank}`;
    summary =
      "Quando uma faixa aparece forte nas duas plataformas, o radar sobe a prioridade porque a chance de virar decisao editorial boa no dia aumenta bastante.";
  } else if (
    hottestGenre &&
    hottestGenre.genre !== "all" &&
    hottestGenre.opportunityCount >= 3
  ) {
    headline = `${hottestGenre.genreLabel} esta aquecendo com ${hottestGenre.opportunityCount} oportunidades`;
    summary =
      "O genero mais quente do radar combina score alto com baixa saturacao e abre frente boa para playlist building.";
  } else if (biggestRise && (biggestRise.rankChange ?? 0) >= 5) {
    headline = `${biggestRise.name} subiu ${biggestRise.rankChange} posicoes e virou prioridade de curadoria`;
    summary =
      "A maior alta do periodo ganhou terreno real no chart e merece teste imediato nas playlists certas.";
  }

  return {
    badge: `${countryLabel} · ${periodLabel}`,
    headline,
    summary,
    coverUrl: leader.coverUrl,
    trackName: leader.name,
    artists: leader.artists,
    rankLabel: `#${leader.rank} no radar`,
    movementLabel:
      leader.rankChange === null
        ? leader.movement.label
        : `${leader.movement.label} ${formatSignedValue(leader.rankChange)}`,
    genreLabel,
    countryLabel,
    periodLabel,
    spotifyUrl: leader.spotifyUrl,
    stats: [
      {
        label: "Streams 24h",
        value:
          leader.dailyStreams === null
            ? "Sem dado de streams"
            : formatCount(leader.dailyStreams),
        tone: "purple",
      },
      {
        label: "Rank streams",
        value:
          leader.streamRank === null
            ? "Sem dado de streams"
            : `#${leader.streamRank}`,
        tone: "green",
      },
      {
        label: "Cresc. 24h",
        value:
          leader.dailyStreams === null
            ? "Sem dado de streams"
            : leader.streamGrowth === null
              ? "Sem historico"
              : formatSignedCount(leader.streamGrowth),
        tone: "yellow",
      },
      {
        label: "TikTok",
        value: leader.tiktokViral
          ? leader.tiktokRank !== null
            ? `#${leader.tiktokRank}`
            : "Viral"
          : "Nao cruzou",
        tone: leader.tiktokViral ? "blue" : "slate",
      },
    ],
  };
}

function buildRadarMusicGenreSpotlights({
  rows,
  countryValue,
  countryLabel,
  selectedGenre,
  selectedGenreLabel,
  selectedPeriod,
  hottestGenres,
}: {
  rows: RadarMusicRow[];
  countryValue: string;
  countryLabel: string;
  selectedGenre: string;
  selectedGenreLabel: string;
  selectedPeriod: PeriodFilter;
  hottestGenres: MusicGenreHeat[];
}): RadarMusicGenreSpotlight[] {
  const genreOptions = getMusicGenreOptions();
  const spotlightValues = Array.from(
    new Set(
      [
        selectedGenre === "all" ? "all" : selectedGenre,
        ...hottestGenres.map((genre) => genre.genre),
        ...(RADAR_GENRE_LANES[countryValue] ?? RADAR_GENRE_LANES.BR),
      ].filter(Boolean),
    ),
  ).slice(0, 5);

  return spotlightValues.map((value, index) => {
    const option =
      genreOptions.find((item) => item.value === value) ??
      genreOptions.find((item) => item.value === "all") ??
      genreOptions[0];
    const genreInsight = hottestGenres.find((genre) => genre.genre === option.value);
    const sampleRow =
      value === selectedGenre
        ? rows[0]
        : rows[Math.min(index + 1, Math.max(rows.length - 1, 0))];
    const params = new URLSearchParams({
      country: countryValue,
      genre: option.value,
      period: selectedPeriod,
      status: "all",
    });

    return {
      value: option.value,
      label: option.label,
      description:
        option.value === selectedGenre
          ? `${selectedGenreLabel} lidera o radar em ${countryLabel}.`
          : genreInsight
            ? `${genreInsight.opportunityCount} oportunidades abertas em ${option.label.toLowerCase()}.`
            : `Abrir recorte editorial de ${option.label.toLowerCase()} em ${countryLabel}.`,
      href: `/radar-music?${params.toString()}`,
      coverUrl: genreInsight?.leaderCoverUrl ?? sampleRow?.coverUrl ?? null,
      chipLabel:
        option.value === selectedGenre
          ? "Recorte ativo"
          : GENRE_CHIP_COPY[option.value] ?? "Radar editorial",
      tone:
        option.value === selectedGenre
          ? "green"
          : option.value === "funk" || option.value === "sertanejo"
            ? "yellow"
            : option.value === "rap" || option.value === "trap"
              ? "purple"
              : option.value === "pop"
                ? "blue"
                : "slate",
      isActive: option.value === selectedGenre,
    };
  });
}

function buildPlaylistMetrics(playlists: PlaylistRecord[]): WorkspaceMetric[] {
  const followersTotal = playlists.reduce(
    (sum, playlist) => sum + playlist.followers,
    0,
  );
  const averageScore =
    playlists.length > 0
      ? playlists.reduce((sum, playlist) => sum + playlist.score, 0) /
        playlists.length
      : 0;
  const bestPlaylist = [...playlists].sort(
    (left, right) => right.score - left.score,
  )[0];

  return [
    {
      title: "Playlists monitoradas",
      value: formatCount(playlists.length),
      helper: "Base ativa",
      tone: "blue",
    },
    {
      title: "Followers somados",
      value: formatCount(followersTotal),
      helper: "Alcance atual",
      tone: "green",
    },
    {
      title: "Score medio",
      value: averageScore.toFixed(1),
      helper: "Qualidade media",
      tone: "yellow",
    },
    {
      title: "Melhor playlist",
      value: bestPlaylist?.name ?? "Sem playlist",
      helper: bestPlaylist ? `Score ${bestPlaylist.score}` : "Sem score",
      tone: "purple",
    },
  ];
}

function buildPlaylistGrowth(
  playlist: PlaylistRecord,
  snapshots: PlaylistSnapshotRow[],
): Pick<PlaylistBaseRow, "growthLabel" | "growthTone" | "lastUpdatedLabel"> {
  const playlistSnapshots = snapshots.filter(
    (snapshot) => snapshot.playlist_id === playlist.id,
  );
  const latest = playlistSnapshots[0];
  const previous = playlistSnapshots[1];

  if (latest && previous) {
    const delta = toNumber(latest.followers) - toNumber(previous.followers);

    return {
      growthLabel: delta === 0 ? "Estavel" : `${formatSignedValue(delta)} seguidores`,
      growthTone: delta > 0 ? "green" : delta < 0 ? "red" : "blue",
      lastUpdatedLabel: formatDateLabel(latest.captured_at),
    };
  }

  const createdAt = playlist.createdAt;
  const createdDate = createdAt ? new Date(createdAt) : null;
  const isNew =
    createdDate &&
    !Number.isNaN(createdDate.getTime()) &&
    createdDate.getTime() >= subDays(new Date(), 7).getTime();

  return {
    growthLabel: isNew ? "Nova na base" : "Sem historico",
    growthTone: isNew ? "purple" : "slate",
    lastUpdatedLabel: formatDateLabel(createdAt),
  };
}

function buildScoreBreakdown({
  popularity,
  movementType,
  rankChange,
  lowSaturation,
  recurring,
  fitLabel,
}: {
  popularity: number;
  movementType: MovementType;
  rankChange: number | null;
  lowSaturation: boolean;
  recurring: boolean;
  fitLabel: string;
}) {
  const popularityScore = clamp(popularity, 0, 100);
  const movementScore = getMovementComponentScore(movementType, rankChange);
  const saturationScore = lowSaturation ? 84 : 48;
  const recurrenceScore = recurring ? 78 : 44;
  const fitScore = getFitComponentScore(fitLabel);

  return [
    {
      label: `Pop ${popularityScore}`,
      value: `${popularityScore}`,
      tone: getBreakdownTone(popularityScore),
    },
    {
      label:
        rankChange === null
          ? movementType === "reentry"
            ? "Mov RE"
            : "Mov NEW"
          : `Mov ${formatSignedValue(rankChange)}`,
      value: `${movementScore}`,
      tone: getBreakdownTone(movementScore),
    },
    {
      label: lowSaturation ? "Sat baixa" : "Sat media",
      value: `${saturationScore}`,
      tone: getBreakdownTone(saturationScore),
    },
    {
      label: recurring ? "Rec forte" : "Rec leve",
      value: `${recurrenceScore}`,
      tone: getBreakdownTone(recurrenceScore),
    },
    {
      label: fitLabel,
      value: `${fitScore}`,
      tone: getBreakdownTone(fitScore),
    },
  ];
}

function buildRadarMusicHeroInsight({
  rows,
  movementContext,
  hottestGenres,
  dominantArtists,
}: {
  rows: RadarMusicRow[];
  movementContext: MusicMovementContext;
  hottestGenres: MusicGenreHeat[];
  dominantArtists: MusicArtistDominance[];
}): HeroInsight {
  const newEntries = rows.filter(
    (row) => row.movement.type === "new" || row.movement.type === "reentry",
  ).length;
  const risingCount = rows.filter((row) => row.movement.type === "up").length;
  const dominantArtist = dominantArtists.find((artist) => artist.top20Count >= 3);
  const hottestGenre = hottestGenres[0];
  const biggestRise = [...rows]
    .filter((row) => (row.rankChange ?? 0) > 0)
    .sort((left, right) => (right.rankChange ?? 0) - (left.rankChange ?? 0))[0];

  if (!movementContext.hasSufficientHistory) {
    return {
      headline: "Historico insuficiente para leitura de movimento. Continue coletando snapshots.",
      summary:
        "O radar ja mostra o ranking atual, mas precisa de mais capturas para confirmar subidas, quedas e reentradas com seguranca.",
      tone: "blue",
      supportingPoints: [
        `${rows.length} faixas ativas`,
        `${newEntries} novas entradas`,
        `${hottestGenre?.genreLabel ?? "Mercado aberto"} em foco`,
      ],
    };
  }

  if (dominantArtist) {
    return {
      headline: `${dominantArtist.artistName} domina o radar com ${dominantArtist.top20Count} faixas no top 20`,
      summary:
        "O topo do chart esta concentrado em poucos artistas, indicando dominancia clara de repertorio neste recorte.",
      tone: "green",
      supportingPoints: [
        `${newEntries} novas entradas`,
        `${risingCount} faixas subindo`,
        `${rows.length} faixas ativas no ranking`,
      ],
    };
  }

  const crossPlatformLeader = rows.find(
    (row) => row.tiktokViral && row.tiktokRank !== null,
  );

  if (crossPlatformLeader) {
    return {
      headline: `${crossPlatformLeader.name} esta quente nas duas plataformas`,
      summary:
        "O radar encontrou coincidencia real entre Spotify e TikTok Brasil, o que normalmente acelera a decisao de teste ou entrada na playlist.",
      tone: "blue",
      supportingPoints: [
        `TikTok #${crossPlatformLeader.tiktokRank}`,
        `${risingCount} faixas em alta no Spotify`,
        `${rows.filter((row) => row.tiktokViral).length} cruzamentos ativos`,
      ],
    };
  }

  if (biggestRise && (biggestRise.rankChange ?? 0) >= 5) {
    return {
      headline: `${biggestRise.name} subiu ${biggestRise.rankChange} posicoes e virou prioridade de curadoria`,
      summary:
        "A maior alta do periodo ganhou terreno real no chart e merece teste rapido nas playlists certas.",
      tone: "green",
      supportingPoints: [
        `${biggestRise.genre} em destaque`,
        `${newEntries} novas entradas`,
        `${rows.filter((row) => row.recurring).length} recorrentes`,
      ],
    };
  }

  return {
    headline:
      hottestGenre && hottestGenre.genre !== "all"
        ? `${hottestGenre.genreLabel} esta aquecendo com ${hottestGenre.opportunityCount} oportunidades`
        : `${newEntries} novas entradas indicam alta renovacao do mercado`,
    summary:
      "O radar mostra troca rapida no topo e abre espaco para discovery antes da saturacao plena.",
    tone: newEntries >= 5 ? "purple" : "yellow",
    supportingPoints: [
      `${risingCount} faixas em alta`,
      `${rows.filter((row) => row.recurring).length} recorrentes`,
      `${rows[0]?.name ?? "Sem lider definido"} lidera agora`,
    ],
  };
}

function buildRadarPlaylistsHeroInsight(rows: RadarPlaylistRow[]): HeroInsight {
  const leader = rows[0];

  return {
    headline: leader
      ? `${leader.name} lidera a base aparecendo em ${leader.playlistsCount} playlists`
      : "A base ainda nao tem uma faixa lider consolidada",
    summary:
      "Esse painel mostra o consenso interno da sua curadoria e revela quais faixas estao virando linguagem comum entre playlists diferentes.",
    tone: leader && leader.playlistsCount >= 3 ? "green" : "blue",
    supportingPoints: [
      `${rows.filter((row) => row.status.label === "Shared momentum").length} em shared momentum`,
      `${rows.filter((row) => row.playlistsCount >= 3).length} faixas core`,
      `${rows.length} faixas mapeadas`,
    ],
  };
}

function buildBasePlaylistsHeroInsight(rows: PlaylistBaseRow[]): HeroInsight {
  const leader = [...rows].sort(
    (left, right) => right.playlist.score - left.playlist.score,
  )[0];

  return {
    headline: leader
      ? `${leader.playlist.name} puxa a base com score ${leader.playlist.score}`
      : "Sua base ainda esta em formacao",
    summary:
      "A leitura operacional destaca quem lidera em performance, onde existe crescimento e quais playlists precisam de reforco.",
    tone: leader && leader.playlist.score >= 80 ? "green" : "yellow",
    supportingPoints: [
      `${rows.length} playlists monitoradas`,
      `${rows.filter((row) => row.growthTone === "green").length} em crescimento`,
      `${rows.filter((row) => row.growthTone === "red").length} pedem atencao`,
    ],
  };
}

function buildCurationHeroInsight(rows: DecisionTrack[]): HeroInsight {
  const addNow = rows.filter((row) => row.recommendedAction === "add");
  const topTrack = addNow[0] ?? rows[0];

  return {
    headline: topTrack
      ? `${topTrack.name} e a prioridade editorial numero um agora`
      : "Sem prioridade critica definida para hoje",
    summary:
      "A mesa de curadoria transforma o radar em decisao pratica: o que entra, o que fica em observacao e o que perde espaco.",
    tone: topTrack ? topTrack.movement.tone : "slate",
    supportingPoints: [
      `${addNow.length} prontas para adicionar`,
      `${rows.filter((row) => row.recommendedAction === "observe").length} em observacao`,
      `${rows.filter((row) => row.recommendedAction === "remove").length} pedem limpeza`,
    ],
  };
}

function buildCurationRows(
  radarRows: RadarMusicRow[],
  playlistTracks: TrackInsight[],
  dominantArtists: string[],
  accountProfile?: DashboardAccountProfile | null,
  {
    suggestionScoreThreshold = 70,
    prioritizeFollowedArtists = true,
    prioritizeTopTracks = true,
  }: {
    suggestionScoreThreshold?: number;
    prioritizeFollowedArtists?: boolean;
    prioritizeTopTracks?: boolean;
  } = {},
): DecisionTrack[] {
  const playlistTrackIds = new Set(playlistTracks.map((track) => track.id));
  const trackArtistIds = new Map(playlistTracks.map((track) => [track.id, track.artistIds]));

  return radarRows.slice(0, 200).map((row) => {
    const fallbackAlreadyInPlaylists = playlistTrackIds.has(row.trackId);
    const normalizedArtists = row.artists.toLowerCase();
    const fallbackArtistFit = dominantArtists.some((artist) =>
      normalizedArtists.includes(artist.toLowerCase()),
    );
    const accountSignals = buildAccountSignals({
      accountProfile: accountProfile ?? null,
      trackId: row.trackId,
      artists: row.artists,
      trackName: row.name,
      genreLabel: row.genre,
      fallbackAlreadyInPlaylists,
      fallbackArtistFit,
      lowSaturation: row.lowSaturation,
      recurring: row.recurring,
      rank: row.rank,
      weeklyRankChange: row.rankChange,
    });
    const fitLabel = accountSignals.fitLabel;
    const movementWeight =
      row.rankChange === null
        ? row.movement.type === "new" || row.movement.type === "reentry"
          ? 14
          : 6
        : clamp(row.rankChange * 5, -20, 20);
    const fitWeightBase =
      fitLabel === "Fit alto" ? 18 : fitLabel === "Fit medio" ? 10 : 3;
    const fitWeight = prioritizeFollowedArtists
      ? fitWeightBase + 2
      : fitWeightBase;
    const recurringWeight = row.recurring ? 10 : 3;
    const saturationWeight = row.lowSaturation ? 14 : 4;
    const accountPresenceWeight =
      accountSignals.accountPlaylistCount === 0
        ? 10
        : accountSignals.accountPlaylistCount === 1
          ? 2
          : -Math.min(12, accountSignals.accountPlaylistCount * 4);
    const artistWeight = clamp(
      accountSignals.accountArtistCount * (prioritizeFollowedArtists ? 5 : 3),
      0,
      18,
    );
    const genreWeight = clamp(accountSignals.accountGenreStrength * 1.4, 0, 16);
    const suggestionWeight = accountSignals.suggestedPlaylistName ? 8 : 0;
    const popularityWeight = prioritizeTopTracks ? 0.36 : 0.26;
    const opportunityWeight = prioritizeTopTracks ? 0.38 : 0.3;
    const decisionScore = clamp(
      Math.round(
        row.popularity * popularityWeight +
          row.opportunityScore * opportunityWeight +
          movementWeight +
          fitWeight +
          recurringWeight +
          saturationWeight +
          accountPresenceWeight +
          artistWeight +
          genreWeight +
          suggestionWeight,
      ),
      0,
      100,
    );

    let recommendedAction: DecisionTrack["recommendedAction"];

    if (
      row.movement.type === "down" &&
      accountSignals.accountPlaylistCount >= 2 &&
      decisionScore < Math.max(60, suggestionScoreThreshold - 4)
    ) {
      recommendedAction = "remove";
    } else if (
      decisionScore >= Math.max(72, suggestionScoreThreshold) &&
      accountSignals.accountPlaylistCount === 0
    ) {
      recommendedAction = "add";
    } else if (
      decisionScore >= Math.max(58, suggestionScoreThreshold - 10) ||
      (accountSignals.accountPlaylistCount > 0 && row.movement.type === "up")
    ) {
      recommendedAction = "observe";
    } else {
      recommendedAction = "ignore";
    }

    // Mapear movement.type para o enum de 4 valores esperado pela curadoria
    const mvType = row.movement.type;
    const movement_type: DecisionTrack["movement_type"] =
      mvType === "up" || mvType === "reentry"
        ? "up"
        : mvType === "down"
          ? "down"
          : mvType === "new"
            ? "new"
            : "stable";

    return {
      trackId: row.trackId,
      spotifyTrackId: extractTrackIdFromSpotifyUrl(row.spotifyUrl),
      name: row.name,
      artists: row.artists,
      artistIds: trackArtistIds.get(row.trackId) ?? [],
      albumName: row.albumName,
      coverUrl: row.coverUrl,
      spotifyUrl: row.spotifyUrl,
      popularity: row.popularity,
      dailyStreams: row.dailyStreams,
      streamRank: row.streamRank,
      streamGrowth: row.streamGrowth,
      streamGrowthPercent: row.streamGrowthPercent,
      movement: row.movement,
      chartDeltaLabel:
        row.rankChange === null
          ? row.movement.type === "reentry"
            ? "RE no radar"
            : "Sem historico"
          : `${formatSignedValue(row.rankChange)} no chart`,
      lowSaturation: row.lowSaturation,
      recurring: row.recurring,
      alreadyInPlaylists: accountSignals.alreadyInPlaylists,
      fitLabel: accountSignals.fitLabel,
      accountPlaylistCount: accountSignals.accountPlaylistCount,
      accountPlaylistNames: accountSignals.accountPlaylistNames,
      accountArtistCount: accountSignals.accountArtistCount,
      accountGenre: accountSignals.accountGenre,
      accountFitContext: accountSignals.accountFitContext,
      suggestedPlaylistName: accountSignals.suggestedPlaylistName,
      decisionScore,
      recommendedAction,
      scoreBreakdown: row.scoreBreakdown,
      movement_type,
      position_change: row.rankChange ?? null,
      previous_position: row.previousRank ?? null,
    };
  });
}

function normalizeTrackKey(name: string, artistName: string | null | undefined) {
  return `${name.trim().toLowerCase()}::${(artistName ?? "").trim().toLowerCase()}`;
}

function buildSnapshotTrackKey(track: Pick<ChartSnapshotTrack, "spotify_track_id" | "track_name" | "artist_name">) {
  return track.spotify_track_id?.trim() || normalizeTrackKey(track.track_name, track.artist_name);
}

function extractTrackIdFromSpotifyUrl(url: string) {
  const match = url.match(/track\/([A-Za-z0-9]{22})/);

  return match?.[1] ?? null;
}

function buildWeeklyComparisonDate(dates: string[]) {
  const latestDate = dates[0];

  if (!latestDate) {
    return null;
  }

  const weeklyTarget = subDays(new Date(`${latestDate}T00:00:00Z`), 7)
    .toISOString()
    .slice(0, 10);

  return dates.find((date) => date <= weeklyTarget) ?? dates[6] ?? dates[dates.length - 1] ?? null;
}

async function buildDashboardSnapshotRadarRows({
  country = "BR",
  playlistTracks,
  dominantArtists,
  accountProfile,
}: {
  country?: string;
  playlistTracks: TrackInsight[];
  dominantArtists: string[];
  accountProfile?: DashboardAccountProfile | null;
}) {
  const dates = await getSnapshotDates(country);
  const latestDate = dates[0] ?? null;

  if (!latestDate) {
    return {
      latestDate: null,
      previousDate: null,
      weeklyDate: null,
      rows: [] as RadarMusicRow[],
    };
  }

  const dailySnapshot = await getSnapshotWithComparison(latestDate, country);
  const weeklyDate = buildWeeklyComparisonDate(dates);
  const weeklySnapshot =
    weeklyDate && weeklyDate !== latestDate
      ? await getSnapshotByDate(weeklyDate, country)
      : null;
  const weeklyTracks = weeklySnapshot
    ? await getSnapshotTracks(weeklySnapshot.id)
    : [];
  const recentDates = dates.slice(0, 7);
  const recentSnapshots = await Promise.all(
    recentDates.map(async (date) => {
      const snapshot = await getSnapshotByDate(date, country);

      if (!snapshot) {
        return [] as ChartSnapshotTrack[];
      }

      return getSnapshotTracks(snapshot.id);
    }),
  );

  const weeklyByTrackKey = new Map<string, ChartSnapshotTrack>();

  for (const track of weeklyTracks) {
    weeklyByTrackKey.set(buildSnapshotTrackKey(track), track);
  }

  const recentPresenceCount = new Map<string, number>();

  for (const dayTracks of recentSnapshots) {
    const seenKeys = new Set<string>();

    for (const track of dayTracks) {
      const key = buildSnapshotTrackKey(track);

      if (seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      recentPresenceCount.set(key, (recentPresenceCount.get(key) ?? 0) + 1);
    }
  }

  const playlistTrackIds = new Set(playlistTracks.map((track) => track.id));
  const playlistTrackMap = new Map(playlistTracks.map((track) => [track.id, track]));

  const rows = dailySnapshot.tracks.map((track) => {
    const key = buildSnapshotTrackKey(track);
    const weeklyTrack = weeklyByTrackKey.get(key) ?? null;
    const weeklyRankChange =
      weeklyTrack && weeklyTrack.position > 0
        ? weeklyTrack.position - track.position
        : null;
    const presenceCount = recentPresenceCount.get(key) ?? 1;
    const spotifyTrackId = track.spotify_track_id?.trim() || null;
    const trackId = spotifyTrackId || key;
    const artists = track.artist_name?.trim() || "Artista nao identificado";
    const fallbackAlreadyInPlaylists =
      spotifyTrackId !== null && playlistTrackIds.has(spotifyTrackId);
    const fallbackArtistFit = dominantArtists.some((artist) =>
      artists.toLowerCase().includes(artist.toLowerCase()),
    );
    const movementType: MovementType =
      track.status === "stable" ? "same" : track.status;
    const lowSaturation = presenceCount <= 2;
    const recurring = presenceCount >= 4;
    const accountSignals = buildAccountSignals({
      accountProfile: accountProfile ?? null,
      trackId,
      artists,
      trackName: track.track_name,
      genreLabel: track.genre,
      fallbackAlreadyInPlaylists,
      fallbackArtistFit,
      lowSaturation,
      recurring,
      rank: track.position,
      weeklyRankChange,
    });
    const mappedPlaylistTrack = track.spotify_track_id
      ? playlistTrackMap.get(track.spotify_track_id)
      : undefined;
    const inferredPopularity = clamp(
      mappedPlaylistTrack?.popularity ??
        Math.round(
          92 -
            track.position * 0.28 +
            Math.max(track.position_change ?? 0, 0) * 1.4 +
            Math.max(weeklyRankChange ?? 0, 0) * 0.8,
        ),
      35,
      96,
    );
    const rankScore = clamp(100 - (track.position - 1) * 0.45, 10, 100);
    const dailyBoost =
      track.status === "new"
        ? 14
        : track.status === "up"
          ? clamp((track.position_change ?? 0) * 4, 0, 28)
          : track.status === "down"
            ? clamp((track.position_change ?? 0) * 3, -18, 0)
            : 4;
    const weeklyBoost =
      weeklyRankChange === null ? 0 : clamp(weeklyRankChange * 2.2, -18, 28);
    const streamBoost =
      track.stream_growth_percent === null
        ? 0
        : clamp(track.stream_growth_percent / 2, -14, 18);
    const opportunityScore = clamp(
      Math.round(
        rankScore * 0.42 +
          inferredPopularity * 0.18 +
          dailyBoost +
          weeklyBoost +
          streamBoost +
          (lowSaturation ? 6 : 0) +
          (recurring ? 8 : 0),
      ),
      0,
      100,
    );
    const intelligenceTags = [
      track.status === "new" ? "Entrada fresca" : null,
      track.status === "up" && (track.position_change ?? 0) >= 5
        ? "Subida diaria forte"
        : null,
      weeklyRankChange !== null && weeklyRankChange >= 10
        ? "Subida semanal forte"
        : null,
      recurring ? "Consistencia semanal" : null,
      lowSaturation ? "Janela aberta" : null,
      accountSignals.accountPlaylistCount >= 2 ? "Base recorrente" : null,
      accountSignals.suggestedPlaylistName
        ? `Pede ${accountSignals.suggestedPlaylistName}`
        : null,
    ].filter((value): value is string => Boolean(value));

    return {
      rank: track.position,
      movement: buildMovementDescriptor(movementType),
      trackId,
      name: track.track_name,
      artists,
      genre: track.genre ?? "Sem genero",
      albumName: mappedPlaylistTrack?.albumName ?? "",
      popularity: inferredPopularity,
      dailyStreams: track.streams,
      streamRank: track.streams ? track.position : null,
      streamGrowth: track.stream_change,
      streamGrowthPercent: track.stream_growth_percent,
      streamVelocityLabel:
        track.stream_change === null
          ? "Sem historico"
          : track.stream_change > 0
            ? "Acelerando"
            : track.stream_change < 0
              ? "Perdendo forca"
              : "Fluxo estavel",
      popularityChange: null,
      previousRank: track.previous_position,
      rankChange: track.position_change,
      daysOnRadar: presenceCount,
      saturationCount: presenceCount,
      opportunityScore,
      spotifyTrackId,
      spotifyUrl: spotifyTrackId
        ? `https://open.spotify.com/track/${spotifyTrackId}`
        : "#",
      coverUrl:
        track.image_url ??
        mappedPlaylistTrack?.coverUrl ??
        null,
      statusTags: intelligenceTags,
      intelligenceTags,
      tiktokViral: false,
      tiktokRank: null,
      tiktokSnapshotDate: null,
      tiktokMovementLabel: null,
      lowSaturation,
      recurring,
      alreadyInPlaylists: accountSignals.alreadyInPlaylists,
      fitLabel: accountSignals.fitLabel,
      scoreBreakdown: buildScoreBreakdown({
        popularity: inferredPopularity,
        movementType,
        rankChange: track.position_change,
        lowSaturation,
        recurring,
        fitLabel: accountSignals.fitLabel,
      }),
    } satisfies RadarMusicRow;
  });

  return {
    latestDate,
    previousDate: dailySnapshot.previousDate,
    weeklyDate,
    rows,
  };
}

function compareDecisionPriority(left: DecisionTrack, right: DecisionTrack) {
  const scoreDifference = right.decisionScore - left.decisionScore;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const positionDifference = (right.position_change ?? -999) - (left.position_change ?? -999);

  if (positionDifference !== 0) {
    return positionDifference;
  }

  return (right.dailyStreams ?? 0) - (left.dailyStreams ?? 0);
}

function compareRemovePriority(left: DecisionTrack, right: DecisionTrack) {
  const positionDifference = (left.position_change ?? 999) - (right.position_change ?? 999);

  if (positionDifference !== 0) {
    return positionDifference;
  }

  return left.decisionScore - right.decisionScore;
}

function buildRadarDecisionQueues(
  baseRows: DecisionTrack[],
  radarRows: RadarMusicRow[],
) {
  const radarByTrackId = new Map(radarRows.map((row) => [row.trackId, row]));

  const enhancedRows: DecisionTrack[] = baseRows.map((track): DecisionTrack => {
    const radarRow = radarByTrackId.get(track.trackId);

    if (!radarRow?.tiktokViral) {
      return track;
    }

    const tiktokBoost =
      getTikTokRankBoost(radarRow.tiktokRank ?? 100) +
      getTikTokMovementBoost(radarRow.tiktokMovementLabel) +
      (!track.alreadyInPlaylists ? 4 : 0);
    const decisionScore = clamp(track.decisionScore + tiktokBoost, 0, 100);

    let recommendedAction = track.recommendedAction;

    if (recommendedAction !== "remove") {
      if (!track.alreadyInPlaylists && decisionScore >= 76) {
        recommendedAction = "add";
      } else if (decisionScore >= 66) {
        recommendedAction = "observe";
      }
    }

    const tiktokTone: StatusTone =
      radarRow.tiktokMovementLabel === "NEW"
        ? "blue"
        : radarRow.tiktokMovementLabel?.startsWith("+")
          ? "green"
          : radarRow.tiktokMovementLabel?.startsWith("-")
            ? "red"
            : "slate";

    return {
      ...track,
      decisionScore,
      recommendedAction,
      accountFitContext: `${track.accountFitContext} · TikTok ${radarRow.tiktokRank ? `#${radarRow.tiktokRank}` : "viral"} ${radarRow.tiktokMovementLabel ? radarRow.tiktokMovementLabel.toLowerCase() : ""}`.trim(),
      scoreBreakdown: [
        {
          label: radarRow.tiktokRank ? `TikTok #${radarRow.tiktokRank}` : "TikTok viral",
          value: `${clamp(tiktokBoost * 5, 0, 100)}`,
          tone: tiktokTone,
        },
        ...track.scoreBreakdown.slice(0, 4),
      ],
    };
  });

  const addNow = enhancedRows
    .filter((track) => track.recommendedAction === "add")
    .sort(compareDecisionPriority);
  const review = enhancedRows
    .filter((track) => track.recommendedAction === "remove")
    .sort(compareRemovePriority);
  const addTrackIds = new Set(addNow.map((track) => track.trackId));
  const testNow = enhancedRows
    .filter((track) => {
      const radarRow = radarByTrackId.get(track.trackId);

      return (
        !addTrackIds.has(track.trackId) &&
        track.recommendedAction !== "remove" &&
        Boolean(radarRow?.tiktokViral) &&
        !track.alreadyInPlaylists
      );
    })
    .sort(compareDecisionPriority);
  const blockedTrackIds = new Set([
    ...addTrackIds,
    ...testNow.map((track) => track.trackId),
  ]);
  const observe = enhancedRows
    .filter(
      (track) =>
        !blockedTrackIds.has(track.trackId) &&
        track.recommendedAction === "observe",
    )
    .sort(compareDecisionPriority);

  return {
    primaryTrack: addNow[0] ?? testNow[0] ?? observe[0] ?? review[0] ?? null,
    addNow: addNow.slice(0, 4),
    testNow: testNow.slice(0, 4),
    observe: observe.slice(0, 4),
    review: review.slice(0, 4),
  };
}

function buildDashboardTone(track: DecisionTrack | null | undefined): StatusTone {
  switch (track?.recommendedAction) {
    case "add":
      return "green";
    case "observe":
      return "yellow";
    case "remove":
      return "red";
    default:
      return track?.movement.tone ?? "slate";
  }
}

function buildDecisionSummary(track: DecisionTrack) {
  const baseLabel = track.alreadyInPlaylists
    ? "ja conversa com a tua base"
    : "ainda esta fora da tua base";

  return `${track.name} combina score ${track.decisionScore}, ${track.chartDeltaLabel.toLowerCase()} e ${track.fitLabel.toLowerCase()}; ${track.accountFitContext.toLowerCase()}, entao ${baseLabel} virou sinal forte para hoje.`;
}

function buildDashboardEditorialSpotlights({
  addNowQueue,
  observeQueue,
  removeQueue,
  radarRows,
}: {
  addNowQueue: DecisionTrack[];
  observeQueue: DecisionTrack[];
  removeQueue: DecisionTrack[];
  radarRows: RadarMusicRow[];
}): DashboardEditorialSpotlight[] {
  const decisionByTrackId = new Map(
    [...addNowQueue, ...observeQueue, ...removeQueue].map((track) => [track.trackId, track]),
  );
  const topDecisionTrack =
    addNowQueue[0] ??
    observeQueue[0] ??
    [...decisionByTrackId.values()].sort(compareDecisionPriority)[0] ??
    null;
  const weeklyAnchor = [...decisionByTrackId.values()]
    .filter((track) => track.recurring)
    .sort(compareDecisionPriority)[0] ?? topDecisionTrack;
  const biggestRise = [...radarRows]
    .filter((row) => (row.rankChange ?? 0) > 0)
    .sort((left, right) => (right.rankChange ?? 0) - (left.rankChange ?? 0))[0];
  const breakoutTrack = [...radarRows]
    .filter(
      (row) =>
        !row.alreadyInPlaylists &&
        (row.movement.type === "new" ||
          row.movement.type === "reentry" ||
          row.lowSaturation),
    )
    .sort((left, right) => {
      const leftDecisionScore = decisionByTrackId.get(left.trackId)?.decisionScore ?? 0;
      const rightDecisionScore = decisionByTrackId.get(right.trackId)?.decisionScore ?? 0;

      if (rightDecisionScore !== leftDecisionScore) {
        return rightDecisionScore - leftDecisionScore;
      }

      return right.opportunityScore - left.opportunityScore;
    })[0];
  const dropAlertDecision = removeQueue[0] ?? null;
  const dropAlertRadar = dropAlertDecision
    ? null
    : [...radarRows]
        .filter(
          (row) =>
            row.alreadyInPlaylists &&
            row.movement.type === "down" &&
            (row.rankChange ?? 0) < 0,
        )
        .sort((left, right) => (left.rankChange ?? 0) - (right.rankChange ?? 0))[0] ??
      null;

  const editorialSpotlights: Array<DashboardEditorialSpotlight | null> = [
    topDecisionTrack
      ? {
          title: "Melhor musica do dia",
          badge:
            topDecisionTrack.recommendedAction === "add"
              ? "Entrar agora"
              : "Observacao forte",
          tone: buildDashboardTone(topDecisionTrack),
          trackId: topDecisionTrack.trackId,
          spotifyTrackId: topDecisionTrack.spotifyTrackId,
          trackName: topDecisionTrack.name,
          artists: topDecisionTrack.artists,
          summary: buildDecisionSummary(topDecisionTrack),
          stats: [
            `Score ${topDecisionTrack.decisionScore}`,
            topDecisionTrack.chartDeltaLabel,
            topDecisionTrack.fitLabel,
            topDecisionTrack.accountFitContext,
          ],
          coverUrl: topDecisionTrack.coverUrl,
          spotifyUrl: topDecisionTrack.spotifyUrl,
          suggestedPlaylistName: topDecisionTrack.suggestedPlaylistName,
        }
      : null,
    weeklyAnchor
      ? {
          title: "Melhor da semana",
          badge: weeklyAnchor.recurring ? "Consistencia" : "Radar ativo",
          tone: weeklyAnchor.recurring ? "blue" : buildDashboardTone(weeklyAnchor),
          trackId: weeklyAnchor.trackId,
          spotifyTrackId: weeklyAnchor.spotifyTrackId,
          trackName: weeklyAnchor.name,
          artists: weeklyAnchor.artists,
          summary: weeklyAnchor.recurring
            ? `${weeklyAnchor.name} sustentou leitura forte no radar, manteve score ${weeklyAnchor.decisionScore} e virou referencia para segurar na playlist alem do hype do dia.`
            : `${weeklyAnchor.name} ainda esta formando historico semanal, mas ja mostra sinais fortes o suficiente para entrar no monitoramento principal.`,
          stats: [
            weeklyAnchor.recurring ? "Recorrente no radar" : "Historico em formacao",
            `Score ${weeklyAnchor.decisionScore}`,
            weeklyAnchor.fitLabel,
            weeklyAnchor.suggestedPlaylistName
              ? `Boa para ${weeklyAnchor.suggestedPlaylistName}`
              : weeklyAnchor.position_change === null
                ? "Sem comparativo"
                : `${formatSignedValue(weeklyAnchor.position_change)} no chart`,
          ],
          coverUrl: weeklyAnchor.coverUrl,
          spotifyUrl: weeklyAnchor.spotifyUrl,
          suggestedPlaylistName: weeklyAnchor.suggestedPlaylistName,
        }
      : null,
    biggestRise
      ? {
          title: "Maior subida",
          badge: "Acelerando",
          tone: "green",
          trackId: biggestRise.trackId,
          spotifyTrackId:
            decisionByTrackId.get(biggestRise.trackId)?.spotifyTrackId ??
            extractTrackIdFromSpotifyUrl(biggestRise.spotifyUrl),
          trackName: biggestRise.name,
          artists: biggestRise.artists,
          summary: `${biggestRise.name} foi a faixa que mais ganhou terreno no top 200, com ${formatSignedValue(biggestRise.rankChange ?? 0)} posicoes. ${decisionByTrackId.get(biggestRise.trackId)?.alreadyInPlaylists ? "Vale revisar se ela ja esta bem posicionada na base." : "Boa candidata para teste rapido nas playlists com fit."}`,
          stats: [
            `#${biggestRise.rank}`,
            `${formatSignedValue(biggestRise.rankChange ?? 0)} posicoes`,
            decisionByTrackId.get(biggestRise.trackId)?.fitLabel ?? biggestRise.fitLabel,
            decisionByTrackId.get(biggestRise.trackId)?.accountFitContext ??
              (biggestRise.dailyStreams === null
                ? "Sem streams"
                : formatStreamsValue(biggestRise.dailyStreams)),
          ],
          coverUrl: biggestRise.coverUrl,
          spotifyUrl: biggestRise.spotifyUrl,
          suggestedPlaylistName:
            decisionByTrackId.get(biggestRise.trackId)?.suggestedPlaylistName ?? null,
        }
      : null,
    breakoutTrack
      ? {
          title: "Aposta nova",
          badge:
            breakoutTrack.movement.type === "new" ||
            breakoutTrack.movement.type === "reentry"
              ? breakoutTrack.movement.label
              : "Baixa saturacao",
          tone:
            breakoutTrack.movement.type === "new" ||
            breakoutTrack.movement.type === "reentry"
              ? "purple"
              : "yellow",
          trackId: breakoutTrack.trackId,
          spotifyTrackId:
            decisionByTrackId.get(breakoutTrack.trackId)?.spotifyTrackId ??
            extractTrackIdFromSpotifyUrl(breakoutTrack.spotifyUrl),
          trackName: breakoutTrack.name,
          artists: breakoutTrack.artists,
          summary: `${breakoutTrack.name} abre uma janela boa de discovery porque ainda esta fora da tua base, tem ${breakoutTrack.fitLabel.toLowerCase()} e ${decisionByTrackId.get(breakoutTrack.trackId)?.accountFitContext.toLowerCase() ?? "chega com espaco editorial para teste"}.`,
          stats: [
            decisionByTrackId.get(breakoutTrack.trackId)
              ? `Score ${decisionByTrackId.get(breakoutTrack.trackId)?.decisionScore}`
              : `Radar ${breakoutTrack.opportunityScore}`,
            breakoutTrack.lowSaturation ? "Baixa saturacao" : breakoutTrack.movement.label,
            decisionByTrackId.get(breakoutTrack.trackId)?.suggestedPlaylistName
              ? `Boa para ${decisionByTrackId.get(breakoutTrack.trackId)?.suggestedPlaylistName}`
              : breakoutTrack.rankChange === null
                ? "Sem comparativo"
                : `${formatSignedValue(breakoutTrack.rankChange)} no chart`,
            `#${breakoutTrack.rank}`,
          ],
          coverUrl: breakoutTrack.coverUrl,
          spotifyUrl: breakoutTrack.spotifyUrl,
          suggestedPlaylistName:
            decisionByTrackId.get(breakoutTrack.trackId)?.suggestedPlaylistName ?? null,
        }
      : null,
    dropAlertDecision
      ? {
          title: "Alerta de queda",
          badge: "Revisar base",
          tone: "red",
          trackId: dropAlertDecision.trackId,
          spotifyTrackId: dropAlertDecision.spotifyTrackId,
          trackName: dropAlertDecision.name,
          artists: dropAlertDecision.artists,
          summary: `${dropAlertDecision.name} perdeu tracao e ja pede teste de troca ou limpeza, principalmente se estiver ocupando espaco nobre na playlist.`,
          stats: [
            `Score ${dropAlertDecision.decisionScore}`,
            dropAlertDecision.chartDeltaLabel,
            dropAlertDecision.fitLabel,
            dropAlertDecision.accountFitContext,
          ],
          coverUrl: dropAlertDecision.coverUrl,
          spotifyUrl: dropAlertDecision.spotifyUrl,
          suggestedPlaylistName: dropAlertDecision.suggestedPlaylistName,
        }
      : dropAlertRadar
        ? {
            title: "Alerta de queda",
            badge: "Revisar base",
            tone: "red",
            trackId: dropAlertRadar.trackId,
            spotifyTrackId:
              decisionByTrackId.get(dropAlertRadar.trackId)?.spotifyTrackId ??
              extractTrackIdFromSpotifyUrl(dropAlertRadar.spotifyUrl),
            trackName: dropAlertRadar.name,
            artists: dropAlertRadar.artists,
            summary: `${dropAlertRadar.name} foi a queda mais sensivel entre as faixas que ja estao na base e merece reavaliacao editorial.`,
            stats: [
              `#${dropAlertRadar.rank}`,
              `${formatSignedValue(dropAlertRadar.rankChange ?? 0)} no chart`,
              dropAlertRadar.fitLabel,
              dropAlertRadar.dailyStreams === null
                ? "Sem streams"
                : formatStreamsValue(dropAlertRadar.dailyStreams),
            ],
            coverUrl: dropAlertRadar.coverUrl,
            spotifyUrl: dropAlertRadar.spotifyUrl,
            suggestedPlaylistName:
              decisionByTrackId.get(dropAlertRadar.trackId)?.suggestedPlaylistName ?? null,
          }
        : null,
  ];

  return editorialSpotlights.filter(
    (spotlight): spotlight is DashboardEditorialSpotlight => spotlight !== null,
  );
}

export async function getRadarMusicPageData({
  country,
  genre,
  period,
  status,
}: {
  country?: string;
  genre?: string;
  period?: string;
  status?: string;
}): Promise<RadarMusicPageData> {
  const selectedPeriod = normalizePeriod(period);
  const selectedStatus = normalizeStatus(status);
  const periodLabel = getPeriodLabel(selectedPeriod);
  const [musicData, chartsData, accountProfile, tiktokChart] = await Promise.all([
    getMusicChartsData({ country, genre }),
    getChartsData(),
    buildDashboardAccountProfile(),
    fetchTikTokPublicChart().catch(() => ({
      source: "kworb-br" as const,
      snapshotDate: null,
      tracks: [],
    })),
  ]);
  const rows = buildRadarRows(
    musicData.workbenchTracks,
    chartsData.tracks,
    musicData.dominantArtists.map((artist) => artist.artistName),
  );
  const radarWithTikTok = enrichRadarRowsWithTikTokSignals(
    rows,
    tiktokChart.tracks,
    tiktokChart.snapshotDate,
  );
  const decisionRows = buildCurationRows(
    radarWithTikTok.rows,
    chartsData.tracks,
    chartsData.artistDistribution.map((artist) => artist.type),
    accountProfile,
  );
  const decisionQueues = buildRadarDecisionQueues(
    decisionRows,
    radarWithTikTok.rows,
  );
  const primaryRadarRow = decisionQueues.primaryTrack
    ? radarWithTikTok.rows.find(
        (row) => row.trackId === decisionQueues.primaryTrack?.trackId,
      ) ?? radarWithTikTok.rows[0]
    : radarWithTikTok.rows[0];
  const prioritizedHeroRows = primaryRadarRow
    ? [
        primaryRadarRow,
        ...radarWithTikTok.rows.filter(
          (row) => row.trackId !== primaryRadarRow.trackId,
        ),
      ]
    : radarWithTikTok.rows;
  const filteredRows = filterRadarRows(radarWithTikTok.rows, selectedStatus);

  return {
    hero: {
      eyebrow: "",
      title: "Radar Music Charts",
      description:
        "Mesa operacional que cruza Spotify Charts, TikTok Charts Brasil e o DNA da tua conta para decidir o que entra, o que testa e o que pede revisao.",
      primaryCtaLabel: "Ir para Curadoria",
      primaryCtaHref: "/curadoria",
      secondaryCtaLabel: "Ver Playlists Concorrentes",
      secondaryCtaHref: "/playlists-concorrentes",
    },
    heroInsight: buildRadarMusicHeroInsight({
      rows: prioritizedHeroRows,
      movementContext: musicData.movementContext,
      hottestGenres: musicData.hottestGenres,
      dominantArtists: musicData.dominantArtists,
    }),
    editorialHero: buildRadarMusicEditorialHero({
      rows: prioritizedHeroRows,
      countryLabel: musicData.countryLabel,
      genreLabel: musicData.genreLabel,
      periodLabel,
      movementContext: musicData.movementContext,
      hottestGenres: musicData.hottestGenres,
      dominantArtists: musicData.dominantArtists,
    }),
    genreSpotlights: buildRadarMusicGenreSpotlights({
      rows: radarWithTikTok.rows,
      countryValue: musicData.countryValue,
      countryLabel: musicData.countryLabel,
      selectedGenre: musicData.genreValue,
      selectedGenreLabel: musicData.genreLabel,
      selectedPeriod,
      hottestGenres: musicData.hottestGenres,
    }),
    filters: {
      countryOptions: getMusicMarketOptions(),
      genreOptions: getMusicGenreOptions(),
      periodOptions: [...PERIOD_OPTIONS],
      statusOptions: [...STATUS_OPTIONS],
      selectedCountry: musicData.countryValue,
      selectedCountryLabel: musicData.countryLabel,
      selectedGenre: musicData.genreValue,
      selectedGenreLabel: musicData.genreLabel,
      selectedPeriod,
      selectedStatus,
    },
    summaryCards: buildRadarMusicSummary(
      prioritizedHeroRows,
      musicData.movementContext.hasSufficientHistory,
    ),
    rows: filteredRows,
    decisionRows,
    decisionQueues,
    tiktokMatches: {
      snapshotDate: tiktokChart.snapshotDate,
      tracks: radarWithTikTok.matches.slice(0, 8),
    },
    support: {
      sourceModeLabel: musicData.dataTrust.sourceModeLabel,
      sourceModeDescription: musicData.dataTrust.sourceModeDescription,
      updatedAtLabel: musicData.dataTrust.updatedAtLabel,
      sampleSize: musicData.dataTrust.sampleSize,
      historyDaysTracked: musicData.dataTrust.historyDaysTracked,
      marketHighlight:
        radarWithTikTok.matches.length > 0
          ? `${musicData.dataTrust.marketHighlight} ${radarWithTikTok.matches.length} faixas do radar tambem aparecem no viral do TikTok.`
          : musicData.dataTrust.marketHighlight,
    },
  };
}

export async function getRadarPlaylistsPageData(): Promise<RadarPlaylistsData> {
  const [chartsData, radarMusic] = await Promise.all([
    getChartsData(),
    getRadarMusicPageData({
      country: "BR",
      genre: "all",
      period: "7d",
      status: "all",
    }),
  ]);
  const risingSet = new Set(
    radarMusic.rows
      .filter(
        (row) =>
          row.movement.type === "up" ||
          row.movement.type === "new" ||
          row.movement.type === "reentry",
      )
      .map((row) => row.trackId),
  );
  const rows: RadarPlaylistRow[] = chartsData.tracks.map((track) => {
    const sharedMomentum = risingSet.has(track.id);
    const status = sharedMomentum
      ? { label: "Shared momentum", tone: "green" as StatusTone }
      : track.playlistsCount >= 3
        ? { label: "Core da base", tone: "blue" as StatusTone }
        : track.popularity >= 70
          ? { label: "Observar", tone: "yellow" as StatusTone }
          : { label: "Monitorar", tone: "slate" as StatusTone };

    return {
      trackId: track.id,
      name: track.name,
      artists: track.artists,
      playlistsLabel: `${track.playlistsCount} playlists`,
      playlistsCount: track.playlistsCount,
      popularity: track.popularity,
      repetitionLabel: `${track.playlistsCount}x na base`,
      status,
      actionHref: track.spotifyUrl,
      coverUrl: track.coverUrl,
    };
  });
  const sharedMomentumRows = rows.filter((row) => risingSet.has(row.trackId)).slice(0, 10);

  return {
    hero: {
      eyebrow: "Radar interno",
      title: "Playlists Concorrentes",
      description:
        "Leitura cruzada das playlists monitoradas para saber quais faixas realmente estao se repetindo na sua base e quais tambem estao acelerando no radar externo.",
      primaryCtaLabel: "Abrir Radar Music",
      primaryCtaHref: "/radar-music",
      secondaryCtaLabel: "Ir para Curadoria",
      secondaryCtaHref: "/curadoria",
    },
    heroInsight: buildRadarPlaylistsHeroInsight(rows),
    metrics: [
      {
        title: "Faixas monitoradas",
        value: formatCount(chartsData.tracks.length),
        helper: "Cobertura da base",
        tone: "blue",
      },
      {
        title: "Shared momentum",
        value: formatCount(sharedMomentumRows.length),
        helper: "Cruza com mercado",
        tone: "green",
      },
      {
        title: "Faixas core",
        value: formatCount(rows.filter((row) => row.playlistsCount >= 3).length),
        helper: "Repeticao alta",
        tone: "purple",
      },
      {
        title: "Top repeticao",
        value: chartsData.topRepeatedTrack,
        helper: "Musica ancora",
        tone: "yellow",
      },
    ],
    rows,
    sharedMomentum: sharedMomentumRows,
  };
}

export async function getBasePlaylistsPageData(): Promise<PlaylistBaseData> {
  const [dashboardData, playlistSnapshots] = await Promise.all([
    getDashboardData(),
    fetchPlaylistSnapshots(),
  ]);
  const rows: PlaylistBaseRow[] = dashboardData.playlists.map((playlist) => {
    const growth = buildPlaylistGrowth(playlist, playlistSnapshots);

    return {
      playlist,
      followersLabel: formatCount(playlist.followers),
      growthLabel: growth.growthLabel,
      growthTone: growth.growthTone,
      tracksLabel: formatCount(playlist.tracks),
      scoreLabel: formatCount(playlist.score),
      lastUpdatedLabel: growth.lastUpdatedLabel,
    };
  });
  const playlistTrackGroups = await Promise.all(
    dashboardData.playlists.map(async (playlist) => {
      const spotifyPlaylistId = extractSpotifyPlaylistId(playlist.url);

      if (!spotifyPlaylistId) {
        return {
          playlist,
          tracks: [],
        };
      }

      try {
        const tracks = await fetchSpotifyPlaylistTracks(spotifyPlaylistId);

        return {
          playlist,
          tracks,
        };
      } catch {
        return {
          playlist,
          tracks: [],
        };
      }
    }),
  );
  const globalTrackFrequency = new Map<string, number>();

  for (const group of playlistTrackGroups) {
    const uniqueTrackIds = new Set(group.tracks.map((track) => track.id));

    for (const trackId of uniqueTrackIds) {
      globalTrackFrequency.set(trackId, (globalTrackFrequency.get(trackId) ?? 0) + 1);
    }
  }

  const comparisonRows = playlistTrackGroups
    .map((group) => {
      const repeatedTracks = group.tracks.filter(
        (track) => (globalTrackFrequency.get(track.id) ?? 0) > 1,
      ).length;
      const averagePopularity =
        group.tracks.length > 0
          ? group.tracks.reduce((sum, track) => sum + track.popularity, 0) /
            group.tracks.length
          : 0;
      const repetitionRate =
        group.tracks.length > 0 ? (repeatedTracks / group.tracks.length) * 100 : 0;
      const growth = buildPlaylistGrowth(group.playlist, playlistSnapshots);
      const growthNumeric =
        growth.growthTone === "green"
          ? 10
          : growth.growthTone === "blue"
            ? 5
            : growth.growthTone === "purple"
              ? 7
              : 0;
      const performance = clamp(
        Math.round(
          group.playlist.score * 0.45 +
            averagePopularity * 0.25 +
            repetitionRate * 0.15 +
            growthNumeric * 2,
        ),
        0,
        100,
      );

      return {
        playlistId: group.playlist.id,
        playlistName: group.playlist.name,
        coverUrl: group.playlist.coverUrl,
        scoreAverageLabel: `${group.playlist.score}`,
        repetitionRateLabel: formatPercentage(repetitionRate),
        averagePopularityLabel: averagePopularity.toFixed(1),
        followerGrowthLabel: growth.growthLabel,
        followerGrowthTone: growth.growthTone,
        performanceLabel: `${performance} pts`,
      };
    })
    .sort((left, right) => Number(right.performanceLabel.replace(/\D/g, "")) - Number(left.performanceLabel.replace(/\D/g, "")));

  return {
    hero: {
      eyebrow: "Base monitorada",
      title: "Playlists Concorrentes",
      description:
        "Area dedicada para cadastrar novas URLs, acompanhar score, monitorar a saude da base e abrir a analise individual de cada playlist.",
      primaryCtaLabel: "Abrir Curadoria",
      primaryCtaHref: "/curadoria",
      secondaryCtaLabel: "Abrir Radar Music",
      secondaryCtaHref: "/radar-music",
    },
    heroInsight: buildBasePlaylistsHeroInsight(rows),
    metrics: buildPlaylistMetrics(dashboardData.playlists),
    rows,
    healthSummary: [
      {
        label: "Score alto",
        value: formatCount(
          dashboardData.playlists.filter((playlist) => playlist.score >= 80).length,
        ),
        tone: "green",
      },
      {
        label: "Score medio",
        value: formatCount(
          dashboardData.playlists.filter(
            (playlist) => playlist.score >= 50 && playlist.score < 80,
          ).length,
        ),
        tone: "yellow",
      },
      {
        label: "Score baixo",
        value: formatCount(
          dashboardData.playlists.filter((playlist) => playlist.score < 50).length,
        ),
        tone: "red",
      },
    ],
    comparisonRows,
  };
}

export async function getCurationPageData(): Promise<CurationPageData> {
  const workspace = await getCurrentWorkspaceContext().catch(() => null);
  const defaultMarket = workspace?.settings.defaultMarket?.trim() || "BR";
  const suggestionScoreThreshold = clamp(
    workspace?.settings.suggestionScoreThreshold ?? 70,
    0,
    100,
  );
  const chartsData = await getChartsData();
  const dominantArtists = chartsData.artistDistribution.map((artist) => artist.type);
  const snapshotRadar = await buildDashboardSnapshotRadarRows({
    country: defaultMarket,
    playlistTracks: chartsData.tracks,
    dominantArtists,
  });
  const rows = buildCurationRows(snapshotRadar.rows, chartsData.tracks, dominantArtists, undefined, {
    suggestionScoreThreshold,
    prioritizeFollowedArtists:
      workspace?.settings.prioritizeFollowedArtists ?? true,
    prioritizeTopTracks: workspace?.settings.prioritizeTopTracks ?? true,
  });

  return {
    hero: {
      eyebrow: "Mesa final",
      title: "Curadoria",
      description:
        "Fila final de decisao baseada em leitura de streams BR, fit com playlists da conta e sinais editoriais para acelerar adicao e observacao de repertorio.",
      primaryCtaLabel: "Abrir Radar Music",
      primaryCtaHref: "/radar-music",
      secondaryCtaLabel: "Ver Playlists Concorrentes",
      secondaryCtaHref: "/playlists-concorrentes",
    },
    heroInsight: buildCurationHeroInsight(rows),
    metrics: [
      {
        title: "Adicionar agora",
        value: formatCount(rows.filter((row) => row.recommendedAction === "add").length),
        helper: `Score >= ${Math.max(72, suggestionScoreThreshold)}`,
        tone: "green",
      },
      {
        title: "Observar",
        value: formatCount(
          rows.filter((row) => row.recommendedAction === "observe").length,
        ),
        helper: "Em monitoramento",
        tone: "yellow",
      },
      {
        title: "Remover/Testar",
        value: formatCount(
          rows.filter((row) => row.recommendedAction === "remove").length,
        ),
        helper: "Ajuste fino",
        tone: "red",
      },
      {
        title: "Fit alto",
        value: formatCount(rows.filter((row) => row.fitLabel === "Fit alto").length),
        helper: `${defaultMarket} como mercado base`,
        tone: "blue",
      },
    ],
    snapshotDate: snapshotRadar.latestDate,
    previousDate: snapshotRadar.previousDate,
    rows,
  };
}

export async function getDashboardWorkspaceData(): Promise<DashboardWorkspaceData> {
  const [chartsData, accountProfile] = await Promise.all([
    getChartsData(),
    buildDashboardAccountProfile(),
  ]);
  const snapshotRadar = await buildDashboardSnapshotRadarRows({
    country: "BR",
    playlistTracks: chartsData.tracks,
    dominantArtists: chartsData.artistDistribution.map((artist) => artist.type),
    accountProfile,
  });
  const radarRows = snapshotRadar.rows;

  if (radarRows.length === 0) {
    const [curationData, radarMusic] = await Promise.all([
      getCurationPageData(),
      getRadarMusicPageData({
        country: "BR",
        genre: "all",
        period: "7d",
        status: "all",
      }),
    ]);
    const addNowQueueFallback = curationData.rows
      .filter((row) => row.recommendedAction === "add")
      .sort(compareDecisionPriority);
    const observeQueueFallback = curationData.rows
      .filter((row) => row.recommendedAction === "observe")
      .sort(compareDecisionPriority);
    const removeQueueFallback = curationData.rows
      .filter((row) => row.recommendedAction === "remove")
      .sort(compareRemovePriority);
    const biggestRiseFallback = [...radarMusic.rows]
      .filter((row) => (row.rankChange ?? 0) > 0)
      .sort((left, right) => (right.rankChange ?? 0) - (left.rankChange ?? 0))[0];
    const addNowFallback = addNowQueueFallback.slice(0, 2);
    const observeFallback = observeQueueFallback.slice(0, 2);
    const removeFallback = removeQueueFallback.slice(0, 2);
    const editorialSpotlightsFallback = buildDashboardEditorialSpotlights({
      addNowQueue: addNowQueueFallback,
      observeQueue: observeQueueFallback,
      removeQueue: removeQueueFallback,
      radarRows: radarMusic.rows,
    });
    const primaryTrackFallback = addNowFallback[0] ?? observeFallback[0] ?? null;

    return {
      hero: {
        eyebrow: "Visao do dia",
        title: "Curadoria do dia",
        description:
          "Painel executivo para decidir rapido o que entra, o que continua em observacao e o que ja pede ajuste na base.",
        primaryCtaLabel: "Ir para Curadoria",
        primaryCtaHref: "/curadoria",
        secondaryCtaLabel: "Abrir Radar Music",
        secondaryCtaHref: "/radar-music",
      },
      heroInsight: {
        headline: primaryTrackFallback
          ? `${primaryTrackFallback.name} e a melhor oportunidade editorial agora`
          : "O mercado ainda nao definiu uma prioridade absoluta hoje",
        summary:
          accountProfile
            ? "Sem snapshots suficientes no Supabase, entao o dashboard voltou temporariamente para a leitura geral do radar, mas manteve o DNA da tua conta conectado na base editorial."
            : "Sem snapshots suficientes no Supabase, o dashboard voltou temporariamente para a leitura geral do radar.",
        tone: buildDashboardTone(primaryTrackFallback),
        supportingPoints: [
          `${addNowQueueFallback.length} faixas prontas para adicionar`,
          biggestRiseFallback
            ? `Maior subida: ${biggestRiseFallback.name} ${formatSignedValue(biggestRiseFallback.rankChange ?? 0)}`
            : "Sem subida forte no recorte",
          accountProfile
            ? `${accountProfile.playlistsCount} playlists da conta cruzadas`
            : `${removeQueueFallback.length} pedem teste ou limpeza`,
        ],
      },
      primaryAction: {
        track: primaryTrackFallback,
        reason: primaryTrackFallback
          ? buildDecisionSummary(primaryTrackFallback)
          : "Ainda nao houve combinacao forte o suficiente entre radar e base para uma acao unica.",
      },
      metrics: [
        {
          title: "Entrar agora",
          value: formatCount(addNowQueueFallback.length),
          helper: addNowFallback[0]
            ? `${addNowFallback[0].name} lidera a fila`
            : "Sem prioridade maxima",
          tone: "green",
        },
        {
          title: "Melhor score do dia",
          value: primaryTrackFallback ? `${primaryTrackFallback.decisionScore}` : "0",
          helper: primaryTrackFallback ? primaryTrackFallback.name : "Sem faixa lider",
          tone: buildDashboardTone(primaryTrackFallback),
        },
        {
          title: "Maior subida",
          value: biggestRiseFallback?.rankChange ? `+${biggestRiseFallback.rankChange}` : "0",
          helper: biggestRiseFallback ? biggestRiseFallback.name : "Sem aceleracao forte",
          tone: "green",
        },
        {
          title: "Novas entradas",
          value: accountProfile
            ? formatCount(accountProfile.uniqueTrackCount)
            : formatCount(
                radarMusic.rows.filter(
                  (row) =>
                    row.movement.type === "new" || row.movement.type === "reentry",
                ).length,
              ),
          helper: accountProfile
            ? `${accountProfile.repeatedTrackCount} faixas se repetem na tua base`
            : "Sinais frescos para discovery",
          tone: "purple",
        },
        {
          title: "Quedas na base",
          value: formatCount(removeQueueFallback.length),
          helper: "Pedem teste ou limpeza",
          tone: "red",
        },
        {
          title: accountProfile ? "Playlists da conta" : "Radar ativo",
          value: accountProfile ? formatCount(accountProfile.playlistsCount) : "Top 200",
          helper: accountProfile
            ? accountProfile.dominantGenreLabel
              ? `${accountProfile.dominantGenreLabel} domina a base`
              : `${accountProfile.repeatedTrackCount} faixas repetem na conta`
            : "Sem base pessoal conectada no dashboard",
          tone: "blue",
        },
      ],
      editorialSpotlights: editorialSpotlightsFallback,
      addNow: addNowFallback,
      observe: observeFallback,
      removeOrTest: removeFallback,
      topRadarRows: radarMusic.rows.slice(0, 4),
    };
  }

  const curationRows = buildCurationRows(
    radarRows,
    chartsData.tracks,
    chartsData.artistDistribution.map((artist) => artist.type),
    accountProfile,
  );
  const addNowQueue = curationRows
    .filter((row) => row.recommendedAction === "add")
    .sort(compareDecisionPriority);
  const observeQueue = curationRows
    .filter((row) => row.recommendedAction === "observe")
    .sort(compareDecisionPriority);
  const removeQueue = curationRows
    .filter((row) => row.recommendedAction === "remove")
    .sort(compareRemovePriority);
  const biggestRise = [...radarRows]
    .filter((row) => (row.rankChange ?? 0) > 0)
    .sort((left, right) => (right.rankChange ?? 0) - (left.rankChange ?? 0))[0];
  const addNow = addNowQueue.slice(0, 2);
  const observe = observeQueue.slice(0, 2);
  const removeOrTest = removeQueue.slice(0, 2);
  const accountBaseMatches = curationRows.filter(
    (row) => row.accountPlaylistCount > 0,
  ).length;
  const editorialSpotlights = buildDashboardEditorialSpotlights({
    addNowQueue,
    observeQueue,
    removeQueue,
    radarRows,
  });
  const primaryTrack = addNow[0] ?? observe[0] ?? null;

  return {
    hero: {
      eyebrow: "Visao do dia",
      title: "Curadoria do dia",
      description:
        "Painel executivo para decidir rapido o que entra, o que continua em observacao e o que ja pede ajuste na base.",
      primaryCtaLabel: "Ir para Curadoria",
      primaryCtaHref: "/curadoria",
      secondaryCtaLabel: "Abrir Radar Music",
      secondaryCtaHref: "/radar-music",
    },
    heroInsight: {
      headline: primaryTrack
        ? `${primaryTrack.name} e a melhor oportunidade editorial agora`
        : "O mercado ainda nao definiu uma prioridade absoluta hoje",
      summary:
        snapshotRadar.weeklyDate
          ? accountProfile
            ? "A leitura cruza o snapshot mais recente do top 200 com comparacao diaria e semanal do Supabase e com o DNA real das tuas playlists para transformar movimento em decisao pratica."
            : "A leitura cruza o snapshot mais recente do top 200 com comparacao diaria e semanal do Supabase para transformar movimento real em decisao pratica."
          : accountProfile
            ? "A leitura cruza o snapshot mais recente do top 200 com a ultima comparacao disponivel no Supabase e com o DNA real das tuas playlists para transformar movimento em decisao pratica."
            : "A leitura cruza o snapshot mais recente do top 200 com a ultima comparacao disponivel no Supabase para transformar movimento real em decisao pratica.",
      tone: buildDashboardTone(primaryTrack),
      supportingPoints: [
        `${addNowQueue.length} faixas prontas para adicionar`,
        biggestRise
          ? `Maior subida: ${biggestRise.name} ${formatSignedValue(biggestRise.rankChange ?? 0)}`
          : "Sem subida forte no recorte",
        accountProfile
          ? `${accountProfile.playlistsCount} playlists da conta cruzadas`
          : snapshotRadar.latestDate
            ? `Leitura base ${snapshotRadar.latestDate}`
            : `${removeQueue.length} pedem teste ou limpeza`,
      ],
    },
    primaryAction: {
      track: primaryTrack,
      reason: primaryTrack
        ? buildDecisionSummary(primaryTrack)
        : "Ainda nao houve combinacao forte o suficiente entre radar e base para uma acao unica.",
    },
    metrics: [
      {
        title: "Entrar agora",
        value: formatCount(addNowQueue.length),
        helper: addNow[0] ? `${addNow[0].name} lidera a fila` : "Sem prioridade maxima",
        tone: "green",
      },
      {
        title: "Melhor score do dia",
        value: primaryTrack ? `${primaryTrack.decisionScore}` : "0",
        helper: primaryTrack ? primaryTrack.name : "Sem faixa lider",
        tone: buildDashboardTone(primaryTrack),
      },
      {
        title: "Maior subida",
        value: biggestRise?.rankChange ? `+${biggestRise.rankChange}` : "0",
        helper: biggestRise ? biggestRise.name : "Sem aceleracao forte",
        tone: "green",
      },
      {
        title: accountProfile ? "Ja na tua base" : "Novas entradas",
        value: accountProfile
          ? formatCount(accountBaseMatches)
          : formatCount(
              radarRows.filter(
                (row) =>
                  row.movement.type === "new" || row.movement.type === "reentry",
              ).length,
            ),
        helper: accountProfile
          ? `${accountProfile.uniqueTrackCount} faixas da tua conta mapeadas`
          : "Sinais frescos para discovery",
        tone: "purple",
      },
      {
        title: "Quedas na base",
        value: formatCount(
          removeQueue.length,
        ),
        helper: "Pedem teste ou limpeza",
        tone: "red",
      },
      {
        title: accountProfile ? "Playlists da conta" : "Radar ativo",
        value: accountProfile ? formatCount(accountProfile.playlistsCount) : "Top 200",
        helper: accountProfile
          ? accountProfile.dominantGenreLabel
            ? `${accountProfile.dominantGenreLabel} domina a conta`
            : `${accountProfile.repeatedTrackCount} faixas repetem na conta`
          : "Sem base pessoal conectada no dashboard",
        tone: "blue",
      },
    ],
    editorialSpotlights,
    addNow,
    observe,
    removeOrTest,
    topRadarRows: radarRows.slice(0, 4),
  };
}
