import type { DecisionTrack, RadarMusicRow, StatusTone } from "@/types/workspace";

export type RadarTrendSignal = {
  key: "exploding" | "early" | "confirming" | "watch" | "risk";
  label: string;
  helper: string;
  tone: StatusTone;
  weight: number;
};

export function getRadarTrendSignal(
  row: RadarMusicRow,
  decisionTrack?: DecisionTrack | null,
): RadarTrendSignal {
  const rankChange = row.rankChange ?? 0;
  const isNew = row.previousRank === null || row.rankChange === null;
  const strongStreams = row.streamRank !== null && row.streamRank <= 40;
  const strongScore = decisionTrack
    ? decisionTrack.decisionScore >= 78
    : row.opportunityScore >= 78;
  const inBase = decisionTrack?.alreadyInPlaylists ?? row.alreadyInPlaylists;

  if (row.tiktokViral && (rankChange >= 3 || strongStreams || isNew) && strongScore) {
    return {
      key: "exploding",
      label: "Explodindo agora",
      helper:
        row.tiktokRank !== null
          ? `TikTok #${row.tiktokRank} com Spotify confirmando`
          : "TikTok e Spotify puxando juntos",
      tone: "green",
      weight: 100,
    };
  }

  if (row.tiktokViral && !inBase) {
    return {
      key: "early",
      label: "Sinal precoce",
      helper:
        row.tiktokRank !== null
          ? `TikTok #${row.tiktokRank} antes da tua base`
          : "TikTok puxando antes do Spotify confirmar",
      tone: "blue",
      weight: 82,
    };
  }

  if (!row.tiktokViral && (rankChange >= 4 || (strongStreams && strongScore))) {
    return {
      key: "confirming",
      label: "Spotify confirmando",
      helper: "Streams e chart sustentando a subida",
      tone: "yellow",
      weight: 74,
    };
  }

  if ((rankChange <= -3 || row.movement.type === "down") && inBase) {
    return {
      key: "risk",
      label: "Risco de pico curto",
      helper: "Perde força e já pede revisão na base",
      tone: "red",
      weight: 38,
    };
  }

  return {
    key: "watch",
    label: "Observar 24h",
    helper: decisionTrack?.fitLabel === "Fit alto"
      ? "Boa aderência, mas ainda sem confirmação total"
      : "Ainda cedo para chamar tendência",
    tone: "slate",
    weight: 58,
  };
}
