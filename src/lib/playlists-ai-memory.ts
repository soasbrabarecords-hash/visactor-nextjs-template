import "server-only";
import { GENRE_LABEL, detectPlaylistGenre } from "@/lib/genre-detection";
import type {
  PlaylistsAiConversationMessage,
  PlaylistsAiCurationBrief,
  PlaylistsAiCurationBriefField,
  PlaylistsAiCurationGoal,
  PlaylistsAiCurationMarket,
  PlaylistsAiCurationStrategy,
  PlaylistsAiIntent,
  PlaylistsAiPlaylistMode,
} from "@/types/playlists-ai";

const GOALS = new Set<PlaylistsAiCurationGoal>([
  "growth",
  "editorial",
  "discovery",
  "hits",
  "retention",
  "balanced",
]);
const MARKETS = new Set<PlaylistsAiCurationMarket>(["BR", "GLOBAL", "BOTH"]);
const PLAYLIST_MODES = new Set<PlaylistsAiPlaylistMode>(["existing", "new"]);
const STRATEGIES = new Set<PlaylistsAiCurationStrategy>([
  "retention",
  "discovery",
  "renewal",
  "hits",
  "balanced",
]);

const STRATEGIC_LANGUAGE =
  /\b(melhorar|melhora|otimizar|repensar|reformular|estrategia|planejar|construir|montar|criar|atualizar|renovar|trabalhar)\b/;
const DIRECT_LANGUAGE =
  /\b(quais|mostra|liste|buscar|procura|ja esta|esta em alguma|charts?|bombando|subindo|caindo|maiores subidas|top\s*\d+)\b/;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanString(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, maxLength) : null;
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>) {
  return typeof value === "string" && allowed.has(value as T)
    ? (value as T)
    : null;
}

export function createEmptyCurationBrief(): PlaylistsAiCurationBrief {
  return {
    goal: null,
    market: null,
    playlistMode: null,
    playlistName: null,
    genre: null,
    audience: null,
    strategy: null,
    targetSize: null,
    activeIntent: null,
    completeness: 0,
    missingFields: [],
  };
}

export function normalizeCurationBrief(
  value: unknown,
): PlaylistsAiCurationBrief {
  if (!value || typeof value !== "object") return createEmptyCurationBrief();
  const record = value as Record<string, unknown>;
  const targetSize =
    typeof record.targetSize === "number" &&
    Number.isInteger(record.targetSize) &&
    record.targetSize >= 10 &&
    record.targetSize <= 500
      ? record.targetSize
      : null;
  const activeIntent =
    typeof record.activeIntent === "string" ? record.activeIntent : null;
  const intents = new Set<PlaylistsAiIntent>([
    "chart_opportunities",
    "playlist_recommendations",
    "track_presence",
    "playlist_review",
    "playlist_idea",
    "playlist_description",
    "general",
  ]);

  return {
    goal: enumValue(record.goal, GOALS),
    market: enumValue(record.market, MARKETS),
    playlistMode: enumValue(record.playlistMode, PLAYLIST_MODES),
    playlistName: cleanString(record.playlistName),
    genre: cleanString(record.genre, 80),
    audience: cleanString(record.audience, 120),
    strategy: enumValue(record.strategy, STRATEGIES),
    targetSize,
    activeIntent:
      activeIntent && intents.has(activeIntent as PlaylistsAiIntent)
        ? (activeIntent as PlaylistsAiIntent)
        : null,
    completeness: 0,
    missingFields: [],
  };
}

function inferMarket(text: string): PlaylistsAiCurationMarket | null {
  const normalized = normalize(text);
  if (
    /\b(br e global|br global|brasil e global|ambos|dois mercados)\b/.test(
      normalized,
    )
  ) {
    return "BOTH";
  }
  if (/\b(global|internacional|mundo)\b/.test(normalized)) return "GLOBAL";
  if (/\b(br|brasil|brasileir[ao]|nacional)\b/.test(normalized)) return "BR";
  return null;
}

