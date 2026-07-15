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

export type PlaylistSuggestionProfileTrack = {
  id: string;
  name: string;
  artists: string;
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
  currentPosition: number;
  movement7d: number | null;
  opportunityScore: number;
  playlistFitScore: number;
  saturationRisk: number;
  isNewEntry: boolean;
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
  };
  markets: Record<MusicIntelligenceCountry, PlaylistSuggestionMarketQueue>;
};

const MARKET_ORDER: MusicIntelligenceCountry[] = ["BR", "GLOBAL"];
const MAX_ITEMS_PER_MARKET = 4;

const ADJACENT_GENRES: Partial<Record<TrackGenre, TrackGenre[]>> = {
  trap: ["rap", "funk"],
  rap: ["trap"],
  funk: ["trap", "pagodao"],
  pagode: ["pagodao"],
  pagodao: ["pagode", "funk"],
  sertanejo: ["piseiro"],
  piseiro: ["sertanejo"],
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
  if (explicitGenre !== "unknown") {
    return explicitGenre;
  }

  const counts = new Map<TrackGenre, number>();
  for (const track of tracks) {
    const genre = detectGenre(track.artists, track.name);
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
    ...(intelligence.candidatePool?.[market] ?? []),
    marketQueue.nextBestOpportunity,
    ...marketQueue.addNow,
    ...marketQueue.watch,
    ...intelligence.signals.topRisers.filter(
      (track) => track.primaryCountry === market,
    ),
    ...intelligence.signals.newEntries.filter(
      (track) => track.primaryCountry === market,
    ),
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

function getCompatibility({
  candidate,
  playlistGenre,
  playlistArtists,
}: {
  candidate: MusicIntelligenceTrack;
  playlistGenre: TrackGenre;
  playlistArtists: Set<string>;
}) {
  const candidateArtists = artistNames(candidate.artists);
  const sharedArtist = candidateArtists.find((artist) =>
    playlistArtists.has(artist),
  );
  const candidateGenre = detectGenre(candidate.artists, candidate.name);

  if (sharedArtist) {
    return {
      score: 100,
      candidateGenre,
      sharedArtist,
      reason: "Artista já presente no repertório da playlist.",
    };
  }

  if (playlistGenre === "unknown") {
    return {
      score: 62,
      candidateGenre,
      sharedArtist: null,
      reason: "Compatibilidade inicial baseada na força dos sinais.",
    };
  }

  if (candidateGenre === playlistGenre) {
    return {
      score: 100,
      candidateGenre,
      sharedArtist: null,
      reason: `Compatível com o perfil ${GENRE_LABEL[playlistGenre]} da playlist.`,
    };
  }

  if (ADJACENT_GENRES[playlistGenre]?.includes(candidateGenre)) {
    return {
      score: 76,
      candidateGenre,
      sharedArtist: null,
      reason: `Gênero próximo ao perfil ${GENRE_LABEL[playlistGenre]} da playlist.`,
    };
  }

  return {
    score: candidateGenre === "unknown" ? 42 : 24,
    candidateGenre,
    sharedArtist: null,
    reason: "Compatibilidade de repertório ainda não confirmada.",
  };
}

function buildSuggestion(
  candidate: MusicIntelligenceTrack,
  market: MusicIntelligenceCountry,
  compatibility: ReturnType<typeof getCompatibility>,
): PlaylistDecisionSuggestion {
  const opportunityScore = candidate.scores.opportunityScore;
  const playlistFitScore = Math.round(
    clamp(opportunityScore * 0.68 + compatibility.score * 0.32),
  );
  const recommendation =
    candidate.action === "add_now" &&
    playlistFitScore >= 65 &&
    candidate.scores.saturationRisk < 55
      ? "add_now"
      : "watch";
  const marketLabel = market === "BR" ? "BR" : "Global";
  const signals = [`#${candidate.currentPosition} no ${marketLabel}`];

  if (candidate.isNewEntry) {
    signals.push("entrada recente");
  } else if ((candidate.movement7d ?? 0) > 0) {
    signals.push(`+${candidate.movement7d} posições em 7d`);
  } else if ((candidate.movement7d ?? 0) < 0) {
    signals.push(`${candidate.movement7d} posições em 7d`);
  }

  if (candidate.streams) {
    signals.push(`${compactNumber(candidate.streams)} streams/dia`);
  }

  return {
    id: candidate.spotifyTrackId as string,
    name: candidate.name,
    artists: candidate.artists,
    albumName: "",
    imageUrl: candidate.coverUrl,
    durationLabel: "",
    spotifyUrl:
      candidate.spotifyUrl ??
      `https://open.spotify.com/track/${candidate.spotifyTrackId}`,
    popularity: 0,
    market,
    currentPosition: candidate.currentPosition,
    movement7d: candidate.movement7d,
    opportunityScore,
    playlistFitScore,
    saturationRisk: candidate.scores.saturationRisk,
    isNewEntry: candidate.isNewEntry,
    recommendation,
    recommendationLabel:
      recommendation === "add_now" ? "Adicionar agora" : "Observar",
    explanation: `${compatibility.reason} ${candidate.explanation}`,
    signals: signals.slice(0, 3),
  };
}

export function buildPlaylistSuggestionIntelligence({
  playlist,
  intelligence,
}: {
  playlist: {
    name: string;
    description: string;
    tracks: PlaylistSuggestionProfileTrack[];
  };
  intelligence: MusicIntelligenceResponse;
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
  const markets = {} as Record<
    MusicIntelligenceCountry,
    PlaylistSuggestionMarketQueue
  >;
  let candidatesEvaluated = 0;
  let compatibleCandidates = 0;

  for (const market of MARKET_ORDER) {
    const candidates = collectMarketCandidates(intelligence, market).filter(
      (candidate) =>
        candidate.spotifyTrackId &&
        !existingTrackIds.has(candidate.spotifyTrackId),
    );
    candidatesEvaluated += candidates.length;

    const suggestions = candidates
      .map((candidate) => {
        const compatibility = getCompatibility({
          candidate,
          playlistGenre,
          playlistArtists,
        });
        return {
          compatibility,
          suggestion: buildSuggestion(candidate, market, compatibility),
        };
      })
      .filter(({ compatibility }) =>
        playlistGenre === "unknown"
          ? compatibility.score >= 60
          : compatibility.score >= 70,
      )
      .map(({ suggestion }) => suggestion)
      .sort(
        (left, right) =>
          (left.recommendation === "add_now" ? 0 : 1) -
            (right.recommendation === "add_now" ? 0 : 1) ||
          right.playlistFitScore - left.playlistFitScore ||
          right.opportunityScore - left.opportunityScore,
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
    },
    markets,
  };
}
