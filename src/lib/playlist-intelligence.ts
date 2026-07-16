export type PlaylistChartMovement = "up" | "down" | "stable" | "new";
export type PlaylistStreamTrend = "up" | "down" | "same" | null;

export type PlaylistIntelligenceTrackInput = {
  id: string;
  name: string;
  artists: string;
  imageUrl: string | null;
  currentIndex: number;
  popularity: number | null;
  chartPosition: number | null;
  chartMovement: PlaylistChartMovement | null;
  chartPositionChange: number | null;
  chartStreams: number | null;
  dailyStreams: number | null;
  dailyDelta: number | null;
  streamTrend: PlaylistStreamTrend;
  streamsLoading: boolean;
  signalsLoading: boolean;
  personalAffinityScore?: number | null;
  listeningSignal?: string | null;
};

export type PlaylistDecisionAction =
  "priority" | "raise" | "keep" | "lower" | "test";

export type PlaylistTrackDecision = {
  trackKey: string;
  trackId: string;
  name: string;
  artists: string;
  imageUrl: string | null;
  currentIndex: number;
  suggestedIndex: number;
  score: number;
  action: PlaylistDecisionAction;
  label: string;
  tone: "green" | "blue" | "yellow" | "red" | "neutral";
  reason: string;
  signals: string[];
};

export type PlaylistIntelligenceSummary = {
  totalTracks: number;
  averageScore: number;
  chartMatches: number;
  streamMatches: number;
  accountMatches: number;
  orderChangesCount: number;
  priorityCount: number;
  raiseCount: number;
  reviewCount: number;
  confidenceLabel: string;
};

export type PlaylistIntelligenceResult = {
  decisions: PlaylistTrackDecision[];
  suggestedOrderTrackIds: string[];
  summary: PlaylistIntelligenceSummary;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return `${value}`;
}

function streamScore(value: number | null, maxScore: number) {
  if (!value || value <= 0) return 0;
  return (clamp(Math.log10(value) - 3, 0, 4) / 4) * maxScore;
}

function getChartScore(track: PlaylistIntelligenceTrackInput) {
  if (!track.chartPosition) return 0;

  const positionScore = ((201 - clamp(track.chartPosition, 1, 200)) / 200) * 34;
  const topBonus =
    track.chartPosition <= 25 ? 8 : track.chartPosition <= 50 ? 5 : 0;

  let movementScore = 0;
  if (track.chartMovement === "new") movementScore = 12;
  if (track.chartMovement === "up")
    movementScore = 8 + clamp(track.chartPositionChange ?? 0, 0, 25) * 0.2;
  if (track.chartMovement === "stable") movementScore = 3;
  if (track.chartMovement === "down")
    movementScore =
      -6 - clamp(Math.abs(track.chartPositionChange ?? 0), 0, 25) * 0.2;

  return (
    positionScore +
    topBonus +
    movementScore +
    streamScore(track.chartStreams, 8)
  );
}

function getStreamTrendScore(track: PlaylistIntelligenceTrackInput) {
  const dailyScore = streamScore(track.dailyStreams, 14);
  const deltaScore = track.dailyDelta
    ? clamp(track.dailyDelta / 50_000, -6, 6)
    : 0;

  if (track.streamTrend === "up") return dailyScore + 7 + deltaScore;
  if (track.streamTrend === "down") return dailyScore - 7 + deltaScore;
  return dailyScore + deltaScore;
}

function getSignals(track: PlaylistIntelligenceTrackInput, score: number) {
  const signals: string[] = [];

  if (
    track.personalAffinityScore !== null &&
    track.personalAffinityScore !== undefined
  ) {
    signals.push(
      track.listeningSignal ||
        `afinidade ${Math.round(track.personalAffinityScore)} na conta`,
    );
  }

  if (track.chartPosition) {
    signals.push(`#${track.chartPosition} no Spotify BR`);
  }

  if (track.chartMovement === "new") {
    signals.push("entrada nova no chart");
  } else if (track.chartMovement === "up" && track.chartPositionChange) {
    signals.push(`subiu ${Math.abs(track.chartPositionChange)} posicoes`);
  } else if (track.chartMovement === "down" && track.chartPositionChange) {
    signals.push(`caiu ${Math.abs(track.chartPositionChange)} posicoes`);
  }

  if (track.dailyStreams) {
    signals.push(`${compactNumber(track.dailyStreams)} streams/dia`);
  }

  if (track.streamTrend === "up") {
    signals.push("Kworb em alta");
  } else if (track.streamTrend === "down") {
    signals.push("Kworb em queda");
  }

  if (track.popularity !== null && track.popularity >= 75) {
    signals.push("popularidade forte");
  } else if (track.popularity !== null && track.popularity < 45) {
    signals.push("popularidade baixa");
  }

  if (signals.length === 0) {
    signals.push(
      track.signalsLoading
        ? "atualizando sinais"
        : score >= 55
          ? "base consistente"
          : "poucos sinais externos",
    );
  }

  return signals.slice(0, 3);
}

