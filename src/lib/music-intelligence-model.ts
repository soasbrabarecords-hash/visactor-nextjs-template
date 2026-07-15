import type {
  MusicIntelligenceAction,
  MusicIntelligenceCountry,
  MusicIntelligenceResponse,
  MusicIntelligenceScores,
  MusicIntelligenceStatus,
  MusicIntelligenceTrack,
  MusicIntelligenceWindow,
} from "@/types/music-intelligence";

export type MusicIntelligenceSnapshotRef = {
  snapshotId: string;
  country: MusicIntelligenceCountry;
  chartDate: string;
  tracksCount: number;
};

export type MusicIntelligenceSourceTrack = {
  id: string;
  snapshotId: string;
  chartDate: string;
  position: number;
  previousPosition: number | null;
  spotifyTrackId: string | null;
  trackName: string;
  artistName: string | null;
  streams: number | null;
  imageUrl: string | null;
};

export type MusicIntelligenceModelInput = {
  snapshots: MusicIntelligenceSnapshotRef[];
  tracks: MusicIntelligenceSourceTrack[];
  fallbackImageUrls?: ReadonlyMap<string, string>;
  generatedAt?: string;
  validatedMaxWindow?: number;
};

const WINDOWS = [7, 14, 30, 60, 90, 180, 365] as const;
const COUNTRY_ORDER: MusicIntelligenceCountry[] = ["BR", "GLOBAL"];
const MAX_QUEUE_ITEMS = 6;

type TrackHistory = {
  current: Partial<
    Record<MusicIntelligenceCountry, MusicIntelligenceSourceTrack>
  >;
  byCountry: Record<
    MusicIntelligenceCountry,
    Map<string, MusicIntelligenceSourceTrack>
  >;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number) {
  return Math.round(clamp(value));
}

