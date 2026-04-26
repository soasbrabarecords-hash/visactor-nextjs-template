import "server-only";

import { subDays } from "date-fns";
import { getChartsData } from "@/lib/charts-data";
import { getDashboardData } from "@/lib/dashboard-data";
import { getMusicChartsData, getMusicGenreOptions, getMusicMarketOptions } from "@/lib/music-charts-data";
import {
  fetchMusicTrackSnapshots,
  type MusicTrackSnapshotRow,
} from "@/lib/music-snapshot-store";
import {
  fetchPlaylistSnapshots,
  type PlaylistSnapshotRow,
} from "@/lib/playlist-snapshot-store";
import type { PlaylistRecord } from "@/types/dashboard";
import type { TrackInsight } from "@/types/charts";
import type { MusicWorkbenchTrack } from "@/types/music-charts";
import type {
  CurationPageData,
  DashboardWorkspaceData,
  DecisionTrack,
  MovementDescriptor,
  MovementType,
  PeriodFilter,
  PlaylistBaseData,
  PlaylistBaseRow,
  RadarMusicPageData,
  RadarMusicRow,
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

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function formatSignedValue(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
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

function getPeriodDays(period: PeriodFilter) {
  switch (period) {
    case "today":
      return 1;
    case "30d":
      return 30;
    default:
      return 7;
  }
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
      };
    case "down":
      return {
        type,
        label: "Caiu",
        icon: "▼",
        tone: "red",
      };
    case "same":
      return {
        type,
        label: "Estavel",
        icon: "●",
        tone: "blue",
      };
    case "reentry":
      return {
        type,
        label: "RE",
        icon: "RE",
        tone: "purple",
      };
    default:
      return {
        type,
        label: "NEW",
        icon: "NEW",
        tone: "purple",
      };
  }
}

function buildSnapshotRanking(
  rows: MusicTrackSnapshotRow[],
  snapshotDate: string,
): Map<string, number> {
  const rankingRows = rows
    .filter(
      (row): row is MusicTrackSnapshotRow & { track_id: string } =>
        row.snapshot_date === snapshotDate && Boolean(row.track_id),
    )
    .sort((left, right) => {
      const signalDifference =
        toNumber(right.signal_count) - toNumber(left.signal_count);

      if (signalDifference !== 0) {
        return signalDifference;
      }

      const popularityDifference =
        toNumber(right.popularity) - toNumber(left.popularity);

      if (popularityDifference !== 0) {
        return popularityDifference;
      }

      return (left.track_name ?? "").localeCompare(right.track_name ?? "");
    });

  return new Map(
    rankingRows.map((row, index) => [row.track_id, index + 1] as const),
  );
}

function buildDaysOnRadar(
  rows: MusicTrackSnapshotRow[],
  currentDate: string,
  periodDays: number,
): Map<string, Set<string>> {
  const cutoff = subDays(new Date(`${currentDate}T12:00:00.000Z`), periodDays - 1)
    .toISOString()
    .slice(0, 10);
  const daysByTrack = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.track_id || !row.snapshot_date || row.snapshot_date < cutoff) {
      continue;
    }

    const trackDays = daysByTrack.get(row.track_id) ?? new Set<string>();
    trackDays.add(row.snapshot_date);
    daysByTrack.set(row.track_id, trackDays);
  }

  return daysByTrack;
}

function getLatestSnapshotDates(rows: MusicTrackSnapshotRow[]) {
  const uniqueDates = Array.from(
    new Set(
      rows
        .map((row) => row.snapshot_date)
        .filter((date): date is string => Boolean(date)),
    ),
  ).sort((left, right) => right.localeCompare(left));

  return {
    currentDate: uniqueDates[0] ?? new Date().toISOString().slice(0, 10),
    previousDate: uniqueDates[1] ?? null,
  };
}