function getDecisionAction(
  track: PlaylistIntelligenceTrackInput,
  score: number,
  suggestedIndex: number,
): Pick<PlaylistTrackDecision, "action" | "label" | "tone" | "reason"> {
  const shift = track.currentIndex - suggestedIndex;
  const hasMarketSignal = Boolean(
    track.popularity !== null ||
    track.chartPosition ||
    track.dailyStreams ||
    track.personalAffinityScore != null,
  );

  if (!hasMarketSignal && !track.signalsLoading) {
    return {
      action: "keep",
      label: "Sem leitura",
      tone: "neutral",
      reason: "Ainda não há sinais suficientes para recomendar uma mudança.",
    };
  }

  if (score >= 78 && shift >= 2) {
    return {
      action: "priority",
      label: "Prioridade",
      tone: "green",
      reason: "Tem sinal forte para ganhar vitrine nesta semana.",
    };
  }

  if (score >= 62 && shift >= 3) {
    return {
      action: "raise",
      label: "Subir",
      tone: "blue",
      reason: "Os sinais atuais pedem uma posicao mais alta.",
    };
  }

  if (score < 42 && !hasMarketSignal && !track.signalsLoading) {
    return {
      action: "test",
      label: "Testar saida",
      tone: "red",
      reason: "Pouco sinal recente para ocupar espaco agora.",
    };
  }

  if (score < 50 && shift <= -4) {
    return {
      action: "lower",
      label: "Descer",
      tone: "yellow",
      reason: "Pode perder prioridade sem sair da playlist.",
    };
  }

  return {
    action: "keep",
    label: "Manter",
    tone: "neutral",
    reason: "Boa para manter enquanto acompanha novos dados.",
  };
}

export function buildPlaylistIntelligence(
  tracks: PlaylistIntelligenceTrackInput[],
): PlaylistIntelligenceResult {
  const scoredTracks = tracks.map((track) => {
    const popularityScore = clamp(track.popularity ?? 0, 0, 100) * 0.32;
    const marketScore = clamp(
      popularityScore + getChartScore(track) + getStreamTrendScore(track),
      0,
      100,
    );
    const hasAccountSignal =
      track.personalAffinityScore !== null &&
      track.personalAffinityScore !== undefined;
    const score = clamp(
      hasAccountSignal
        ? marketScore * 0.7 +
            clamp(track.personalAffinityScore as number, 0, 100) * 0.3
        : marketScore,
      0,
      100,
    );

    return {
      track,
      trackKey: `${track.id}:${track.currentIndex}`,
      score: Math.round(score),
    };
  });

  const suggested = [...scoredTracks].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.track.currentIndex - b.track.currentIndex;
  });

  const suggestedIndexByKey = new Map(
    suggested.map((item, index) => [item.trackKey, index]),
  );

  const decisions = scoredTracks.map(({ track, trackKey, score }) => {
    const suggestedIndex =
      suggestedIndexByKey.get(trackKey) ?? track.currentIndex;
    const action = getDecisionAction(track, score, suggestedIndex);
    const signals = getSignals(track, score);

    return {
      trackKey,
      trackId: track.id,
      name: track.name,
      artists: track.artists,
      imageUrl: track.imageUrl,
      currentIndex: track.currentIndex,
      suggestedIndex,
      score,
      signals,
      ...action,
    };
  });

  const chartMatches = tracks.filter((track) =>
    Boolean(track.chartPosition),
  ).length;
  const streamMatches = tracks.filter((track) =>
    Boolean(track.dailyStreams),
  ).length;
  const accountMatches = tracks.filter(
    (track) =>
      track.personalAffinityScore !== null &&
      track.personalAffinityScore !== undefined,
  ).length;
  const readyStreams = tracks.filter((track) => !track.streamsLoading).length;
  const orderChangesCount = decisions.filter(
    (decision) => decision.currentIndex !== decision.suggestedIndex,
  ).length;
  const averageScore = decisions.length
    ? Math.round(
        decisions.reduce((total, decision) => total + decision.score, 0) /
          decisions.length,
      )
    : 0;
  const signalCoverage = tracks.length
    ? (chartMatches + streamMatches + readyStreams) / (tracks.length * 3)
    : 0;

  return {
    decisions,
    suggestedOrderTrackIds: suggested.map(({ track }) => track.id),
    summary: {
      totalTracks: tracks.length,
      averageScore,
      chartMatches,
      streamMatches,
      accountMatches,
      orderChangesCount,
      priorityCount: decisions.filter(
        (decision) => decision.action === "priority",
      ).length,
      raiseCount: decisions.filter((decision) => decision.action === "raise")
        .length,
      reviewCount: decisions.filter(
        (decision) => decision.action === "test" || decision.action === "lower",
      ).length,
      confidenceLabel:
        signalCoverage >= 0.55
          ? "Alta"
          : signalCoverage >= 0.3
            ? "Media"
            : "Inicial",
    },
  };
}
