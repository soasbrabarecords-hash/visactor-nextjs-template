import type { MovementType } from "@/types/workspace";

export type OpportunityScoreInput = {
  popularity: number;
  rankChange: number | null;
  popularityChange: number | null;
  daysOnChart: number;
  saturationCount: number;
};

export type IntelligenceTagInput = OpportunityScoreInput & {
  movementType: MovementType;
  opportunityScore: number;
  multipleSources: boolean;
  multipleGenres: boolean;
  artistExpansion: boolean;
};

export function clampNumber(value: number, minValue: number, maxValue: number) {
  return Math.min(Math.max(value, minValue), maxValue);
}

export function calculateOpportunityScore({
  popularity,
  rankChange,
  popularityChange,
  daysOnChart,
  saturationCount,
}: OpportunityScoreInput) {
  const score =
    popularity * 0.3 +
    Math.max(rankChange ?? 0, 0) * 2.5 +
    Math.max(popularityChange ?? 0, 0) * 3 +
    daysOnChart * 1.5 +
    (1 / Math.max(saturationCount, 1)) * 20;

  return clampNumber(Math.round(score), 0, 100);
}

export function buildIntelligenceTags({
  movementType,
  popularity,
  rankChange,
  popularityChange,
  daysOnChart,
  saturationCount,
  opportunityScore,
  multipleSources,
  multipleGenres,
  artistExpansion,
}: IntelligenceTagInput) {
  const tags: string[] = [];

  if ((rankChange ?? 0) >= 10 || (popularityChange ?? 0) >= 8) {
    tags.push("Explodindo");
  }

  if (movementType === "new") {
    tags.push("Nova entrada");
  } else if (movementType === "reentry") {
    tags.push("Reentrada");
  } else if ((rankChange ?? 0) > 0) {
    tags.push("Subindo");
  } else if ((rankChange ?? 0) < 0) {
    tags.push("Caindo");
  }

  if (saturationCount <= 3) {
    tags.push("Baixa saturacao");
  }

  if (saturationCount >= 15) {
    tags.push("Saturada");
  }

  if (daysOnChart >= 3) {
    tags.push("Recorrente");
  }

  if (popularity >= 85) {
    tags.push("Hit forte");
  }

  if (opportunityScore >= 75 && saturationCount <= 5) {
    tags.push("Teste editorial");
  } else if (opportunityScore >= 50 && opportunityScore <= 74) {
    tags.push("Observar");
  }

  if ((rankChange ?? 0) < -10 || (popularityChange ?? 0) < -8) {
    tags.push("Evitar agora");
  }

  if (multipleSources || multipleGenres) {
    tags.push("Crossover");
  }

  if (artistExpansion) {
    tags.push("Expansao de mercado");
  }

  return tags;
}