function dateToUtc(date: string) {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function daysBetween(later: string, earlier: string) {
  return Math.max(
    0,
    Math.round((dateToUtc(later) - dateToUtc(earlier)) / 86_400_000),
  );
}

function subtractDays(date: string, amount: number) {
  const next = new Date(dateToUtc(date));
  next.setUTCDate(next.getUTCDate() - amount);
  return next.toISOString().slice(0, 10);
}

function normalizeIdentity(track: MusicIntelligenceSourceTrack) {
  if (track.spotifyTrackId?.trim()) {
    return track.spotifyTrackId.trim();
  }

  return `${track.trackName.trim().toLocaleLowerCase("pt-BR")}::${(
    track.artistName ?? ""
  )
    .trim()
    .toLocaleLowerCase("pt-BR")}`;
}

function normalizeSpotifyTrackId(value: string | null) {
  const normalized = value?.trim() ?? "";
  return /^[A-Za-z0-9]{22}$/.test(normalized) ? normalized : null;
}

function normalizeImageUrl(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return /^https:\/\//i.test(normalized) ? normalized : null;
}

function rankStrength(position: number | null | undefined) {
  if (!position || position < 1) {
    return 0;
  }

  return clamp(((201 - Math.min(position, 200)) / 200) * 100);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  return Math.sqrt(average(values.map((value) => Math.pow(value - mean, 2))));
}

function combineRegionalScores(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  if (values.length === 1) {
    return values[0];
  }

  const sorted = [...values].sort((left, right) => right - left);
  return sorted[0] * 0.6 + sorted[1] * 0.4;
}

function contiguousDays(dates: string[], latestDate: string) {
  const dateSet = new Set(dates);
  let count = 0;

  while (dateSet.has(subtractDays(latestDate, count))) {
    count += 1;
  }

  return count;
}

function getPositionAtOffset(
  history: Map<string, MusicIntelligenceSourceTrack>,
  latestDate: string,
  offset: number,
) {
  return history.get(subtractDays(latestDate, offset))?.position ?? null;
}

function movementFrom(
  currentPosition: number,
  history: Map<string, MusicIntelligenceSourceTrack>,
  latestDate: string,
  offset: number,
) {
  const oldPosition = getPositionAtOffset(history, latestDate, offset);
  return oldPosition === null ? null : oldPosition - currentPosition;
}

function freshnessForRegion(
  history: Map<string, MusicIntelligenceSourceTrack>,
  latestDate: string,
) {
  const buckets = [7, 14, 30, 60, 90] as const;
  const scores = [100, 80, 60, 35, 15] as const;

  for (let index = 0; index < buckets.length; index += 1) {
    if (!history.has(subtractDays(latestDate, buckets[index]))) {
      return scores[index];
    }
  }

  return 0;
}

function stabilityForRegion(
  history: Map<string, MusicIntelligenceSourceTrack>,
  latestDate: string,
) {
  const positions: number[] = [];

  for (let offset = 0; offset < 30; offset += 1) {
    const position = getPositionAtOffset(history, latestDate, offset);
    if (position !== null) {
      positions.push(position);
    }
  }

  const presenceRate = positions.length / 30;
  const consistency = clamp(100 - 2 * standardDeviation(positions));
  return 0.7 * presenceRate * 100 + 0.3 * consistency;
}

function momentumForRegion(
  currentPosition: number,
  history: Map<string, MusicIntelligenceSourceTrack>,
  latestDate: string,
) {
  const delta7 = movementFrom(currentPosition, history, latestDate, 7);
  const delta14 = movementFrom(currentPosition, history, latestDate, 14);
  const delta30 = movementFrom(currentPosition, history, latestDate, 30);
  const knownDeltas = [delta7, delta14, delta30].filter(
    (value): value is number => value !== null,
  );

  if (knownDeltas.length === 0) {
    return freshnessForRegion(history, latestDate) >= 80 ? 70 : 50;
  }

  return clamp(
    50 + 2 * (delta7 ?? 0) + 0.75 * (delta14 ?? 0) + 0.3 * (delta30 ?? 0),
  );
}

function getPeak(
  histories: Map<string, MusicIntelligenceSourceTrack>[],
  latestDate: string,
) {
  const observations = histories.flatMap((history) => [...history.values()]);
  const peak = observations.reduce<MusicIntelligenceSourceTrack | null>(
    (best, observation) =>
      !best || observation.position < best.position ? observation : best,
    null,
  );

  return {
    position: peak?.position ?? 200,
    daysAgo: peak ? daysBetween(latestDate, peak.chartDate) : 0,
  };
}

function getFreshEntry(
  current: MusicIntelligenceSourceTrack,
  history: Map<string, MusicIntelligenceSourceTrack>,
  latestDate: string,
) {
  const previousDay = history.get(subtractDays(latestDate, 1));
  const observedDays7 = Array.from({ length: 7 }, (_, offset) =>
    history.has(subtractDays(latestDate, offset)),
  ).filter(Boolean).length;

  return (
    current.previousPosition === null ||
    (!previousDay && observedDays7 <= 3) ||
    (!history.has(subtractDays(latestDate, 7)) && observedDays7 <= 7)
  );
}

function buildExplanation(
  action: MusicIntelligenceAction,
  country: MusicIntelligenceCountry,
  movement7d: number | null,
  isNewEntry: boolean,
  crossoverScore: number,
  saturationRisk: number,
) {
  const market = country === "BR" ? "BR" : "Global";

  if (action === "review") {
    if (movement7d !== null && movement7d < 0) {
      return `Caiu ${Math.abs(movement7d)} posições em 7 dias no ${market} e mostra perda de tração. Revise o encaixe antes de manter prioridade.`;
    }

    return `O ciclo perdeu força e chegou a ${saturationRisk}% de risco. Evite priorizar agora e acompanhe a próxima leitura.`;
  }

  if (crossoverScore >= 55) {
    const movement =
      movement7d !== null && movement7d > 0
        ? `, com alta de ${movement7d} posições em 7 dias`
        : "";
    return `Aparece com força em BR e Global${movement}. É um sinal de crossover com bom potencial para teste.`;
  }

  if (isNewEntry) {
    return `Entrada recente no Top 200 ${market}, ainda com pouco histórico e risco de ciclo controlado. Vale observar ou testar cedo.`;
  }

  if (movement7d !== null && movement7d > 0) {
    return `Subiu ${movement7d} posições nos últimos 7 dias no ${market} e ainda preserva espaço de crescimento. Boa oportunidade para teste.`;
  }

  return action === "add_now"
    ? `Mantém força no chart ${market}, boa estabilidade e risco de ciclo baixo. É uma oportunidade consistente para testar hoje.`
    : `O sinal ainda está se formando no chart ${market}. Observe a próxima variação antes de ampliar a exposição.`;
}

function getAction(scores: MusicIntelligenceScores): MusicIntelligenceAction {
  if (scores.saturationRisk >= 65 || scores.momentumScore <= 30) {
    return "review";
  }

  if (
    scores.opportunityScore >= 65 &&
    scores.momentumScore >= 55 &&
    scores.saturationRisk < 50
  ) {
    return "add_now";
  }

  return "watch";
}

function actionLabel(action: MusicIntelligenceAction) {
  if (action === "add_now") {
    return "Adicionar agora";
  }

  if (action === "review") {
    return "Revisar / evitar";
  }

  return "Observar";
}

function buildArtistSignals(tracks: MusicIntelligenceTrack[]) {
  const artists = new Map<string, number[]>();

  for (const track of tracks) {
    const artist = track.artists.split(",")[0]?.trim();
    if (!artist) {
      continue;
    }

    const scores = artists.get(artist) ?? [];
    scores.push(track.scores.opportunityScore);
    artists.set(artist, scores);
  }

  return [...artists.entries()]
    .map(([artist, scores]) => ({
      artist,
      tracks: scores.length,
      averageOpportunityScore: Math.round(average(scores)),
    }))
    .sort(
      (left, right) =>
        right.averageOpportunityScore - left.averageOpportunityScore ||
        right.tracks - left.tracks,
    )
    .slice(0, 5);
}

function buildDecisionQueue(candidates: MusicIntelligenceTrack[]) {
  const sorted = [...candidates].sort(
    (left, right) =>
      right.scores.opportunityScore - left.scores.opportunityScore ||
      right.scores.momentumScore - left.scores.momentumScore ||
      left.currentPosition - right.currentPosition,
  );
  const addNow = sorted
    .filter((track) => track.action === "add_now")
    .slice(0, MAX_QUEUE_ITEMS);
  const watch = sorted
    .filter((track) => track.action === "watch")
    .slice(0, MAX_QUEUE_ITEMS);
  const review = [...candidates]
    .filter((track) => track.action === "review")
    .sort(
      (left, right) =>
        right.scores.saturationRisk - left.scores.saturationRisk ||
        left.scores.momentumScore - right.scores.momentumScore,
    )
    .slice(0, MAX_QUEUE_ITEMS);

  return {
    sorted,
    nextBestOpportunity:
      addNow[0] ?? sorted.find((track) => track.action !== "review") ?? null,
    addNow,
    watch,
    review,
  };
}

function buildTrackCandidate({
  identity,
  history,
  primaryCountry,
  latestChartDate,
  fallbackImageUrls,
  combineMarkets,
}: {
  identity: string;
  history: TrackHistory;
  primaryCountry: MusicIntelligenceCountry;
  latestChartDate: string;
  fallbackImageUrls: ReadonlyMap<string, string>;
  combineMarkets: boolean;
}): MusicIntelligenceTrack | null {
  const countries = COUNTRY_ORDER.filter((country) => history.current[country]);
  const current = history.current[primaryCountry];
  if (!current) {
    return null;
  }

  const scoreCountries = combineMarkets ? countries : [primaryCountry];
  const regionalHeat = scoreCountries.map((country) =>
    rankStrength(history.current[country]?.position),
  );
  const regionalMomentum = scoreCountries.map((country) =>
    momentumForRegion(
      history.current[country]?.position ?? 200,
      history.byCountry[country],
      latestChartDate,
    ),
  );
  const regionalFreshness = scoreCountries.map((country) =>
    freshnessForRegion(history.byCountry[country], latestChartDate),
  );
  const regionalStability = scoreCountries.map((country) =>
    stabilityForRegion(history.byCountry[country], latestChartDate),
  );
  const peak = getPeak(
    scoreCountries.map((country) => history.byCountry[country]),
    latestChartDate,
  );
  const heatScore = combineRegionalScores(regionalHeat);
  const momentumScore = combineRegionalScores(regionalMomentum);
  const freshnessScore = Math.max(...regionalFreshness);
  const stabilityScore = average(regionalStability);
  const currentBestPosition = Math.min(
    ...scoreCountries.map(
      (country) => history.current[country]?.position ?? 200,
    ),
  );
  const dropFromPeakRisk = clamp(
    ((currentBestPosition - peak.position) / 50) * 100,
  );
  const negativeMomentumRisk = clamp((50 - momentumScore) * 2);
  const daysSincePeakRisk = clamp((peak.daysAgo / 30) * 100);
  const saturationRisk =
    0.45 * dropFromPeakRisk +
    0.35 * negativeMomentumRisk +
    0.2 * daysSincePeakRisk;
  const appearedInBothRecently = COUNTRY_ORDER.every((country) =>
    Array.from({ length: 15 }, (_, offset) =>
      history.byCountry[country].has(subtractDays(latestChartDate, offset)),
    ).some(Boolean),
  );
  const allRegionalHeat = countries.map((country) =>
    rankStrength(history.current[country]?.position),
  );
  const crossoverScore =
    countries.length === 2
      ? clamp(25 + 0.5 * allRegionalHeat.reduce((sum, score) => sum + score, 0))
      : appearedInBothRecently
        ? 35
        : 0;
  const scores: MusicIntelligenceScores = {
    heatScore: roundScore(heatScore),
    momentumScore: roundScore(momentumScore),
    freshnessScore: roundScore(freshnessScore),
    stabilityScore: roundScore(stabilityScore),
    saturationRisk: roundScore(saturationRisk),
    crossoverScore: roundScore(crossoverScore),
    opportunityScore: roundScore(
      0.24 * heatScore +
        0.28 * momentumScore +
        0.16 * freshnessScore +
        0.12 * stabilityScore +
        0.1 * crossoverScore +
        0.1 * (100 - saturationRisk),
    ),
  };
  const action = getAction(scores);
  const primaryHistory = history.byCountry[primaryCountry];
  const movement24h = movementFrom(
    current.position,
    primaryHistory,
    latestChartDate,
    1,
  );
  const movement7d = movementFrom(
    current.position,
    primaryHistory,
    latestChartDate,
    7,
  );
  const isNewEntry = getFreshEntry(current, primaryHistory, latestChartDate);
  const observedDays30 = Array.from({ length: 30 }, (_, offset) =>
    primaryHistory.has(subtractDays(latestChartDate, offset)),
  ).filter(Boolean).length;
  const spotifyTrackId = normalizeSpotifyTrackId(current.spotifyTrackId);
  const coverUrl =
    countries
      .map((country) => normalizeImageUrl(history.current[country]?.imageUrl))
      .find((image): image is string => Boolean(image)) ??
    normalizeImageUrl(
      spotifyTrackId ? fallbackImageUrls.get(spotifyTrackId) : null,
    );

  return {
    id: identity,
    snapshotTrackId: current.id || null,
    spotifyTrackId,
    spotifyUrl: spotifyTrackId
      ? `https://open.spotify.com/track/${spotifyTrackId}`
      : null,
    name: current.trackName.trim() || "Faixa não identificada",
    artists: current.artistName?.trim() || "Artista não identificado",
    coverUrl,
    primaryCountry,
    countries,
    currentPosition: current.position,
    positions: Object.fromEntries(
      countries.map((country) => [country, history.current[country]?.position]),
    ),
    previousPosition: current.previousPosition,
    movement24h,
    movement7d,
    movement14d: movementFrom(
      current.position,
      primaryHistory,
      latestChartDate,
      14,
    ),
    movement30d: movementFrom(
      current.position,
      primaryHistory,
      latestChartDate,
      30,
    ),
    peakPosition: peak.position,
    streams: current.streams,
    observedDays30,
    isNewEntry,
    action,
    actionLabel: actionLabel(action),
    suggestedPlaylistName: null,
    explanation: buildExplanation(
      action,
      primaryCountry,
      movement7d,
      isNewEntry,
      scores.crossoverScore,
      scores.saturationRisk,
    ),
    scores,
  };
}

export function createEmptyMusicIntelligenceResponse(
  status: MusicIntelligenceStatus = "empty",
  detail = "Aguardando snapshots completos para iniciar a leitura.",
  generatedAt = new Date().toISOString(),
  summaryOverrides: Partial<MusicIntelligenceResponse["summary"]> = {},
): MusicIntelligenceResponse {
  const statusLabel = {
    empty: "Base vazia",
    partial: "Base parcial",
    ready: "Base pronta",
    unavailable: "Base indisponível",
  }[status];

  return {
    summary: {
      latestChartDate: null,
      availableDaysBR: 0,
      availableDaysGlobal: 0,
      totalTracksAnalyzed: 0,
      totalCandidates: 0,
      maxWindow: 0,
      availableWindows: [],
      windowStart: null,
      windowEnd: null,
      status,
      statusLabel,
      statusDetail: detail,
      newEntries: 0,
      topRisers: 0,
      biggestDrops: 0,
      ...summaryOverrides,
    },
    markets: {
      BR: {
        nextBestOpportunity: null,
        addNow: [],
        watch: [],
        review: [],
      },
      GLOBAL: {
        nextBestOpportunity: null,
        addNow: [],
        watch: [],
        review: [],
      },
    },
    nextBestOpportunity: null,
    addNow: [],
    watch: [],
    review: [],
    crossover: [],
    signals: {
      topRisers: [],
      newEntries: [],
      biggestDrops: [],
      risingArtists: [],
    },
    candidatePool: {
      BR: [],
      GLOBAL: [],
    },
    meta: {
      generatedAt,
      methodologyVersion: "v1",
      source: "spotify_chart_complete_snapshots",
    },
  };
}

export function buildMusicIntelligenceModel({
  snapshots,
  tracks,
  fallbackImageUrls = new Map(),
  generatedAt = new Date().toISOString(),
  validatedMaxWindow = 0,
}: MusicIntelligenceModelInput): MusicIntelligenceResponse {
  const refsByCountry = new Map<
    MusicIntelligenceCountry,
    MusicIntelligenceSnapshotRef[]
  >(
    COUNTRY_ORDER.map((country) => [
      country,
      snapshots
        .filter((snapshot) => snapshot.country === country)
        .sort((left, right) => right.chartDate.localeCompare(left.chartDate)),
    ]),
  );
  const brRefs = refsByCountry.get("BR") ?? [];
  const globalRefs = refsByCountry.get("GLOBAL") ?? [];

  if (brRefs.length === 0 || globalRefs.length === 0) {
    const latestAvailableDate = [brRefs[0]?.chartDate, globalRefs[0]?.chartDate]
      .filter((date): date is string => Boolean(date))
      .sort((left, right) => right.localeCompare(left))[0];

    return createEmptyMusicIntelligenceResponse(
      brRefs.length === 0 && globalRefs.length === 0 ? "empty" : "partial",
      "A inteligência precisa de snapshots completos em BR e Global.",
      generatedAt,
      {
        latestChartDate: latestAvailableDate ?? null,
        availableDaysBR: brRefs.length,
        availableDaysGlobal: globalRefs.length,
        totalTracksAnalyzed: tracks.length,
      },
    );
  }

  const globalDates = new Set(globalRefs.map((snapshot) => snapshot.chartDate));
  const latestChartDate = brRefs.find((snapshot) =>
    globalDates.has(snapshot.chartDate),
  )?.chartDate;

  if (!latestChartDate) {
    return createEmptyMusicIntelligenceResponse(
      "partial",
      "BR e Global ainda não têm uma data completa em comum.",
      generatedAt,
      {
        availableDaysBR: brRefs.length,
        availableDaysGlobal: globalRefs.length,
        totalTracksAnalyzed: tracks.length,
      },
    );
  }

  const datesByCountry = new Map<MusicIntelligenceCountry, string[]>(
    COUNTRY_ORDER.map((country) => [
      country,
      (refsByCountry.get(country) ?? [])
        .map((snapshot) => snapshot.chartDate)
        .filter((date) => date <= latestChartDate),
    ]),
  );
  const contiguousBR = contiguousDays(
    datesByCountry.get("BR") ?? [],
    latestChartDate,
  );
  const contiguousGlobal = contiguousDays(
    datesByCountry.get("GLOBAL") ?? [],
    latestChartDate,
  );
  const commonDays = Math.min(contiguousBR, contiguousGlobal);
  const availableWindows = WINDOWS.filter(
    (window) => window <= commonDays && window <= validatedMaxWindow,
  ) as MusicIntelligenceWindow[];
  const maxWindow = availableWindows.at(-1) ?? 0;
  const windowStart =
    maxWindow > 0
      ? subtractDays(latestChartDate, maxWindow - 1)
      : latestChartDate;
  const refBySnapshotId = new Map(
    snapshots.map((snapshot) => [snapshot.snapshotId, snapshot] as const),
  );
  const histories = new Map<string, TrackHistory>();

  for (const track of tracks) {
    const snapshot = refBySnapshotId.get(track.snapshotId);
    if (
      !snapshot ||
      snapshot.chartDate > latestChartDate ||
      snapshot.chartDate < windowStart
    ) {
      continue;
    }

    const identity = normalizeIdentity(track);
    const history: TrackHistory = histories.get(identity) ?? {
      current: {},
      byCountry: {
        BR: new Map<string, MusicIntelligenceSourceTrack>(),
        GLOBAL: new Map<string, MusicIntelligenceSourceTrack>(),
      },
    };

    history.byCountry[snapshot.country].set(snapshot.chartDate, track);
    if (snapshot.chartDate === latestChartDate) {
      history.current[snapshot.country] = track;
    }
    histories.set(identity, history);
  }

  const candidates: MusicIntelligenceTrack[] = [];
  const marketCandidates: Record<
    MusicIntelligenceCountry,
    MusicIntelligenceTrack[]
  > = {
    BR: [],
    GLOBAL: [],
  };

  for (const [identity, history] of histories) {
    const countries = COUNTRY_ORDER.filter(
      (country) => history.current[country],
    );
    if (countries.length === 0) {
      continue;
    }

    const primaryCountry: MusicIntelligenceCountry = history.current.BR
      ? "BR"
      : "GLOBAL";
    const combinedCandidate = buildTrackCandidate({
      identity,
      history,
      primaryCountry,
      latestChartDate,
      fallbackImageUrls,
      combineMarkets: true,
    });
    if (combinedCandidate) {
      candidates.push(combinedCandidate);
    }

    for (const country of countries) {
      const marketCandidate = buildTrackCandidate({
        identity,
        history,
        primaryCountry: country,
        latestChartDate,
        fallbackImageUrls,
        combineMarkets: false,
      });
      if (marketCandidate) {
        marketCandidates[country].push(marketCandidate);
      }
    }
  }

  const combinedQueue = buildDecisionQueue(candidates);
  const sorted = combinedQueue.sorted;
  const addNow = combinedQueue.addNow;
  const watch = combinedQueue.watch;
  const review = combinedQueue.review;
  const brQueue = buildDecisionQueue(marketCandidates.BR);
  const globalQueue = buildDecisionQueue(marketCandidates.GLOBAL);
  const candidatePool = {
    BR: [...marketCandidates.BR].sort(
      (left, right) =>
        right.scores.opportunityScore - left.scores.opportunityScore ||
        right.scores.momentumScore - left.scores.momentumScore ||
        left.currentPosition - right.currentPosition,
    ),
    GLOBAL: [...marketCandidates.GLOBAL].sort(
      (left, right) =>
        right.scores.opportunityScore - left.scores.opportunityScore ||
        right.scores.momentumScore - left.scores.momentumScore ||
        left.currentPosition - right.currentPosition,
    ),
  };
  const crossover = [...candidates]
    .filter((track) => track.scores.crossoverScore >= 55)
    .sort(
      (left, right) =>
        right.scores.crossoverScore - left.scores.crossoverScore ||
        right.scores.opportunityScore - left.scores.opportunityScore,
    )
    .slice(0, MAX_QUEUE_ITEMS);
  const topRisers = [...candidates]
    .filter(
      (track) => (track.movement7d ?? 0) >= 10 || (track.movement24h ?? 0) >= 5,
    )
    .sort(
      (left, right) =>
        (right.movement7d ?? right.movement24h ?? 0) -
        (left.movement7d ?? left.movement24h ?? 0),
    );
  const newEntries = sorted.filter((track) => track.isNewEntry);
  const biggestDrops = [...candidates]
    .filter(
      (track) =>
        (track.movement7d ?? 0) <= -10 || track.scores.saturationRisk >= 65,
    )
    .sort(
      (left, right) =>
        (left.movement7d ?? 0) - (right.movement7d ?? 0) ||
        right.scores.saturationRisk - left.scores.saturationRisk,
    );
  const nextBestOpportunity = combinedQueue.nextBestOpportunity;
  const totalTracksAnalyzed = tracks.length;
  const status: MusicIntelligenceStatus =
    commonDays >= 30 && maxWindow >= 30 ? "ready" : "partial";

  return {
    summary: {
      latestChartDate,
      availableDaysBR: brRefs.length,
      availableDaysGlobal: globalRefs.length,
      totalTracksAnalyzed,
      totalCandidates: candidates.length,
      maxWindow,
      availableWindows,
      windowStart,
      windowEnd: latestChartDate,
      status,
      statusLabel:
        status === "ready" ? `${maxWindow}d validados` : "Base parcial",
      statusDetail:
        maxWindow >= 365
          ? "BR e Global completos para inteligência de até 365 dias."
          : maxWindow >= 30
            ? `${commonDays} dias completos em BR e Global; janela analítica validada até ${maxWindow}d. A expansão para 365d continua separada.`
            : "Há snapshots completos, mas o gate de uma janela analítica validada não pôde ser confirmado.",
      newEntries: newEntries.length,
      topRisers: topRisers.length,
      biggestDrops: biggestDrops.length,
    },
    markets: {
      BR: {
        nextBestOpportunity: brQueue.nextBestOpportunity,
        addNow: brQueue.addNow,
        watch: brQueue.watch,
        review: brQueue.review,
      },
      GLOBAL: {
        nextBestOpportunity: globalQueue.nextBestOpportunity,
        addNow: globalQueue.addNow,
        watch: globalQueue.watch,
        review: globalQueue.review,
      },
    },
    nextBestOpportunity,
    addNow,
    watch,
    review,
    crossover,
    signals: {
      topRisers: topRisers.slice(0, MAX_QUEUE_ITEMS),
      newEntries: newEntries.slice(0, MAX_QUEUE_ITEMS),
      biggestDrops: biggestDrops.slice(0, MAX_QUEUE_ITEMS),
      risingArtists: buildArtistSignals([...addNow, ...watch]),
    },
    candidatePool,
    meta: {
      generatedAt,
      methodologyVersion: "v1",
      source: "spotify_chart_complete_snapshots",
    },
  };
}
