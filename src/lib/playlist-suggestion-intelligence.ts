import {
  GENRE_LABEL,
  type TrackGenre,
  detectGenre,
  detectPlaylistGenre,
  normalizeGenreText,
} from "@/lib/genre-detection";
import type {
  MusicIntelligenceCountry,
  MusicIntelligenceResponse,
  MusicIntelligenceTrack,
} from "@/types/music-intelligence";
import type { TrackGenreCardProfile } from "@/types/track-profile";

export type PlaylistSuggestionProfileTrack = {
  id: string;
  name: string;
  artists: string;
  genreProfile?: TrackGenreCardProfile | null;
};

export type PlaylistListeningCandidate = {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  imageUrl: string | null;
  durationLabel: string;
  spotifyUrl: string;
  popularity: number;
  market: MusicIntelligenceCountry;
  personalAffinityScore: number;
  recentPlayCount: number;
  lastPlayedAt: string | null;
  listeningSignal: string;
  genreProfile?: TrackGenreCardProfile | null;
};

export type PlaylistSuggestionSource = "chart" | "listening" | "hybrid";

export type PlaylistAccountSignal = {
  personalAffinityScore: number;
  listeningSignal: string;
};

export type PlaylistDecisionSuggestion = {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  imageUrl: string | null;
  durationLabel: string;
  spotifyUrl: string;
  popularity: number;
  market: MusicIntelligenceCountry;
  currentPosition: number | null;
  movement7d: number | null;
  opportunityScore: number | null;
  personalAffinityScore: number | null;
  playlistFitScore: number;
  saturationRisk: number;
  isNewEntry: boolean;
  source: PlaylistSuggestionSource;
  sourceLabel: "Chart" | "Sua conta" | "Conta + chart";
  recommendation: "add_now" | "watch";
  recommendationLabel: "Adicionar agora" | "Observar";
  explanation: string;
  signals: string[];
};

export type PlaylistSuggestionMarketQueue = {
  items: PlaylistDecisionSuggestion[];
  addNowCount: number;
  watchCount: number;
};

export type PlaylistSuggestionResponse = {
  summary: {
    latestChartDate: string | null;
    maxWindow: number;
    status: MusicIntelligenceResponse["summary"]["status"];
    statusLabel: string;
    playlistGenre: TrackGenre;
    playlistGenreLabel: string;
    candidatesEvaluated: number;
    compatibleCandidates: number;
    listeningSignalsAvailable: boolean;
    recentHistoryAvailable: boolean;
    personalizedCandidates: number;
    sourceMix: Record<PlaylistSuggestionSource, number>;
  };
  markets: Record<MusicIntelligenceCountry, PlaylistSuggestionMarketQueue>;
  playlistAccountSignals: Record<string, PlaylistAccountSignal>;
};

type PlaylistVibe = {
  moodTags: Set<string>;
  energyTags: Set<string>;
};

type CompatibleCandidate = {
  name: string;
  artists: string;
  genreProfile?: TrackGenreCardProfile | null;
};

const MARKET_ORDER: MusicIntelligenceCountry[] = ["BR", "GLOBAL"];
const MAX_ITEMS_PER_MARKET = 10;

/**
 * Gênero é um portão de entrada, não um bônus de score. Funk fica isolado;
 * Trap e Rap compartilham o mesmo universo editorial.
 */
const ALLOWED_GENRES: Partial<Record<TrackGenre, TrackGenre[]>> = {
  trap: ["trap", "rap"],
  rap: ["rap", "trap"],
  funk: ["funk"],
  pagode: ["pagode", "pagodao"],
  pagodao: ["pagodao", "pagode"],
  sertanejo: ["sertanejo", "piseiro"],
  piseiro: ["piseiro", "sertanejo"],
  pop: ["pop"],
  rock: ["rock"],
  reggae: ["reggae"],
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return `${value}`;
}

function normalizeArtist(value: string) {
  return normalizeGenreText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function artistNames(value: string) {
  return value
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bpart\.?\b/i)
    .map(normalizeArtist)
    .filter(Boolean);
}