function inferGoal(text: string): PlaylistsAiCurationGoal | null {
  const normalized = normalize(text);
  if (
    /\b(retencao|reter|tempo de escuta|ouvir por mais tempo)\b/.test(normalized)
  )
    return "retention";
  if (/\b(crescimento|crescer|alcance|seguidores|audiencia)\b/.test(normalized))
    return "growth";
  if (/\b(descoberta|descobrir|novidades|novos artistas)\b/.test(normalized))
    return "discovery";
  if (/\b(editorial|curadoria editorial|identidade)\b/.test(normalized))
    return "editorial";
  if (/\b(hits|hit|comercial|sucessos|bombando)\b/.test(normalized))
    return "hits";
  if (/\b(equilibrio|equilibrada|balanceada|balanceado)\b/.test(normalized))
    return "balanced";
  return null;
}

function inferStrategy(text: string): PlaylistsAiCurationStrategy | null {
  const normalized = normalize(text);
  if (/\b(retencao|reter|tempo de escuta)\b/.test(normalized))
    return "retention";
  if (/\b(descoberta|descobrir|novidades|novos artistas)\b/.test(normalized))
    return "discovery";
  if (/\b(renovar|renovacao|atualizar|refresh|rotacao)\b/.test(normalized))
    return "renewal";
  if (/\b(hits|hit|comercial|sucessos)\b/.test(normalized)) return "hits";
  if (/\b(equilibrio|equilibrada|balanceada|balanceado)\b/.test(normalized))
    return "balanced";
  return null;
}

function inferPlaylistMode(text: string): PlaylistsAiPlaylistMode | null {
  const normalized = normalize(text);
  if (
    /\b(nova playlist|criar playlist|cria uma playlist|montar playlist)\b/.test(
      normalized,
    )
  )
    return "new";
  if (
    /\b(minha playlist|playlist existente|atualizar|melhorar|revisar)\b/.test(
      normalized,
    )
  )
    return "existing";
  return null;
}

function inferAudience(text: string) {
  const explicit = text.match(
    /p[uú]blico(?:\s+(?:de|para))?\s+([^,.?]{3,80})/iu,
  )?.[1];
  if (explicit) return cleanString(explicit, 80);
  const normalized = normalize(text);
  if (/\b(gen z|adolescentes?|publico jovem|jovens)\b/.test(normalized))
    return "Público jovem / Gen Z";
  if (/\b(familia|familiar|todas as idades)\b/.test(normalized))
    return "Público amplo / familiar";
  return null;
}

function inferTargetSize(text: string) {
  const number = [...text.matchAll(/\b(\d{2,3})\b/g)]
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .find((value) => value >= 10 && value <= 500);
  return number ?? null;
}

function inferGenre(text: string) {
  const genre = detectPlaylistGenre(text, "");
  return genre === "unknown" ? null : GENRE_LABEL[genre];
}

function requiredFields(
  intent: PlaylistsAiIntent | null,
  playlistMode: PlaylistsAiPlaylistMode | null,
): PlaylistsAiCurationBriefField[] {
  if (intent === "playlist_recommendations" || intent === "playlist_review") {
    return ["playlistName", "goal", "market"];
  }
  if (intent === "playlist_description") return ["playlistName", "goal"];
  if (intent === "playlist_idea" || playlistMode === "new") {
    return ["genre", "goal", "market"];
  }
  if (intent === "chart_opportunities") return ["market"];
  return ["goal", "market"];
}

function finalizeBrief(brief: PlaylistsAiCurationBrief) {
  const fields = requiredFields(brief.activeIntent, brief.playlistMode);
  const missingFields = fields.filter((field) => !brief[field]);
  const tracked = [
    brief.goal,
    brief.market,
    brief.playlistMode,
    brief.playlistName,
    brief.genre,
    brief.audience,
    brief.strategy,
  ];
  const completeness = Math.round(
    (tracked.filter(Boolean).length / tracked.length) * 100,
  );
  return { ...brief, completeness, missingFields };
}