function buildRadarRows(
  workbenchTracks: MusicWorkbenchTrack[],
  snapshotRows: MusicTrackSnapshotRow[],
  periodDays: number,
): RadarMusicRow[] {
  const { currentDate, previousDate } = getLatestSnapshotDates(snapshotRows);
  const previousRankMap = previousDate
    ? buildSnapshotRanking(snapshotRows, previousDate)
    : new Map<string, number>();
  const daysByTrack = buildDaysOnRadar(snapshotRows, currentDate, periodDays);

  return workbenchTracks.map((track) => {
    const previousRank = previousRankMap.get(track.id) ?? null;
    const daysOnRadar = daysByTrack.get(track.id)?.size ?? 1;
    const seenBefore = snapshotRows.some(
      (row) =>
        row.track_id === track.id &&
        Boolean(row.snapshot_date) &&
        (row.snapshot_date ?? "") < currentDate,
    );
    const seenInPreviousSnapshot = previousDate
      ? snapshotRows.some(
          (row) => row.track_id === track.id && row.snapshot_date === previousDate,
        )
      : false;
    const rankChange = previousRank === null ? null : previousRank - track.rank;

    let movementType: MovementType;

    if (previousRank === null) {
      movementType = seenBefore && !seenInPreviousSnapshot ? "reentry" : "new";
    } else if (rankChange > 0) {
      movementType = "up";
    } else if (rankChange < 0) {
      movementType = "down";
    } else {
      movementType = "same";
    }

    return {
      rank: track.rank,
      movement: buildMovementDescriptor(movementType),
      trackId: track.id,
      name: track.name,
      artists: track.artists,
      albumName: track.albumName,
      popularity: track.popularity,
      previousRank,
      rankChange,
      daysOnRadar,
      opportunityScore: track.opportunityScore,
      spotifyUrl: track.spotifyUrl,
      coverUrl: track.coverUrl,
      statusTags: track.tags,
      lowSaturation: track.lowSaturation,
      recurring: daysOnRadar >= 3 || track.isRecurring,
      alreadyInPlaylists: false,
    };
  });
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

function buildRadarMusicSummary(rows: RadarMusicRow[]) {
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

  return [
    {
      title: "Top musica agora",
      value: topTrack?.name ?? "Sem dado",
      helper: topTrack ? `Rank #${topTrack.rank}` : "Sem leitura",
      tone: "green" as const,
    },
    {
      title: "Maior subida",
      value: biggestRise?.name ?? "Sem alta",
      helper:
        biggestRise && biggestRise.rankChange !== null
          ? `${formatSignedValue(biggestRise.rankChange)} posicoes`
          : "Sem historico",
      tone: "green" as const,
    },
    {
      title: "Maior queda",
      value: biggestDrop?.name ?? "Sem queda",
      helper:
        biggestDrop && biggestDrop.rankChange !== null
          ? `${formatSignedValue(biggestDrop.rankChange)} posicoes`
          : "Sem historico",
      tone: "red" as const,
    },
    {
      title: "Novas entradas",
      value: formatCount(newEntries),
      helper: "Novas ou retornando",
      tone: "purple" as const,
    },
    {
      title: "Oportunidades",
      value: formatCount(opportunities),
      helper: "Baixa saturacao",
      tone: "yellow" as const,
    },
  ];
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

function buildCurationRows(
  radarRows: RadarMusicRow[],
  playlistTracks: TrackInsight[],
  dominantArtists: string[],
): DecisionTrack[] {
  const playlistTrackIds = new Set(playlistTracks.map((track) => track.id));

  return radarRows.slice(0, 40).map((row) => {
    const alreadyInPlaylists = playlistTrackIds.has(row.trackId);
    const normalizedArtists = row.artists.toLowerCase();
    const artistFit = dominantArtists.some((artist) =>
      normalizedArtists.includes(artist.toLowerCase()),
    );
    const fitLabel = alreadyInPlaylists || artistFit
      ? "Fit alto"
      : row.lowSaturation || row.recurring
        ? "Fit medio"
        : "Fit baixo";
    const movementWeight =
      row.rankChange === null
        ? row.movement.type === "new" || row.movement.type === "reentry"
          ? 14
          : 6
        : clamp(row.rankChange * 5, -20, 20);
    const fitWeight = fitLabel === "Fit alto" ? 18 : fitLabel === "Fit medio" ? 10 : 3;
    const recurringWeight = row.recurring ? 10 : 3;
    const saturationWeight = row.lowSaturation ? 14 : 4;
    const baseWeight = alreadyInPlaylists ? -6 : 8;
    const decisionScore = clamp(
      Math.round(
        row.popularity * 0.32 +
          row.opportunityScore * 0.34 +
          movementWeight +
          fitWeight +
          recurringWeight +
          saturationWeight +
          baseWeight,
      ),
      0,
      100,
    );

    let recommendedAction: DecisionTrack["recommendedAction"];

    if (row.movement.type === "down" && alreadyInPlaylists && decisionScore < 58) {
      recommendedAction = "remove";
    } else if (decisionScore >= 78 && !alreadyInPlaylists) {
      recommendedAction = "add";
    } else if (decisionScore >= 60) {
      recommendedAction = "observe";
    } else {
      recommendedAction = "ignore";
    }

    return {
      trackId: row.trackId,
      name: row.name,
      artists: row.artists,
      albumName: row.albumName,
      coverUrl: row.coverUrl,
      spotifyUrl: row.spotifyUrl,
      popularity: row.popularity,
      movement: row.movement,
      chartDeltaLabel:
        row.rankChange === null
          ? row.movement.type === "reentry"
            ? "RE no radar"
            : "Sem historico"
          : `${formatSignedValue(row.rankChange)} no chart`,
      lowSaturation: row.lowSaturation,
      recurring: row.recurring,
      alreadyInPlaylists,
      fitLabel,
      decisionScore,
      recommendedAction,
    };
  });
}

function buildActionItems(rows: DecisionTrack[], fallback: string) {
  return rows.length > 0
    ? rows.map((track) => `${track.name} · ${track.artists}`)
    : [fallback];
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
  const periodDays = getPeriodDays(selectedPeriod);
  const musicData = await getMusicChartsData({ country, genre });
  const snapshotRows = await fetchMusicTrackSnapshots({
    market: musicData.countryValue,
    genre: musicData.genreValue,
    days: 30,
  });
  const rows = buildRadarRows(musicData.workbenchTracks, snapshotRows, periodDays);

  return {
    hero: {
      eyebrow: "Mercado externo",
      title: "Radar Music",
      description:
        "Chart musical para ler o que esta subindo, o que esta caindo e onde existe espaco real para discovery e construcao de novas playlists.",
      primaryCtaLabel: "Ir para Curadoria",
      primaryCtaHref: "/curadoria",
      secondaryCtaLabel: "Ver Radar Playlists",
      secondaryCtaHref: "/radar-playlists",
    },
    filters: {
      countryOptions: getMusicMarketOptions(),
      genreOptions: getMusicGenreOptions(),
      periodOptions: [...PERIOD_OPTIONS],
      statusOptions: [...STATUS_OPTIONS],
      selectedCountry: musicData.countryValue,
      selectedGenre: musicData.genreValue,
      selectedPeriod,
      selectedStatus,
    },
    summaryCards: buildRadarMusicSummary(rows),
    rows: filterRadarRows(rows, selectedStatus),
    support: {
      sourceModeLabel: musicData.dataTrust.sourceModeLabel,
      sourceModeDescription: musicData.dataTrust.sourceModeDescription,
      updatedAtLabel: musicData.dataTrust.updatedAtLabel,
      sampleSize: musicData.dataTrust.sampleSize,
      historyDaysTracked: musicData.dataTrust.historyDaysTracked,
      marketHighlight: musicData.dataTrust.marketHighlight,
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
      title: "Radar Playlists",
      description:
        "Leitura cruzada das playlists monitoradas para saber quais faixas realmente estao se repetindo na sua base e quais tambem estao acelerando no radar externo.",
      primaryCtaLabel: "Abrir Radar Music",
      primaryCtaHref: "/radar-music",
      secondaryCtaLabel: "Ir para Curadoria",
      secondaryCtaHref: "/curadoria",
    },
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

  return {
    hero: {
      eyebrow: "Base operacional",
      title: "Base de Playlists",
      description:
        "Area dedicada para cadastrar novas URLs, acompanhar score, monitorar a saude da base e abrir a analise individual de cada playlist.",
      primaryCtaLabel: "Abrir Curadoria",
      primaryCtaHref: "/curadoria",
      secondaryCtaLabel: "Ver Radar Playlists",
      secondaryCtaHref: "/radar-playlists",
    },
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
  };
}

export async function getCurationPageData(): Promise<CurationPageData> {
  const [radarMusic, chartsData] = await Promise.all([
    getRadarMusicPageData({
      country: "BR",
      genre: "all",
      period: "7d",
      status: "all",
    }),
    getChartsData(),
  ]);
  const dominantArtists = chartsData.artistDistribution.map((artist) => artist.type);
  const rows = buildCurationRows(radarMusic.rows, chartsData.tracks, dominantArtists);

  return {
    hero: {
      eyebrow: "Mesa final",
      title: "Curadoria",
      description:
        "Fila final de decisao com score editorial, leitura de movimento e fit com a sua base para acelerar adicao, observacao e limpeza de repertorio.",
      primaryCtaLabel: "Abrir Radar Music",
      primaryCtaHref: "/radar-music",
      secondaryCtaLabel: "Ver Base de Playlists",
      secondaryCtaHref: "/base-playlists",
    },
    metrics: [
      {
        title: "Adicionar agora",
        value: formatCount(rows.filter((row) => row.recommendedAction === "add").length),
        helper: "Prioridade alta",
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
        helper: "Alta aderencia",
        tone: "blue",
      },
    ],
    rows,
  };
}

export async function getDashboardWorkspaceData(): Promise<DashboardWorkspaceData> {
  const [curationData, baseData, radarMusic] = await Promise.all([
    getCurationPageData(),
    getBasePlaylistsPageData(),
    getRadarMusicPageData({
      country: "BR",
      genre: "all",
      period: "7d",
      status: "all",
    }),
  ]);
  const bestPlaylist = [...baseData.rows].sort(
    (left, right) => right.playlist.score - left.playlist.score,
  )[0];
  const addNowQueue = curationData.rows.filter(
    (row) => row.recommendedAction === "add",
  );
  const observeQueue = curationData.rows.filter(
    (row) => row.recommendedAction === "observe",
  );
  const removeQueue = curationData.rows.filter(
    (row) => row.recommendedAction === "remove",
  );
  const addNow = addNowQueue.slice(0, 3);
  const observe = observeQueue.slice(0, 3);
  const removeOrTest = removeQueue.slice(0, 3);

  return {
    hero: {
      eyebrow: "Visao do dia",
      title: addNow[0]
        ? `${addNow[0].name} e a melhor janela de hoje`
        : "Radar operacional da curadoria",
      description:
        "Visao executiva para saber o que mexer agora: oportunidades, novos sinais, quedas relevantes e a melhor playlist da sua base.",
      primaryCtaLabel: "Ir para Curadoria",
      primaryCtaHref: "/curadoria",
      secondaryCtaLabel: "Abrir Radar Music",
      secondaryCtaHref: "/radar-music",
    },
    metrics: [
      {
        title: "Oportunidades de hoje",
        value: formatCount(addNowQueue.length),
        helper: "Prontas para entrar",
        tone: "green",
      },
      {
        title: "Novas entradas",
        value: formatCount(
          radarMusic.rows.filter(
            (row) =>
              row.movement.type === "new" || row.movement.type === "reentry",
          ).length,
        ),
        helper: "Sinais frescos",
        tone: "purple",
      },
      {
        title: "Faixas subindo",
        value: formatCount(
          radarMusic.rows.filter((row) => row.movement.type === "up").length,
        ),
        helper: "Momento positivo",
        tone: "green",
      },
      {
        title: "Faixas caindo",
        value: formatCount(
          radarMusic.rows.filter((row) => row.movement.type === "down").length,
        ),
        helper: "Ajuste necessario",
        tone: "red",
      },
      {
        title: "Playlists monitoradas",
        value: formatCount(baseData.rows.length),
        helper: "Base ativa",
        tone: "blue",
      },
      {
        title: "Melhor playlist por score",
        value: bestPlaylist?.playlist.name ?? "Sem playlist",
        helper: bestPlaylist ? `Score ${bestPlaylist.playlist.score}` : "Sem base",
        tone: "yellow",
      },
    ],
    recommendedActions: [
      {
        title: "Adicionar agora",
        summary:
          "Faixas com melhor equilibrio entre subida, baixa saturacao e fit com sua base.",
        tone: "green",
        items: buildActionItems(
          addNow,
          "Ainda sem faixa pronta para entrada imediata.",
        ),
      },
      {
        title: "Observar",
        summary:
          "Sinais que ainda precisam de mais validacao antes de entrar na base principal.",
        tone: "yellow",
        items: buildActionItems(
          observe,
          "Nenhum sinal em observacao forte agora.",
        ),
      },
      {
        title: "Remover/Testar",
        summary:
          "Faixas com queda ou desgaste que pedem teste, troca ou limpeza de repertorio.",
        tone: "red",
        items: buildActionItems(
          removeOrTest,
          "Sem urgencia de remocao ou teste neste momento.",
        ),
      },
    ],
    addNow,
    observe,
    removeOrTest,
  };
}
