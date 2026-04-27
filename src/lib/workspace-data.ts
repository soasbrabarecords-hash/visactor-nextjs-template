import "server-only";

import { subDays } from "date-fns";
import { getChartsData } from "@/lib/charts-data";
import { getDashboardData } from "@/lib/dashboard-data";
import { getMusicChartsData, getMusicGenreOptions, getMusicMarketOptions } from "@/lib/music-charts-data";
import {
  fetchPlaylistSnapshots,
  type PlaylistSnapshotRow,
} from "@/lib/playlist-snapshot-store";
import {
  extractSpotifyPlaylistId,
  fetchSpotifyPlaylistTracks,
} from "@/lib/spotify";
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
      name: track.name,
      artists: track.artists,
      genre: track.genre,
      albumName: track.albumName,
      popularity: track.popularity,
      dailyStreams: track.dailyStreams,
      streamRank: track.streamRank,
      streamGrowth: track.streamGrowth,
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
      scoreBreakdown: row.scoreBreakdown,
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
  const periodLabel = getPeriodLabel(selectedPeriod);
  const [musicData, chartsData] = await Promise.all([
    getMusicChartsData({ country, genre }),
    getChartsData(),
  ]);
  const rows = buildRadarRows(
    musicData.workbenchTracks,
    chartsData.tracks,
    musicData.dominantArtists.map((artist) => artist.artistName),
  );
  const filteredRows = filterRadarRows(rows, selectedStatus);

  return {
    hero: {
      eyebrow: "Mercado externo",
      title: "Radar Music Charts",
      description:
        "Chart musical para ler o que esta subindo, o que esta caindo e onde existe espaco real para discovery e construcao de novas playlists.",
      primaryCtaLabel: "Ir para Curadoria",
      primaryCtaHref: "/curadoria",
      secondaryCtaLabel: "Ver Playlists Monitoradas",
      secondaryCtaHref: "/playlists-monitoradas",
    },
    heroInsight: buildRadarMusicHeroInsight({
      rows,
      movementContext: musicData.movementContext,
      hottestGenres: musicData.hottestGenres,
      dominantArtists: musicData.dominantArtists,
    }),
    editorialHero: buildRadarMusicEditorialHero({
      rows,
      countryLabel: musicData.countryLabel,
      genreLabel: musicData.genreLabel,
      periodLabel,
      movementContext: musicData.movementContext,
      hottestGenres: musicData.hottestGenres,
      dominantArtists: musicData.dominantArtists,
    }),
    genreSpotlights: buildRadarMusicGenreSpotlights({
      rows,
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
      rows,
      musicData.movementContext.hasSufficientHistory,
    ),
    rows: filteredRows,
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
      title: "Playlists Monitoradas",
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
      title: "Playlists Monitoradas",
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
      secondaryCtaLabel: "Ver Playlists Monitoradas",
      secondaryCtaHref: "/playlists-monitoradas",
    },
    heroInsight: buildCurationHeroInsight(rows),
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
    heroInsight: {
      headline: addNow[0]
        ? `${addNow[0].artists.split(",")[0]} puxa a decisao com ${addNow[0].name}`
        : "O mercado ainda nao definiu uma prioridade absoluta hoje",
      summary:
        "Esse destaque resume a melhor oportunidade do sistema agora com base em movimento, saturacao, recorrencia e aderencia editorial.",
      tone: addNow[0]?.movement.tone ?? "yellow",
      supportingPoints: [
        `${addNowQueue.length} faixas prontas para adicionar`,
        `${radarMusic.rows.filter((row) => row.movement.type === "up").length} subindo`,
        `${baseData.rows.length} playlists monitoradas`,
      ],
    },
    primaryAction: {
      track: addNow[0] ?? null,
      reason: addNow[0]
        ? `${addNow[0].name} combina score ${addNow[0].decisionScore}, ${addNow[0].chartDeltaLabel.toLowerCase()} e ${addNow[0].fitLabel.toLowerCase()} com a sua base.`
        : "Ainda nao houve combinacao forte o suficiente entre radar e base para uma acao unica.",
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