function inferPlaylistGenre(
  name: string,
  description: string,
  tracks: PlaylistSuggestionProfileTrack[],
) {
  const explicitGenre = detectPlaylistGenre(name, description);
  if (explicitGenre !== "unknown") return explicitGenre;

  const counts = new Map<TrackGenre, number>();
  for (const track of tracks) {
    const genre =
      getProfileGenre(track.genreProfile) ??
      detectGenre(track.artists, track.name);
    if (genre !== "unknown") {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }

  return (
    [...counts.entries()].sort(
      ([leftGenre, leftCount], [rightGenre, rightCount]) =>
        rightCount - leftCount || leftGenre.localeCompare(rightGenre),
    )[0]?.[0] ?? "unknown"
  );
}

function collectMarketCandidates(
  intelligence: MusicIntelligenceResponse,
  market: MusicIntelligenceCountry,
) {
  const marketQueue = intelligence.markets[market];
  const sources = [
    marketQueue.nextBestOpportunity,
    ...marketQueue.addNow,
    ...marketQueue.watch,
    ...intelligence.signals.topRisers.filter(
      (track) => track.primaryCountry === market,
    ),
    ...intelligence.signals.newEntries.filter(
      (track) => track.primaryCountry === market,
    ),
    ...(intelligence.candidatePool?.[market] ?? []),
  ];
  const candidates = new Map<string, MusicIntelligenceTrack>();

  for (const track of sources) {
    if (
      !track?.spotifyTrackId ||
      track.action === "review" ||
      candidates.has(track.spotifyTrackId)
    ) {
      continue;
    }
    candidates.set(track.spotifyTrackId, track);
  }

  return [...candidates.values()];
}

function getProfileGenre(
  profile: TrackGenreCardProfile | null | undefined,
): TrackGenre | null {
  if (!profile || profile.genreConfidence < 30) return null;

  const mapping = {
    funk: "funk",
    trap: "trap",
    rap: "rap",
    sertanejo: "sertanejo",
    piseiro_forro: "piseiro",
    pop: "pop",
    pop_global: "pop",
    rock: "rock",
    dance_eletronico: "pop",
    afro_latin: "unknown",
    desconhecido: "unknown",
  } satisfies Record<TrackGenreCardProfile["primaryGenre"], TrackGenre>;

  return mapping[profile.primaryGenre];
}

function buildPlaylistVibe(
  tracks: PlaylistSuggestionProfileTrack[],
): PlaylistVibe {
  const moodCounts = new Map<string, number>();
  const energyCounts = new Map<string, number>();

  for (const track of tracks) {
    for (const mood of track.genreProfile?.moodTags ?? []) {
      moodCounts.set(mood, (moodCounts.get(mood) ?? 0) + 1);
    }
    for (const energy of track.genreProfile?.energyTags ?? []) {
      energyCounts.set(energy, (energyCounts.get(energy) ?? 0) + 1);
    }
  }

  const strongest = (counts: Map<string, number>) =>
    new Set(
      [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .filter(([, count], _index, values) =>
          values[0]?.[1] && values[0][1] > 1 ? count > 1 : true,
        )
        .slice(0, 4)
        .map(([tag]) => tag),
    );

  return {
    moodTags: strongest(moodCounts),
    energyTags: strongest(energyCounts),
  };
}

function vibeCompatibility(
  profile: TrackGenreCardProfile | null | undefined,
  playlistVibe: PlaylistVibe,
) {
  const playlistTags = new Set([
    ...playlistVibe.moodTags,
    ...playlistVibe.energyTags,
  ]);
  const candidateTags = new Set([
    ...(profile?.moodTags ?? []),
    ...(profile?.energyTags ?? []),
  ]);

  if (playlistTags.size === 0 || candidateTags.size === 0) {
    return { score: null, sharedTags: [] as string[] };
  }

  const sharedTags = [...candidateTags].filter((tag) => playlistTags.has(tag));
  return {
    score:
      sharedTags.length > 0 ? Math.min(100, 78 + sharedTags.length * 11) : 55,
    sharedTags,
  };
}

function getCompatibility({
  candidate,
  playlistGenre,
  playlistArtists,
  playlistVibe,
}: {
  candidate: CompatibleCandidate;
  playlistGenre: TrackGenre;
  playlistArtists: Set<string>;
  playlistVibe: PlaylistVibe;
}) {
  const candidateArtists = artistNames(candidate.artists);
  const sharedArtist = candidateArtists.find((artist) =>
    playlistArtists.has(artist),
  );
  const candidateGenre =
    getProfileGenre(candidate.genreProfile) ??
    detectGenre(candidate.artists, candidate.name);
  const vibe = vibeCompatibility(candidate.genreProfile, playlistVibe);

  if (playlistGenre === "unknown") {
    return {
      compatible: Boolean(sharedArtist),
      score: sharedArtist ? 80 : 0,
      candidateGenre,
      reason: sharedArtist
        ? "Artista já presente no repertório da playlist."
        : "O universo musical da playlist ainda não está confirmado.",
    };
  }

  const allowed = ALLOWED_GENRES[playlistGenre] ?? [playlistGenre];
  if (candidateGenre === "unknown" || !allowed.includes(candidateGenre)) {
    return {
      compatible: false,
      score: 0,
      candidateGenre,
      reason:
        "Faixa bloqueada por não pertencer ao universo musical da playlist.",
    };
  }

  const exactGenre = candidateGenre === playlistGenre;
  const genreScore = exactGenre ? 100 : 88;
  const score = Math.round(
    vibe.score === null ? genreScore : genreScore * 0.85 + vibe.score * 0.15,
  );
  const genreReason = exactGenre
    ? `Compatível com o perfil ${GENRE_LABEL[playlistGenre]} da playlist.`
    : `Pertence ao mesmo universo ${GENRE_LABEL[playlistGenre]} da playlist.`;
  const vibeReason = vibe.sharedTags.length
    ? `Vibe alinhada em ${vibe.sharedTags.slice(0, 2).join(" e ")}.`
    : "";
  const artistReason = sharedArtist ? "Artista já presente no repertório." : "";

  return {
    compatible: true,
    score,
    candidateGenre,
    reason: [genreReason, vibeReason, artistReason].filter(Boolean).join(" "),
  };
}

function buildSuggestion({
  chart,
  listening,
  market,
  compatibility,
}: {
  chart?: MusicIntelligenceTrack;
  listening?: PlaylistListeningCandidate;
  market: MusicIntelligenceCountry;
  compatibility: ReturnType<typeof getCompatibility>;
}): PlaylistDecisionSuggestion {
  const source: PlaylistSuggestionSource =
    chart && listening ? "hybrid" : listening ? "listening" : "chart";
  const opportunityScore = chart?.scores.opportunityScore ?? null;
  const personalAffinityScore = listening?.personalAffinityScore ?? null;
  const playlistFitScore = Math.round(
    clamp(
      compatibility.score * 0.55 +
        (personalAffinityScore ?? 50) * 0.3 +
        (opportunityScore ?? 50) * 0.15,
    ),
  );
  const saturationRisk = chart?.scores.saturationRisk ?? 0;
  const sourceSupportsAdd =
    chart?.action === "add_now" || (personalAffinityScore ?? 0) >= 65;
  const recommendation =
    sourceSupportsAdd && playlistFitScore >= 78 && saturationRisk < 55
      ? "add_now"
      : "watch";
  const marketLabel = market === "BR" ? "BR" : "Global";
  const signals: string[] = [];

  if (listening) signals.push(listening.listeningSignal);

  if (chart) {
    signals.push(`#${chart.currentPosition} no ${marketLabel}`);
    if (chart.isNewEntry) {
      signals.push("entrada recente");
    } else if ((chart.movement7d ?? 0) > 0) {
      signals.push(`+${chart.movement7d} posições em 7d`);
    } else if ((chart.movement7d ?? 0) < 0) {
      signals.push(`${chart.movement7d} posições em 7d`);
    }
    if (chart.streams)
      signals.push(`${compactNumber(chart.streams)} streams/dia`);
  }

  const behaviorReason = listening
    ? `Comportamento da conta: ${listening.listeningSignal}.`
    : "";
  const chartReason =
    chart?.explanation ?? "Fora dos charts monitorados agora.";

  return {
    id: (chart?.spotifyTrackId ?? listening?.id) as string,
    name: chart?.name ?? (listening?.name as string),
    artists: chart?.artists ?? (listening?.artists as string),
    albumName: listening?.albumName ?? "",
    imageUrl: chart?.coverUrl ?? listening?.imageUrl ?? null,
    durationLabel: listening?.durationLabel ?? "",
    spotifyUrl:
      chart?.spotifyUrl ??
      listening?.spotifyUrl ??
      `https://open.spotify.com/track/${chart?.spotifyTrackId}`,
    popularity: listening?.popularity ?? 0,
    market,
    currentPosition: chart?.currentPosition ?? null,
    movement7d: chart?.movement7d ?? null,
    opportunityScore,
    personalAffinityScore,
    playlistFitScore,
    saturationRisk,
    isNewEntry: chart?.isNewEntry ?? false,
    source,
    sourceLabel:
      source === "hybrid"
        ? "Conta + chart"
        : source === "listening"
          ? "Sua conta"
          : "Chart",
    recommendation,
    recommendationLabel:
      recommendation === "add_now" ? "Adicionar agora" : "Observar",
    explanation: [compatibility.reason, behaviorReason, chartReason]
      .filter(Boolean)
      .join(" "),
    signals: signals.slice(0, 4),
  };
}

export function buildPlaylistSuggestionIntelligence({
  playlist,
  intelligence,
  listening,
}: {
  playlist: {
    name: string;
    description: string;
    tracks: PlaylistSuggestionProfileTrack[];
  };
  intelligence: MusicIntelligenceResponse;
  listening?: {
    available: boolean;
    recentHistoryAvailable: boolean;
    candidates: PlaylistListeningCandidate[];
  };
}): PlaylistSuggestionResponse {
  const existingTrackIds = new Set(
    playlist.tracks.map((track) => track.id.trim()).filter(Boolean),
  );
  const playlistArtists = new Set(
    playlist.tracks.flatMap((track) => artistNames(track.artists)),
  );
  const playlistGenre = inferPlaylistGenre(
    playlist.name,
    playlist.description,
    playlist.tracks,
  );
  const playlistVibe = buildPlaylistVibe(playlist.tracks);
  const allListeningById = new Map(
    (listening?.candidates ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const listeningById = new Map(
    [...allListeningById.values()]
      .filter((candidate) => !existingTrackIds.has(candidate.id))
      .map((candidate) => [candidate.id, candidate]),
  );
  const playlistAccountSignals = Object.fromEntries(
    playlist.tracks.flatMap((track) => {
      const signal = allListeningById.get(track.id);
      return signal
        ? [
            [
              track.id,
              {
                personalAffinityScore: signal.personalAffinityScore,
                listeningSignal: signal.listeningSignal,
              },
            ] as const,
          ]
        : [];
    }),
  );
  const chartCandidatesByMarket = new Map(
    MARKET_ORDER.map((market) => [
      market,
      collectMarketCandidates(intelligence, market).filter(
        (candidate) =>
          candidate.spotifyTrackId &&
          !existingTrackIds.has(candidate.spotifyTrackId),
      ),
    ]),
  );
  const allChartIds = new Set(
    [...chartCandidatesByMarket.values()].flatMap((candidates) =>
      candidates.flatMap((candidate) =>
        candidate.spotifyTrackId ? [candidate.spotifyTrackId] : [],
      ),
    ),
  );
  const markets = {} as Record<
    MusicIntelligenceCountry,
    PlaylistSuggestionMarketQueue
  >;
  let candidatesEvaluated = 0;
  let compatibleCandidates = 0;

  for (const market of MARKET_ORDER) {
    const chartById = new Map(
      (chartCandidatesByMarket.get(market) ?? []).map((candidate) => [
        candidate.spotifyTrackId as string,
        candidate,
      ]),
    );
    const personalOnlyIds = [...listeningById.values()]
      .filter(
        (candidate) =>
          candidate.market === market && !allChartIds.has(candidate.id),
      )
      .map((candidate) => candidate.id);
    const candidateIds = [
      ...new Set([...chartById.keys(), ...personalOnlyIds]),
    ];
    candidatesEvaluated += candidateIds.length;

    const suggestions = candidateIds
      .map((id) => {
        const chart = chartById.get(id);
        const personal = listeningById.get(id);
        const candidate = {
          name: chart?.name ?? (personal?.name as string),
          artists: chart?.artists ?? (personal?.artists as string),
          genreProfile: chart?.genreProfile ?? personal?.genreProfile ?? null,
        };
        const compatibility = getCompatibility({
          candidate,
          playlistGenre,
          playlistArtists,
          playlistVibe,
        });
        return compatibility.compatible
          ? buildSuggestion({
              chart,
              listening: personal,
              market,
              compatibility,
            })
          : null;
      })
      .filter((suggestion): suggestion is PlaylistDecisionSuggestion =>
        Boolean(suggestion),
      )
      .sort(
        (left, right) =>
          (left.recommendation === "add_now" ? 0 : 1) -
            (right.recommendation === "add_now" ? 0 : 1) ||
          right.playlistFitScore - left.playlistFitScore ||
          (right.personalAffinityScore ?? 0) -
            (left.personalAffinityScore ?? 0) ||
          (right.opportunityScore ?? 0) - (left.opportunityScore ?? 0),
      );

    compatibleCandidates += suggestions.length;
    const items = suggestions.slice(0, MAX_ITEMS_PER_MARKET);
    markets[market] = {
      items,
      addNowCount: items.filter(
        (suggestion) => suggestion.recommendation === "add_now",
      ).length,
      watchCount: items.filter(
        (suggestion) => suggestion.recommendation === "watch",
      ).length,
    };
  }

  const visibleItems = MARKET_ORDER.flatMap((market) => markets[market].items);
  const sourceMix = visibleItems.reduce<
    Record<PlaylistSuggestionSource, number>
  >(
    (counts, suggestion) => {
      counts[suggestion.source] += 1;
      return counts;
    },
    { chart: 0, listening: 0, hybrid: 0 },
  );

  return {
    summary: {
      latestChartDate: intelligence.summary.latestChartDate,
      maxWindow: intelligence.summary.maxWindow,
      status: intelligence.summary.status,
      statusLabel: intelligence.summary.statusLabel,
      playlistGenre,
      playlistGenreLabel: GENRE_LABEL[playlistGenre],
      candidatesEvaluated,
      compatibleCandidates,
      listeningSignalsAvailable: listening?.available ?? false,
      recentHistoryAvailable: listening?.recentHistoryAvailable ?? false,
      personalizedCandidates: sourceMix.listening + sourceMix.hybrid,
      sourceMix,
    },
    markets,
    playlistAccountSignals,
  };
}