export function inferCurationBrief({
  message,
  messages,
  value,
  intent,
  playlistReference,
}: {
  message: string;
  messages: PlaylistsAiConversationMessage[];
  value: unknown;
  intent: PlaylistsAiIntent;
  playlistReference: string | null;
}) {
  const current = normalizeCurationBrief(value);
  const historyContext = messages
    .filter((item) => item.role === "user")
    .slice(-6)
    .map((item) => item.content)
    .join("\n");
  const activeIntent =
    intent === "general" && current.activeIntent
      ? current.activeIntent
      : intent;
  const inferredMode =
    inferPlaylistMode(message) ?? inferPlaylistMode(historyContext);
  const genre = inferGenre(message) ?? inferGenre(historyContext);

  return finalizeBrief({
    ...current,
    goal: inferGoal(message) ?? inferGoal(historyContext) ?? current.goal,
    market:
      inferMarket(message) ?? inferMarket(historyContext) ?? current.market,
    playlistMode:
      inferredMode ??
      current.playlistMode ??
      (playlistReference ? "existing" : null),
    playlistName: playlistReference ?? current.playlistName,
    genre: genre ?? current.genre,
    audience:
      inferAudience(message) ??
      inferAudience(historyContext) ??
      current.audience,
    strategy:
      inferStrategy(message) ??
      inferStrategy(historyContext) ??
      current.strategy,
    targetSize:
      inferTargetSize(message) ??
      inferTargetSize(historyContext) ??
      current.targetSize,
    activeIntent,
  });
}

export function isDirectCurationRequest(message: string) {
  const normalized = normalize(message);
  return (
    DIRECT_LANGUAGE.test(normalized) ||
    /\b(sugere|recomenda)\s+\d{1,3}\b/.test(normalized) ||
    /\bbasead[ao] nas maiores subidas\b/.test(normalized)
  );
}

export function shouldAskForCurationContext({
  message,
  intent,
  brief,
}: {
  message: string;
  intent: PlaylistsAiIntent;
  brief: PlaylistsAiCurationBrief;
}) {
  const normalized = normalize(message);
  if (intent === "track_presence") return false;
  if (isDirectCurationRequest(message)) return false;
  if (intent === "general") return true;
  if (intent === "chart_opportunities" && !brief.market) return true;
  if (
    (STRATEGIC_LANGUAGE.test(normalized) ||
      intent === "playlist_idea" ||
      intent === "playlist_recommendations") &&
    brief.missingFields.length > 0
  ) {
    return true;
  }
  return false;
}

export function buildCurationQuestion({
  brief,
  playlistNames,
}: {
  brief: PlaylistsAiCurationBrief;
  playlistNames: string[];
}) {
  const missing = new Set(brief.missingFields);
  if (missing.has("playlistName") && brief.playlistMode !== "new") {
    const examples = playlistNames.slice(0, 4);
    return examples.length
      ? `Antes de analisar, qual playlist você quer trabalhar? Encontrei ${examples.join(", ")}.`
      : "Antes de analisar, qual é o nome da playlist que você quer trabalhar?";
  }
  if (missing.has("genre") && brief.playlistMode === "new") {
    return "Qual deve ser o gênero ou a identidade principal dessa nova playlist? Pode ser algo específico, como funk atual, trap melódico ou pop global.";
  }
  if (missing.has("goal") && missing.has("market")) {
    return "Antes de sugerir faixas, quero alinhar duas decisões: o objetivo é crescimento, descoberta, editorial, hits ou retenção? E você quer priorizar Brasil, Global ou os dois mercados?";
  }
  if (missing.has("goal")) {
    return "Qual é a prioridade desta curadoria: crescimento, descoberta, identidade editorial, hits ou retenção? Isso muda bastante a seleção.";
  }
  if (missing.has("market")) {
    return "Você quer que eu priorize sinais do Brasil, do Global ou o cruzamento dos dois mercados?";
  }
  if (missing.has("strategy")) {
    return "Você prefere uma estratégia de retenção, descoberta, renovação ou equilíbrio entre faixas seguras e apostas?";
  }
  return "Antes de consultar músicas, me diga o resultado que você quer alcançar com essa curadoria. Posso pensar em crescimento, descoberta, retenção, identidade editorial ou hits.";
}
