import "server-only";
import { GENRE_LABEL, detectPlaylistGenre } from "@/lib/genre-detection";
import {
  buildCurationQuestion,
  createEmptyCurationBrief,
  inferCurationBrief,
  isDirectCurationRequest,
  shouldAskForCurationContext,
} from "@/lib/playlists-ai-memory";
import {
  type ChartOpportunitiesToolResult,
  type ChartTrackSignalToolResult,
  type PlaylistRecommendationToolResult,
  type PlaylistTracksToolResult,
  type TrackPresenceToolResult,
  type WorkspacePlaylistsToolResult,
  type WorkspaceTrackIndex,
  getChartOpportunities,
  getChartTrackSignal,
  getPlaylistTracks,
  getWorkspacePlaylists,
  getWorkspaceTrackIndex,
  normalizePlaylistAiText,
  recommendTracksForPlaylist,
  searchSpotifyTrack,
  searchTrackInPlaylists,
} from "@/lib/playlists-ai-tools";
import { getEffectiveAiGatewayCredentials } from "@/lib/workspaces";
import type {
  PlaylistsAiChatResponse,
  PlaylistsAiConversationMessage,
  PlaylistsAiCurationBrief,
  PlaylistsAiCurationMarket,
  PlaylistsAiDataSource,
  PlaylistsAiIntent,
  PlaylistsAiPreparedAction,
  PlaylistsAiResponseMode,
  PlaylistsAiTrackCard,
} from "@/types/playlists-ai";
import {
  TRACK_PROFILE_GENRE_LABELS,
  type TrackProfileGenre,
} from "@/types/track-profile";

export type DetectedPlaylistsAiIntent = {
  name: PlaylistsAiIntent;
  market: PlaylistsAiCurationMarket;
  limit: number;
  targetSize: number;
  playlistReference: string | null;
  trackQuery: string | null;
  excludeWorkspaceTracks: boolean;
  mode: "opportunity" | "heat" | "riser" | "review" | "historical";
  windowDays: number | null;
  genre: TrackProfileGenre | null;
  genres: TrackProfileGenre[];
};

export type PlaylistsAiAgentTools = {
  getWorkspacePlaylists: () => Promise<WorkspacePlaylistsToolResult>;
  getPlaylistTracks: (
    reference: string,
    playlists?: WorkspacePlaylistsToolResult["playlists"],
  ) => Promise<PlaylistTracksToolResult>;
  getChartOpportunities: typeof getChartOpportunities;
  getChartTrackSignal: (trackId: string) => Promise<ChartTrackSignalToolResult>;
  getWorkspaceTrackIndex: (
    playlists?: WorkspacePlaylistsToolResult["playlists"],
  ) => Promise<WorkspaceTrackIndex>;
  searchTrackInPlaylists: (query: string) => Promise<TrackPresenceToolResult>;
  searchSpotifyTrack: typeof searchSpotifyTrack;
  recommendTracksForPlaylist: (
    reference: string,
    options?: { limit?: number },
  ) => Promise<PlaylistRecommendationToolResult>;
};

const DEFAULT_TOOLS: PlaylistsAiAgentTools = {
  getWorkspacePlaylists,
  getPlaylistTracks,
  getChartOpportunities,
  getChartTrackSignal,
  getWorkspaceTrackIndex,
  searchTrackInPlaylists,
  searchSpotifyTrack,
  recommendTracksForPlaylist,
};

type PlaylistAiPlannerDecision = {
  intent: PlaylistsAiIntent;
  market: PlaylistsAiCurationMarket;
  genres: TrackProfileGenre[];
  mode: DetectedPlaylistsAiIntent["mode"];
  windowDays: number | null;
  limit: number;
  targetSize: number;
  playlistReference: string | null;
  trackQuery: string | null;
  excludeWorkspaceTracks: boolean;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  clarificationReason: string | null;
  confidence: number;
};

const PLANNER_GENRES: TrackProfileGenre[] = [
  "funk",
  "trap",
  "rap",
  "sertanejo",
  "piseiro_forro",
  "pop",
  "pop_global",
  "rock",
  "dance_eletronico",
  "afro_latin",
  "desconhecido",
];

function inferLimit(prompt: string) {
  const normalized = normalizePlaylistAiText(prompt);
  const raw =
    normalized.match(
      /(?:top|lista de|selecao de|sugere|sugerir|mostra|traz|entrega)\s+(\d{1,2})\b/,
    )?.[1] ??
    normalized.match(/\b(\d{1,2})\s+(?:musicas|faixas|oportunidades)\b/)?.[1];
  const requested = raw ? Number.parseInt(raw, 10) : null;
  return Math.min(requested ?? 10, 50);
}

function inferTargetSize(prompt: string) {
  const normalized = normalizePlaylistAiText(prompt);
  const raw = normalized.match(
    /\b(?:com|de|ate)\s+(\d{2,3})\s+(?:musicas|faixas)\b/,
  )?.[1];
  const requested = raw ? Number.parseInt(raw, 10) : null;
  return requested ?? 50;
}

function inferWindowDays(prompt: string) {
  const normalized = normalizePlaylistAiText(prompt);
  const explicitDays = normalized.match(
    /(?:ultimos?\s+)?(\d{1,3})\s*(?:d|dia|dias)\b/,
  )?.[1];
  if (explicitDays) {
    return clampWindow(Number.parseInt(explicitDays, 10));
  }

  const explicitMonths = normalized.match(
    /(?:ultimos?\s+)?(\d{1,2})\s*(?:mes|meses)\b/,
  )?.[1];
  if (explicitMonths) {
    return clampWindow(Number.parseInt(explicitMonths, 10) * 30);
  }

  if (/ultima semana|ultimos sete dias|semana/.test(normalized)) return 7;
  if (/ultimo mes|ultimos trinta dias/.test(normalized)) return 30;
  if (/ultimo ano|ultimos doze meses/.test(normalized)) return 365;
  return null;
}

function clampWindow(value: number) {
  return Math.max(1, Math.min(365, value));
}

function profileGenresFromPrompt(prompt: string): TrackProfileGenre[] {
  const normalized = ` ${normalizePlaylistAiText(prompt)} `;
  const rules: Array<[TrackProfileGenre, string[]]> = [
    ["trap", ["trap", "drill", "plugg"]],
    ["rap", ["rap", "hip hop", "hiphop", "boom bap"]],
    ["funk", ["funk", "baile funk", "mandelao"]],
    ["sertanejo", ["sertanejo", "agronejo", "modao"]],
    ["piseiro_forro", ["piseiro", "forro", "pisadinha"]],
    ["pop_global", ["pop global", "k pop", "kpop"]],
    [
      "dance_eletronico",
      ["eletronico", "eletronica", "dance", "edm", "house", "techno"],
    ],
    ["afro_latin", ["afrobeats", "afrobeat", "amapiano", "latin", "reggaeton"]],
    ["rock", ["rock", "metal", "grunge", "emo"]],
    ["pop", ["pop"]],
  ];
  const matches = rules.flatMap(([genre, terms]) =>
    terms.some((term) => normalized.includes(` ${term} `)) ? [genre] : [],
  );
  if (matches.length > 0) return [...new Set(matches)];

  const genre = detectPlaylistGenre(prompt, "");
  if (genre === "unknown") return [];
  if (genre === "piseiro") return ["piseiro_forro"];
  if (genre === "pagode" || genre === "pagodao" || genre === "reggae") {
    return [];
  }
  return [genre];
}

function findPlaylistReference(prompt: string, playlistNames: string[]) {
  const normalizedPrompt = normalizePlaylistAiText(prompt);
  const matchedName = [...playlistNames]
    .sort((left, right) => right.length - left.length)
    .find((name) => normalizedPrompt.includes(normalizePlaylistAiText(name)));
  if (matchedName) return matchedName;

  const quoted = prompt.match(/["“”']([^"“”']{3,80})["“”']/)?.[1]?.trim();
  if (quoted) return quoted;

  const afterPlaylist = prompt.match(
    /(?:playlist|para)\s+([\p{L}\p{N}][\p{L}\p{N}\s&+._-]{2,60}?)(?:\s+(?:hoje|agora|com|basead|usando|porque|que)|[?.!,]|$)/iu,
  )?.[1];
  return afterPlaylist?.trim() || null;
}

function extractTrackQuery(prompt: string) {
  const spotifyReference = prompt.match(
    /(?:https?:\/\/open\.spotify\.com\/track\/|spotify:track:)[A-Za-z0-9]{22}/,
  )?.[0];
  if (spotifyReference) return spotifyReference;

  const quoted = prompt.match(/["“”']([^"“”']{2,120})["“”']/)?.[1]?.trim();
  if (quoted) return quoted;

  const namedTrack = prompt.match(
    /(?:m[uú]sica|faixa)\s+(.+?)(?:\s+(?:j[aá]|est[aá]|aparece|entrou|tem)\b|[?]|$)/iu,
  )?.[1];
  const cleaned = namedTrack?.replace(/^(essa|esta|a)\s+/i, "").trim();
  const normalizedCleaned = normalizePlaylistAiText(cleaned ?? "");
  if (
    cleaned &&
    !/^(musica|música|faixa|essa|esta|a|ja|já)$/i.test(cleaned) &&
    !(
      /^(ja|esta|essa)\b/.test(normalizedCleaned) &&
      /playlist/.test(normalizedCleaned)
    )
  ) {
    return cleaned;
  }

  return null;
}

export function classifyPlaylistAiIntent(
  prompt: string,
  playlistNames: string[] = [],
): DetectedPlaylistsAiIntent {
  const normalized = normalizePlaylistAiText(prompt);
  const playlistReference = findPlaylistReference(prompt, playlistNames);
  const market: PlaylistsAiCurationMarket =
    /(?:brasil|\bbr\b)\s*(?:e|\+|\/|mais)\s*global|global\s*(?:e|\+|\/|mais)\s*(?:brasil|\bbr\b)/.test(
      normalized,
    )
      ? "BOTH"
      : /\bglobais?\b/.test(normalized)
        ? "GLOBAL"
        : "BR";
  const windowDays = inferWindowDays(prompt);
  const genres = profileGenresFromPrompt(prompt);
  const historical =
    windowDays !== null ||
    /historico|historica|mais tocaram|mais tocadas|mais ouvidas|acumulad/.test(
      normalized,
    );
  const rising = /maiores? subidas|subindo|crescendo|acelerando/.test(
    normalized,
  );
  const base = {
    market,
    limit: inferLimit(prompt),
    targetSize: inferTargetSize(prompt),
    playlistReference,
    trackQuery: extractTrackQuery(prompt),
    excludeWorkspaceTracks:
      /ainda nao|nao estao|fora das|minhas playlists|nenhuma playlist/.test(
        normalized,
      ),
    mode: rising
      ? ("riser" as const)
      : historical
        ? ("historical" as const)
        : /quentes|bombando|mais fortes|forca atual/.test(normalized)
          ? ("heat" as const)
          : ("opportunity" as const),
    windowDays,
    genre: genres[0] ?? null,
    genres,
  };

  if (
    /ja esta|esta em alguma|em qual playlist|buscar.*playlist|encontrar.*playlist/.test(
      normalized,
    ) &&
    /musica|faixa|spotify/.test(normalized)
  ) {
    return { ...base, name: "track_presence" };
  }

  if (
    /descri[cç][aã]o|bio da playlist|texto da playlist/.test(
      prompt.toLowerCase(),
    )
  ) {
    return { ...base, name: "playlist_description" };
  }

  if (
    /ideia de playlist|cria(?:r)? (?:uma )?playlist|monta(?:r)? (?:uma )?playlist|playlist baseada/.test(
      normalized,
    )
  ) {
    return { ...base, name: "playlist_idea" };
  }

  if (
    /caiu|cairam|caindo|quedas|remover|retirar|revisar|evitar|passaram do pico|perderam tracao/.test(
      normalized,
    )
  ) {
    return { ...base, name: "playlist_review", mode: "review" };
  }

  if (
    /adicionar|sugere|sugerir|recomenda|oportunidades? para/.test(normalized) &&
    (playlistReference || /playlist/.test(normalized))
  ) {
    return { ...base, name: "playlist_recommendations" };
  }

  if (
    (playlistReference || /playlist/.test(normalized)) &&
    /melhorar|otimizar|atualizar|renovar|repensar|reformular/.test(normalized)
  ) {
    return { ...base, name: "playlist_recommendations" };
  }

  if (
    /chart|quentes|bombando|subindo|oportunidades|entradas|crossover|br hoje|global/.test(
      normalized,
    )
  ) {
    return { ...base, name: "chart_opportunities" };
  }

  if (
    genres.length > 0 &&
    /musicas|faixas|lista|selecao|mostra|traz|entrega|quero|procura/.test(
      normalized,
    )
  ) {
    return { ...base, name: "chart_opportunities" };
  }

  return { ...base, name: "general" };
}

function hasExplicitMarket(prompt: string) {
  const normalized = normalizePlaylistAiText(prompt);
  return /\b(br|brasil|global|globais|internacional|mundo)\b/.test(normalized);
}

function mergePlannerDecision(
  prompt: string,
  fallback: DetectedPlaylistsAiIntent,
  planner: PlaylistAiPlannerDecision | null,
): DetectedPlaylistsAiIntent {
  if (!planner) return fallback;
  const explicitGenres = profileGenresFromPrompt(prompt);
  const genres = explicitGenres.length
    ? explicitGenres
    : planner.genres.filter((genre) => genre !== "desconhecido");
  const explicitWindow = inferWindowDays(prompt);
  const name = fallback.name === "general" ? planner.intent : fallback.name;

  return {
    ...fallback,
    name,
    market: hasExplicitMarket(prompt) ? fallback.market : planner.market,
    genres,
    genre: genres[0] ?? null,
    mode:
      explicitWindow !== null || fallback.mode === "historical"
        ? "historical"
        : planner.mode,
    windowDays: explicitWindow ?? planner.windowDays,
    limit: Math.max(1, Math.min(planner.limit || fallback.limit, 50)),
    targetSize: Math.max(
      10,
      Math.min(planner.targetSize || fallback.targetSize, 500),
    ),
    playlistReference: fallback.playlistReference ?? planner.playlistReference,
    trackQuery: fallback.trackQuery ?? planner.trackQuery,
    excludeWorkspaceTracks:
      fallback.excludeWorkspaceTracks || planner.excludeWorkspaceTracks,
  };
}

async function planPlaylistAiRequest({
  prompt,
  conversation,
  brief,
  playlistNames,
  fallback,
}: {
  prompt: string;
  conversation: PlaylistsAiConversationMessage[];
  brief: unknown;
  playlistNames: string[];
  fallback: DetectedPlaylistsAiIntent;
}): Promise<PlaylistAiPlannerDecision | null> {
  try {
    const credentials = await getEffectiveAiGatewayCredentials();
    if (!credentials) return null;
    const response = await requestAiGatewayAgent(credentials.authToken, {
      model: credentials.model,
      instructions:
        "Você planeja consultas read-only para um copiloto profissional de curadoria musical. Interprete a intenção real usando a conversa inteira, sem imitar um formulário. Um pedido concreto de músicas, charts, histórico, gênero ou playlist deve virar consulta imediatamente: não pergunte objetivo, público ou estratégia quando esses dados não mudam a resposta pedida. Faça uma pergunta somente quando faltar uma identidade indispensável, como o nome da playlist ou da faixa. Preserve todos os gêneros citados, inclusive combinações como trap + rap. Para pedidos em português sem mercado explícito, use BR. Para 'mais tocaram' ou qualquer período, use historical. Nunca invente uma playlist que não esteja na lista disponível. A pergunta de esclarecimento deve mencionar o contexto já conhecido e soar como um curador humano, nunca repetir opções genéricas. Retorne somente o JSON do schema.",
      input: JSON.stringify({
        userMessage: prompt,
        conversation: conversation.slice(-8),
        savedBrief: brief,
        workspacePlaylistNames: playlistNames,
        deterministicFallback: fallback,
      }),
      text: {
        format: {
          type: "json_schema",
          name: "playlist_os_curation_plan",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intent: {
                type: "string",
                enum: [
                  "chart_opportunities",
                  "playlist_recommendations",
                  "track_presence",
                  "playlist_review",
                  "playlist_idea",
                  "playlist_description",
                  "general",
                ],
              },
              market: { type: "string", enum: ["BR", "GLOBAL", "BOTH"] },
              genres: {
                type: "array",
                items: { type: "string", enum: PLANNER_GENRES },
                maxItems: 4,
              },
              mode: {
                type: "string",
                enum: ["opportunity", "heat", "riser", "review", "historical"],
              },
              windowDays: {
                anyOf: [
                  { type: "integer", minimum: 1, maximum: 365 },
                  { type: "null" },
                ],
              },
              limit: { type: "integer", minimum: 1, maximum: 50 },
              targetSize: { type: "integer", minimum: 10, maximum: 500 },
              playlistReference: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              trackQuery: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              excludeWorkspaceTracks: { type: "boolean" },
              needsClarification: { type: "boolean" },
              clarificationQuestion: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              clarificationReason: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              confidence: { type: "integer", minimum: 0, maximum: 100 },
            },
            required: [
              "intent",
              "market",
              "genres",
              "mode",
              "windowDays",
              "limit",
              "targetSize",
              "playlistReference",
              "trackQuery",
              "excludeWorkspaceTracks",
              "needsClarification",
              "clarificationQuestion",
              "clarificationReason",
              "confidence",
            ],
          },
        },
      },
      max_output_tokens: 650,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const parsed = JSON.parse(
      extractOpenAIText(payload),
    ) as PlaylistAiPlannerDecision;
    if (!parsed || !Array.isArray(parsed.genres)) return null;
    return {
      ...parsed,
      genres: parsed.genres.filter((genre) => PLANNER_GENRES.includes(genre)),
      windowDays:
        typeof parsed.windowDays === "number"
          ? clampWindow(parsed.windowDays)
          : null,
      limit: Math.max(1, Math.min(parsed.limit || 10, 50)),
      targetSize: Math.max(10, Math.min(parsed.targetSize || 50, 500)),
      clarificationQuestion:
        typeof parsed.clarificationQuestion === "string"
          ? parsed.clarificationQuestion.trim().slice(0, 500) || null
          : null,
      clarificationReason:
        typeof parsed.clarificationReason === "string"
          ? parsed.clarificationReason.trim().slice(0, 240) || null
          : null,
    };
  } catch {
    return null;
  }
}

function source(
  id: PlaylistsAiDataSource["id"],
  label: string,
  detail: string,
  status: PlaylistsAiDataSource["status"] = "used",
): PlaylistsAiDataSource {
  return { id, label, detail, status };
}

function action(
  type: PlaylistsAiPreparedAction["type"],
  label: string,
  description: string,
  payload: Record<string, unknown> = {},
): PlaylistsAiPreparedAction {
  return {
    id: `prepared-${type}`,
    type,
    label,
    description,
    disabled: true,
    payload,
  };
}

function response(
  intent: PlaylistsAiIntent,
  input: Omit<PlaylistsAiChatResponse, "meta" | "brief">,
  {
    brief = createEmptyCurationBrief(),
    mode = input.cards.length > 0 ? "recommendation" : "analysis",
    contextComplete = false,
  }: {
    brief?: PlaylistsAiCurationBrief;
    mode?: PlaylistsAiResponseMode;
    contextComplete?: boolean;
  } = {},
): PlaylistsAiChatResponse {
  return {
    ...input,
    brief,
    meta: {
      intent,
      mode,
      contextComplete,
      readOnly: true,
      generatedAt: new Date().toISOString(),
    },
  };
}

function marketLabel(market: PlaylistsAiCurationMarket) {
  if (market === "BOTH") return "Brasil + Global";
  return market === "BR" ? "Brasil" : "Global";
}

function buildWorkspaceSource(workspace: WorkspacePlaylistsToolResult) {
  return source(
    "workspace_playlists",
    "Playlists do workspace",
    workspace.connected
      ? `${workspace.playlists.length} playlists próprias encontradas na conta conectada.`
      : (workspace.message ?? "Spotify do workspace indisponível."),
    workspace.connected ? "used" : "unavailable",
  );
}

function buildChartSources(result: ChartOpportunitiesToolResult) {
  const classified = result.cards.filter(
    (card) =>
      card.genreProfile && card.genreProfile.primaryGenre !== "desconhecido",
  ).length;
  return [
    source(
      "spotify_charts",
      "Spotify Charts",
      result.latestChartDate
        ? result.historical && result.windowDays
          ? `Todos os Top 200 completos entre ${result.windowStartDate ?? "o início da janela"} e ${result.latestChartDate} (${result.windowDays} dias solicitados).`
          : `Top 200 completo até ${result.latestChartDate}.`
        : "Nenhum snapshot completo disponível.",
      result.latestChartDate ? "used" : "unavailable",
    ),
    source(
      "music_intelligence",
      "Music Intelligence",
      result.historical && result.windowDays
        ? `Ranking histórico por streams acumulados, presença e posição em ${result.windowDays} dias.`
        : `Scores explicáveis com janela validada de até ${result.maxWindow} dias.`,
      result.maxWindow > 0 ? "used" : "partial",
    ),
    source(
      "genre_intelligence",
      "Genre Intelligence",
      classified > 0
        ? `${classified}/${result.cards.length} cards com gênero classificado e evidência rastreável.`
        : "Perfis ainda sem evidência suficiente; gênero mantido em análise.",
      classified === result.cards.length && classified > 0 ? "used" : "partial",
    ),
  ];
}

function cardForPresence(
  result: TrackPresenceToolResult,
  chart: ChartTrackSignalToolResult,
): PlaylistsAiTrackCard[] {
  if (!result.track) return [];
  const signal = chart.track;
  const present = result.playlistNames.length > 0;

  return [
    {
      id: result.track.id,
      spotifyTrackId: result.track.id,
      spotifyUrl: result.track.spotifyUrl,
      coverUrl: result.track.imageUrl,
      name: result.track.name,
      artists: result.track.artists,
      opportunityScore: signal?.scores.opportunityScore ?? null,
      positions: signal?.positions ?? {},
      movement7d: signal?.movement7d ?? null,
      reason: present
        ? `Encontrada em ${result.playlistNames.join(", ")}.`
        : result.complete
          ? "Não foi encontrada em nenhuma playlist própria deste workspace."
          : "Não apareceu nas playlists verificadas; a leitura do workspace foi parcial.",
      status: present ? "already_in_playlist" : "not_in_playlist",
      statusLabel: present
        ? "Já está na playlist"
        : "Não está nas playlists verificadas",
      suggestedAction: present
        ? "Manter ou revisar posição"
        : "Avaliar oportunidade",
      playlistNames: result.playlistNames,
      genreProfile: result.genreProfile ?? signal?.genreProfile ?? null,
      playlistFit: null,
    },
  ];
}

async function answerChartOpportunities({
  intent,
  workspace,
  tools,
  extraExcludeTrackIds = [],
}: {
  intent: DetectedPlaylistsAiIntent;
  workspace: WorkspacePlaylistsToolResult;
  tools: PlaylistsAiAgentTools;
  extraExcludeTrackIds?: string[];
}) {
  let index: WorkspaceTrackIndex | null = null;
  if (intent.excludeWorkspaceTracks && workspace.connected) {
    index = await tools.getWorkspaceTrackIndex(workspace.playlists);
  }

  const chart = await tools.getChartOpportunities({
    market: intent.market,
    limit: intent.limit,
    excludeTrackIds: new Set([
      ...(index?.trackPlaylistNames.keys() ?? []),
      ...extraExcludeTrackIds,
    ]),
    mode: intent.mode,
    windowDays: intent.windowDays ?? undefined,
    genre: intent.genre,
    genres: intent.genres,
  });
  const exclusions = intent.excludeWorkspaceTracks
    ? index?.complete
      ? ` e confirmei que não estão em nenhuma das ${index.playlistsTotal} playlists do workspace`
      : index
        ? ` e excluí as faixas encontradas em ${index.playlistsChecked} de ${index.playlistsTotal} playlists`
        : "; não consegui confirmar a ausência nas playlists porque o Spotify do workspace está indisponível"
    : "";
  const historyExclusion = extraExcludeTrackIds.length
    ? ` e não repeti as ${extraExcludeTrackIds.length} faixas já apresentadas nesta conversa`
    : "";
  const requestedGenre = intent.genres.length
    ? intent.genres
        .map((genre) => TRACK_PROFILE_GENRE_LABELS[genre])
        .join(" + ")
    : intent.genre
      ? TRACK_PROFILE_GENRE_LABELS[intent.genre]
      : null;
  const text = chart.cards.length
    ? chart.historical && chart.windowDays
      ? `Pesquisei todos os snapshots diários de ${chart.windowStartDate ?? "início da janela"} a ${chart.latestChartDate ?? "hoje"}. Estas são as ${chart.cards.length} faixas${requestedGenre ? ` classificadas como ${requestedGenre}` : ""} com maior volume acumulado no Top 200 ${marketLabel(intent.market)} em ${chart.windowDays} dias${exclusions}${historyExclusion}. Não misturei outros gêneros para completar a lista.`
      : `Estas são as ${chart.cards.length} decisões mais fortes de ${marketLabel(intent.market)} agora${exclusions}${historyExclusion}. A ordem considera força atual, movimento, frescor, estabilidade e risco de saturação.`
    : requestedGenre
      ? `Não encontrei faixas classificadas como ${requestedGenre} com evidência suficiente no Top 200 ${marketLabel(intent.market)} para a janela pedida. Mantive a resposta vazia para não misturar outros gêneros.`
      : `Não encontrei oportunidades de ${marketLabel(intent.market)} que atendam aos filtros com dados suficientes agora.`;
  const dataSources = [...buildChartSources(chart)];
  if (intent.excludeWorkspaceTracks) {
    dataSources.push(
      source(
        "workspace_playlists",
        "Playlists do workspace",
        index
          ? `${index.playlistsChecked}/${index.playlistsTotal} playlists verificadas.`
          : (workspace.message ?? "Spotify do workspace indisponível."),
        index?.complete ? "used" : index ? "partial" : "unavailable",
      ),
    );
  }

  return response("chart_opportunities", {
    text,
    cards: chart.cards,
    actions: chart.cards.length
      ? [
          action(
            "add_to_playlist",
            "Adicionar na playlist",
            "Ação preparada; nenhuma faixa será adicionada nesta V1.",
            {
              trackIds: chart.cards
                .map((card) => card.spotifyTrackId)
                .filter(Boolean),
            },
          ),
          action(
            "watch_7_days",
            "Observar 7 dias",
            "Ação preparada para acompanhar a evolução destes sinais.",
            {
              trackIds: chart.cards
                .map((card) => card.spotifyTrackId)
                .filter(Boolean),
            },
          ),
        ]
      : [],
    confidence: chart.cards.length
      ? intent.excludeWorkspaceTracks && !index?.complete
        ? 76
        : 92
      : 45,
    dataSources,
  });
}

async function answerPlaylistRecommendations({
  intent,
  workspace,
  tools,
}: {
  intent: DetectedPlaylistsAiIntent;
  workspace: WorkspacePlaylistsToolResult;
  tools: PlaylistsAiAgentTools;
}) {
  if (!intent.playlistReference) {
    const examples = workspace.playlists
      .slice(0, 5)
      .map((playlist) => playlist.name);
    return response("playlist_recommendations", {
      text: examples.length
        ? `Qual playlist você quer analisar? Encontrei, por exemplo: ${examples.join(", ")}.`
        : "Preciso do nome da playlist e de uma conexão Spotify ativa para recomendar faixas com segurança.",
      cards: [],
      actions: [],
      confidence: 20,
      dataSources: [buildWorkspaceSource(workspace)],
    });
  }

  const result = await tools.recommendTracksForPlaylist(
    intent.playlistReference,
    {
      limit: intent.limit,
    },
  );
  if (!result.playlist) {
    return response("playlist_recommendations", {
      text:
        result.message ??
        `Não encontrei dados suficientes para analisar ${intent.playlistReference}.`,
      cards: [],
      actions: [],
      confidence: 20,
      dataSources: [buildWorkspaceSource(workspace)],
    });
  }

  const chartResult: ChartOpportunitiesToolResult = {
    cards: result.cards,
    latestChartDate: result.latestChartDate,
    maxWindow: result.maxWindow,
    status: result.cards.length ? "ready" : "partial",
  };
  return response("playlist_recommendations", {
    text: result.cards.length
      ? `Cruzei o repertório real de ${result.playlist.name} com os charts BR e Global. Estas ${result.cards.length} faixas ainda não estão nela e tiveram o melhor equilíbrio entre oportunidade e aderência ao perfil ${GENRE_LABEL[result.playlistGenre]}.`
      : (result.message ??
        "Não encontrei recomendação segura para esta playlist agora."),
    cards: result.cards,
    actions: result.cards.length
      ? [
          action(
            "add_to_playlist",
            `Adicionar em ${result.playlist.name}`,
            "Ação preparada; a inclusão real permanece bloqueada nesta V1.",
            {
              playlistId: result.playlist.id,
              trackIds: result.cards
                .map((card) => card.spotifyTrackId)
                .filter(Boolean),
            },
          ),
          action(
            "watch_7_days",
            "Observar 7 dias",
            "Acompanhar o sinal antes da decisão final.",
            {
              trackIds: result.cards
                .map((card) => card.spotifyTrackId)
                .filter(Boolean),
            },
          ),
        ]
      : [],
    confidence: result.cards.length ? 90 : 42,
    dataSources: [
      buildWorkspaceSource(workspace),
      ...buildChartSources(chartResult),
    ],
  });
}

async function answerTrackPresence({
  intent,
  workspace,
  tools,
}: {
  intent: DetectedPlaylistsAiIntent;
  workspace: WorkspacePlaylistsToolResult;
  tools: PlaylistsAiAgentTools;
}) {
  if (!intent.trackQuery) {
    return response("track_presence", {
      text: "Qual é o nome da música e do artista, ou o link da faixa no Spotify? Sem isso eu não consigo confirmar com segurança.",
      cards: [],
      actions: [],
      confidence: 10,
      dataSources: [buildWorkspaceSource(workspace)],
    });
  }

  const presence = await tools.searchTrackInPlaylists(intent.trackQuery);
  const chart = presence.track
    ? await tools.getChartTrackSignal(presence.track.id)
    : { track: null, latestChartDate: null, maxWindow: 0 };
  const cards = cardForPresence(presence, chart);
  const text = !presence.track
    ? (presence.message ?? "Não encontrei essa faixa na Spotify API.")
    : presence.playlistNames.length > 0
      ? `${presence.track.name}, de ${presence.track.artists}, já está em ${presence.playlistNames.length} playlist(s): ${presence.playlistNames.join(", ")}.`
      : presence.complete
        ? `${presence.track.name}, de ${presence.track.artists}, não está em nenhuma das ${presence.playlistsTotal} playlists próprias verificadas.`
        : `${presence.track.name}, de ${presence.track.artists}, não apareceu nas ${presence.playlistsChecked} playlists que consegui verificar; a checagem ficou parcial.`;
  const dataSources = [
    source(
      "spotify_api",
      "Spotify API",
      presence.track
        ? "Faixa resolvida pelo catálogo oficial."
        : "Faixa não resolvida.",
      presence.track ? "used" : "unavailable",
    ),
    source(
      "workspace_playlists",
      "Playlists do workspace",
      `${presence.playlistsChecked}/${presence.playlistsTotal} playlists verificadas.`,
      presence.complete ? "used" : "partial",
    ),
    source(
      "genre_intelligence",
      "Genre Intelligence",
      presence.genreProfile &&
        presence.genreProfile.primaryGenre !== "desconhecido"
        ? `Gênero ${presence.genreProfile?.label} com confiança ${presence.genreProfile?.confidenceLabel}.`
        : "Gênero ainda sem evidência suficiente.",
      presence.genreProfile &&
        presence.genreProfile.primaryGenre !== "desconhecido"
        ? "used"
        : "partial",
    ),
  ];
  if (chart.track) {
    dataSources.push(
      source(
        "spotify_charts",
        "Spotify Charts",
        `Sinal encontrado no snapshot até ${chart.latestChartDate ?? "a data mais recente"}.`,
      ),
    );
  }

  return response("track_presence", {
    text,
    cards,
    actions: cards.length
      ? [
          action(
            presence.playlistNames.length > 0
              ? "reorder_top_20"
              : "add_to_playlist",
            presence.playlistNames.length > 0
              ? "Reordenar top 20"
              : "Adicionar na playlist",
            "Ação apenas preparada nesta V1.",
            { trackId: presence.track?.id },
          ),
        ]
      : [],
    confidence: presence.track ? (presence.complete ? 98 : 74) : 25,
    dataSources,
  });
}

async function answerPlaylistReview({
  intent,
  workspace,
  tools,
}: {
  intent: DetectedPlaylistsAiIntent;
  workspace: WorkspacePlaylistsToolResult;
  tools: PlaylistsAiAgentTools;
}) {
  const chart = await tools.getChartOpportunities({
    market: intent.market,
    limit: intent.limit,
    mode: "review",
  });
  let cards = chart.cards;
  let coverage = "";
  let complete = true;

  if (intent.playlistReference) {
    const playlist = await tools.getPlaylistTracks(
      intent.playlistReference,
      workspace.playlists,
    );
    if (!playlist.playlist) {
      return response("playlist_review", {
        text: playlist.message ?? "Não encontrei essa playlist para revisar.",
        cards: [],
        actions: [],
        confidence: 20,
        dataSources: [
          buildWorkspaceSource(workspace),
          ...buildChartSources(chart),
        ],
      });
    }
    const ids = new Set(playlist.playlist.tracks.map((track) => track.id));
    cards = cards
      .filter((card) => card.spotifyTrackId && ids.has(card.spotifyTrackId))
      .slice(0, intent.limit)
      .map((card) => ({
        ...card,
        playlistNames: [
          playlist.playlist?.name ?? intent.playlistReference ?? "Playlist",
        ],
        statusLabel: "Está na playlist · revisar",
      }));
    coverage = ` em ${playlist.playlist.name}`;
  } else if (workspace.connected) {
    const index = await tools.getWorkspaceTrackIndex(workspace.playlists);
    complete = index.complete;
    cards = cards
      .filter(
        (card) =>
          card.spotifyTrackId &&
          index.trackPlaylistNames.has(card.spotifyTrackId),
      )
      .slice(0, intent.limit)
      .map((card) => ({
        ...card,
        playlistNames:
          index.trackPlaylistNames.get(card.spotifyTrackId ?? "") ?? [],
        statusLabel: "Está no workspace · revisar",
      }));
    coverage = ` nas playlists do workspace (${index.playlistsChecked}/${index.playlistsTotal} verificadas)`;
  } else {
    complete = false;
  }

  return response("playlist_review", {
    text: cards.length
      ? `Encontrei ${cards.length} faixa(s)${coverage} com queda, perda de tração ou risco de saturação. Isto é uma fila de revisão, não uma ordem automática de remoção.`
      : `Não encontrei faixas${coverage} que cruzem presença real com os sinais atuais de revisão.`,
    cards,
    actions: cards.length
      ? [
          action(
            "watch_7_days",
            "Observar 7 dias",
            "Confirmar a tendência antes de remover qualquer faixa.",
            {
              trackIds: cards
                .map((card) => card.spotifyTrackId)
                .filter(Boolean),
            },
          ),
          action(
            "reorder_top_20",
            "Reordenar top 20",
            "Ação preparada para uma futura etapa com confirmação explícita.",
          ),
        ]
      : [],
    confidence: cards.length ? (complete ? 88 : 70) : 48,
    dataSources: [buildWorkspaceSource(workspace), ...buildChartSources(chart)],
  });
}

async function answerPlaylistIdea({
  intent,
  workspace,
  tools,
}: {
  intent: DetectedPlaylistsAiIntent;
  workspace: WorkspacePlaylistsToolResult;
  tools: PlaylistsAiAgentTools;
}) {
  const chart = await tools.getChartOpportunities({
    market: intent.market,
    limit: intent.limit,
    mode: intent.mode === "opportunity" ? "riser" : intent.mode,
    windowDays: intent.windowDays ?? undefined,
    genre: intent.genre,
    genres: intent.genres,
  });
  const cards = chart.cards.slice(0, intent.limit);
  const genreLabel = intent.genres.length
    ? intent.genres
        .map((genre) => TRACK_PROFILE_GENRE_LABELS[genre])
        .join(" + ")
    : intent.genre
      ? TRACK_PROFILE_GENRE_LABELS[intent.genre]
      : "Radar";
  const playlistName = `${genreLabel} em Ascensão · ${intent.market === "BR" ? "BR" : intent.market === "GLOBAL" ? "Global" : "BR + Global"}`;
  const description = `Seleção editorial de ${genreLabel.toLowerCase()} baseada nas maiores subidas e oportunidades recentes do Spotify Charts ${marketLabel(intent.market)}. Atualize conforme os sinais mudarem.`;

  return response("playlist_idea", {
    text: cards.length
      ? chart.historical && chart.windowDays
        ? `Ideia: “${playlistName}”, com alvo de ${intent.targetSize} faixas. Pesquisei cada Top 200 diário dos últimos ${chart.windowDays} dias e mantive somente ${genreLabel}; estas ${cards.length} lideram por streams acumulados, presença e posição. Não completei com gêneros diferentes.`
        : `Ideia: “${playlistName}”, com alvo de ${intent.targetSize} faixas. Estas ${cards.length} formam o bloco inicial mais defensável pelos sinais atuais; complete o restante só depois de validar aderência e continuidade.`
      : intent.genres.length > 0 || intent.genre
        ? `Não encontrei faixas suficientes classificadas como ${genreLabel} na janela pedida. Prefiro deixar a seleção vazia a misturar gêneros sem evidência.`
        : "Não encontrei dados suficientes para montar uma ideia de playlist baseada nos charts agora.",
    cards,
    actions: cards.length
      ? [
          action(
            "create_playlist",
            "Criar playlist com essas músicas",
            "Plano preparado; a criação no Spotify está desativada nesta V1.",
            {
              name: playlistName,
              description,
              targetSize: intent.targetSize,
              trackIds: cards
                .map((card) => card.spotifyTrackId)
                .filter(Boolean),
            },
          ),
          action(
            "reorder_top_20",
            "Reordenar top 20",
            "Preparar uma sequência editorial sem executar alterações.",
          ),
        ]
      : [],
    confidence: cards.length >= 5 ? 86 : cards.length ? 67 : 30,
    dataSources: [buildWorkspaceSource(workspace), ...buildChartSources(chart)],
  });
}

async function answerPlaylistDescription({
  intent,
  workspace,
  tools,
}: {
  intent: DetectedPlaylistsAiIntent;
  workspace: WorkspacePlaylistsToolResult;
  tools: PlaylistsAiAgentTools;
}) {
  if (!intent.playlistReference) {
    return response("playlist_description", {
      text: "Qual playlist você quer descrever? Preciso do nome exato para ler o repertório real antes de sugerir o texto.",
      cards: [],
      actions: [],
      confidence: 10,
      dataSources: [buildWorkspaceSource(workspace)],
    });
  }

  const result = await tools.getPlaylistTracks(
    intent.playlistReference,
    workspace.playlists,
  );
  if (!result.playlist) {
    return response("playlist_description", {
      text: result.message ?? "Não encontrei essa playlist.",
      cards: [],
      actions: [],
      confidence: 20,
      dataSources: [buildWorkspaceSource(workspace)],
    });
  }

  const genre = detectPlaylistGenre(
    result.playlist.name,
    result.playlist.description,
  );
  const label = genre === "unknown" ? "música" : GENRE_LABEL[genre];
  const artistNames = Array.from(
    new Set(
      result.playlist.tracks
        .flatMap((track) => track.artists.split(","))
        .map((artist) => artist.trim())
        .filter(Boolean),
    ),
  ).slice(0, 4);
  const artistText = artistNames.length
    ? ` com nomes como ${artistNames.join(", ")}`
    : "";
  const proposedDescription =
    `Uma seleção atualizada de ${label}${artistText}. Descubra faixas fortes, novidades e repertório para ouvir do começo ao fim.`.slice(
      0,
      300,
    );

  return response("playlist_description", {
    text: `Sugestão para ${result.playlist.name}: “${proposedDescription}” Usei apenas o nome e o repertório atual; não incluí números ou promessas que a base não comprova.`,
    cards: [],
    actions: [
      action(
        "update_description",
        "Atualizar descrição",
        "Texto preparado; nenhuma descrição será alterada nesta V1.",
        { playlistId: result.playlist.id, proposedDescription },
      ),
    ],
    confidence: result.playlist.tracks.length > 0 ? 84 : 55,
    dataSources: [
      buildWorkspaceSource(workspace),
      source(
        "spotify_api",
        "Spotify API",
        `${result.playlist.tracks.length} faixas lidas em ${result.playlist.name}.`,
      ),
    ],
  });
}

async function answerGeneral({
  workspace,
}: {
  workspace: WorkspacePlaylistsToolResult;
}) {
  return response("general", {
    text: "Ainda não identifiquei com segurança a decisão que você quer tomar. Posso pensar com você sobre uma playlist existente, uma faixa, oportunidades dos charts ou uma nova ideia editorial.",
    cards: [],
    actions: [],
    confidence: 30,
    dataSources: [buildWorkspaceSource(workspace)],
  });
}

function extractOpenAIText(payload: unknown) {
  const root = payload as { output_text?: unknown; output?: unknown };
  if (typeof root.output_text === "string") return root.output_text.trim();
  const texts: string[] = [];

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.type === "output_text" && typeof record.text === "string") {
      texts.push(record.text);
    }
    Object.values(record).forEach(visit);
  }

  visit(root.output);
  return texts.join("\n").trim();
}

type PlaylistsAiAgentRequest = (
  body: Record<string, unknown>,
) => Promise<unknown>;

type OpenAiFunctionCall = {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
};

const PLAYLISTS_AI_FUNCTIONS = [
  {
    type: "function",
    name: "get_workspace_playlists",
    description:
      "Lista as playlists reais conectadas ao workspace. Use para descobrir nomes válidos antes de analisar uma playlist específica.",
    strict: true,
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_playlist_tracks",
    description:
      "Lê o repertório real de uma playlist do workspace. Use para analisar repertório ou preparar uma descrição baseada nas faixas existentes.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        playlistReference: {
          type: "string",
          description: "Nome ou ID exato da playlist.",
        },
      },
      required: ["playlistReference"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_chart_opportunities",
    description:
      "Consulta músicas reais nos Spotify Charts atuais ou históricos. Use para listas por mercado, gênero, período, subida, queda ou criação de uma nova playlist.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          enum: ["opportunities", "review", "playlist_idea"],
        },
        market: { type: "string", enum: ["BR", "GLOBAL", "BOTH"] },
        genres: {
          type: "array",
          items: { type: "string", enum: PLANNER_GENRES },
          maxItems: 4,
        },
        mode: {
          type: "string",
          enum: ["opportunity", "heat", "riser", "review", "historical"],
        },
        windowDays: {
          anyOf: [
            { type: "integer", minimum: 1, maximum: 365 },
            { type: "null" },
          ],
        },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        targetSize: { type: "integer", minimum: 10, maximum: 500 },
        playlistReference: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        excludeWorkspaceTracks: { type: "boolean" },
        excludePreviouslyShown: { type: "boolean" },
      },
      required: [
        "purpose",
        "market",
        "genres",
        "mode",
        "windowDays",
        "limit",
        "targetSize",
        "playlistReference",
        "excludeWorkspaceTracks",
        "excludePreviouslyShown",
      ],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "search_track_in_playlists",
    description:
      "Resolve uma faixa e verifica em quais playlists próprias do workspace ela já está.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Nome da música com artista, link ou URI Spotify.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "search_spotify_track",
    description:
      "Pesquisa o catálogo oficial do Spotify para identificar uma faixa quando o nome fornecido for ambíguo.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 10 },
      },
      required: ["query", "limit"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "recommend_tracks_for_playlist",
    description:
      "Cruza o repertório de uma playlist real com charts, gênero e Music Intelligence para recomendar somente faixas que ainda não estão nela.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        playlistReference: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["playlistReference", "limit"],
      additionalProperties: false,
    },
  },
] as const;

function recordValue(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, Math.min(Math.round(value), maximum))
    : fallback;
}

function agentGenres(value: unknown, fallback: TrackProfileGenre[]) {
  if (!Array.isArray(value)) return fallback;
  return value.filter(
    (genre): genre is TrackProfileGenre =>
      typeof genre === "string" &&
      PLANNER_GENRES.includes(genre as TrackProfileGenre) &&
      genre !== "desconhecido",
  );
}

function agentIntent(
  base: DetectedPlaylistsAiIntent,
  values: Record<string, unknown>,
  name: PlaylistsAiIntent,
): DetectedPlaylistsAiIntent {
  const genres = agentGenres(values.genres, base.genres);
  const market =
    values.market === "BR" ||
    values.market === "GLOBAL" ||
    values.market === "BOTH"
      ? values.market
      : base.market;
  const mode =
    values.mode === "opportunity" ||
    values.mode === "heat" ||
    values.mode === "riser" ||
    values.mode === "review" ||
    values.mode === "historical"
      ? values.mode
      : base.mode;
  const playlistReference =
    typeof values.playlistReference === "string" &&
    values.playlistReference.trim()
      ? values.playlistReference.trim()
      : base.playlistReference;
  const trackQuery =
    typeof values.query === "string" && values.query.trim()
      ? values.query.trim()
      : base.trackQuery;

  return {
    ...base,
    name,
    market,
    genres,
    genre: genres[0] ?? null,
    mode,
    windowDays:
      typeof values.windowDays === "number"
        ? clampWindow(values.windowDays)
        : base.windowDays,
    limit: numberValue(values.limit, base.limit, 1, 50),
    targetSize: numberValue(values.targetSize, base.targetSize, 10, 500),
    playlistReference,
    trackQuery,
    excludeWorkspaceTracks:
      typeof values.excludeWorkspaceTracks === "boolean"
        ? values.excludeWorkspaceTracks
        : base.excludeWorkspaceTracks,
  };
}

function modelResult(result: PlaylistsAiChatResponse, requestedCount: number) {
  return {
    verified: true,
    summary: result.text,
    requestedCount,
    returnedCount: result.cards.length,
    confidence: result.confidence,
    tracks: result.cards.map((card) => ({
      id: card.spotifyTrackId,
      name: card.name,
      artists: card.artists,
      opportunityScore: card.opportunityScore,
      positions: card.positions,
      movement7d: card.movement7d,
      genre: card.genreProfile?.label ?? null,
      genreConfidence: card.genreProfile?.genreConfidence ?? null,
      status: card.statusLabel,
      reason: card.reason.slice(0, 420),
      historicalMetrics: card.historicalMetrics ?? null,
    })),
    actions: result.actions.map((item) => item.label),
    dataSources: result.dataSources,
  };
}

function rememberAgentResult(
  brief: PlaylistsAiCurationBrief,
  intent: DetectedPlaylistsAiIntent,
  result: PlaylistsAiChatResponse,
) {
  const shown = result.cards
    .map((card) => card.spotifyTrackId)
    .filter((trackId): trackId is string => Boolean(trackId));
  return {
    ...brief,
    requestedGenres: intent.genres,
    lastRequestedCount: intent.limit,
    lastShownTrackIds: [
      ...new Set([...(brief.lastShownTrackIds ?? []), ...shown]),
    ].slice(-100),
  };
}

function evidenceLedText({
  text,
  result,
  intent,
  conversation,
}: {
  text: string;
  result: PlaylistsAiChatResponse;
  intent: DetectedPlaylistsAiIntent;
  conversation: PlaylistsAiConversationMessage[];
}) {
  if (result.cards.length === 0) return text || result.text;
  const recentAssistant = conversation
    .filter((item) => item.role === "assistant")
    .slice(-1)[0]?.content;
  const normalizedText = normalizePlaylistAiText(text);
  const repeated = Boolean(
    recentAssistant &&
    normalizePlaylistAiText(recentAssistant) === normalizedText,
  );
  const namedTracks = result.cards.slice(0, 3).map((card) => card.name);
  const citesTrack = namedTracks.some((name) =>
    normalizedText.includes(normalizePlaylistAiText(name)),
  );
  const genre = intent.genres.length
    ? intent.genres.map((item) => TRACK_PROFILE_GENRE_LABELS[item]).join(" + ")
    : null;
  const countLead =
    result.cards.length < intent.limit
      ? `A base sustentou ${result.cards.length} das ${intent.limit} faixas pedidas${genre ? ` em ${genre}` : ""}; preferi não completar com sinais fracos ou outro gênero.`
      : `Fechei ${result.cards.length} faixas${genre ? ` de ${genre}` : ""} com evidência suficiente.`;
  const namesLead = namedTracks.length
    ? `O bloco mais forte começa com ${namedTracks.join(", ")}.`
    : "";
  const groundedLead = `${countLead} ${namesLead}`.trim();

  if (!text || repeated) return groundedLead;
  if (!citesTrack) return `${groundedLead}\n\n${text}`;
  return text;
}

async function executeAgentFunction({
  call,
  fallbackIntent,
  brief,
  workspace,
  tools,
}: {
  call: OpenAiFunctionCall;
  fallbackIntent: DetectedPlaylistsAiIntent;
  brief: PlaylistsAiCurationBrief;
  workspace: WorkspacePlaylistsToolResult;
  tools: PlaylistsAiAgentTools;
}): Promise<{
  output: unknown;
  result: PlaylistsAiChatResponse | null;
  intent: DetectedPlaylistsAiIntent;
}> {
  const values = recordValue(JSON.parse(call.arguments || "{}"));

  if (call.name === "get_workspace_playlists") {
    return {
      output: {
        connected: workspace.connected,
        message: workspace.message,
        playlists: workspace.playlists.map((playlist) => ({
          id: playlist.id,
          name: playlist.name,
          tracksTotal: playlist.tracksTotal,
        })),
      },
      result: null,
      intent: fallbackIntent,
    };
  }

  if (call.name === "get_playlist_tracks") {
    const intent = agentIntent(
      fallbackIntent,
      values,
      fallbackIntent.name === "playlist_description"
        ? "playlist_description"
        : "general",
    );
    const playlist = intent.playlistReference
      ? await tools.getPlaylistTracks(
          intent.playlistReference,
          workspace.playlists,
        )
      : { found: false, playlist: null, message: "Playlist não informada." };
    const result =
      intent.name === "playlist_description" && intent.playlistReference
        ? await answerPlaylistDescription({ intent, workspace, tools })
        : null;
    return {
      output: result
        ? modelResult(result, intent.limit)
        : {
            found: playlist.found,
            message: playlist.message,
            playlist: playlist.playlist
              ? {
                  id: playlist.playlist.id,
                  name: playlist.playlist.name,
                  description: playlist.playlist.description,
                  tracksTotal: playlist.playlist.tracks.length,
                  tracks: playlist.playlist.tracks
                    .slice(0, 100)
                    .map((track) => ({
                      id: track.id,
                      name: track.name,
                      artists: track.artists,
                      popularity: track.popularity,
                    })),
                }
              : null,
          },
      result,
      intent,
    };
  }

  if (call.name === "get_chart_opportunities") {
    const purpose = values.purpose;
    const name: PlaylistsAiIntent =
      purpose === "review"
        ? "playlist_review"
        : purpose === "playlist_idea"
          ? "playlist_idea"
          : "chart_opportunities";
    const intent = agentIntent(fallbackIntent, values, name);
    const extraExcludeTrackIds =
      values.excludePreviouslyShown === true
        ? (brief.lastShownTrackIds ?? [])
        : [];
    const result =
      name === "playlist_review"
        ? await answerPlaylistReview({ intent, workspace, tools })
        : name === "playlist_idea"
          ? await answerPlaylistIdea({ intent, workspace, tools })
          : await answerChartOpportunities({
              intent,
              workspace,
              tools,
              extraExcludeTrackIds,
            });
    return {
      output: modelResult(result, intent.limit),
      result,
      intent,
    };
  }

  if (call.name === "search_track_in_playlists") {
    const intent = agentIntent(fallbackIntent, values, "track_presence");
    const result = await answerTrackPresence({ intent, workspace, tools });
    return {
      output: modelResult(result, 1),
      result,
      intent: { ...intent, limit: 1 },
    };
  }

  if (call.name === "search_spotify_track") {
    const query = typeof values.query === "string" ? values.query.trim() : "";
    const limit = numberValue(values.limit, 5, 1, 10);
    const tracks = query
      ? (await tools.searchSpotifyTrack(query)).slice(0, limit)
      : [];
    return {
      output: { query, tracks },
      result: null,
      intent: fallbackIntent,
    };
  }

  if (call.name === "recommend_tracks_for_playlist") {
    const intent = agentIntent(
      fallbackIntent,
      values,
      "playlist_recommendations",
    );
    const result = await answerPlaylistRecommendations({
      intent,
      workspace,
      tools,
    });
    return {
      output: modelResult(result, intent.limit),
      result,
      intent,
    };
  }

  throw new Error(`Tool desconhecida: ${call.name}`);
}

async function requestAiGatewayAgent(
  authToken: string,
  body: Record<string, unknown>,
) {
  const response = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
      "X-Vercel-AI-App-Name": "Playlist OS",
      "X-Vercel-AI-App-Url": "https://system.soasbraba.com/playlists-ia",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw new Error(`AI Gateway ${response.status}: ${detail}`);
  }
  return response.json();
}

function unavailableAgentResponse({
  brief,
  intent,
  workspace,
  toolCalls = [],
  reason = "missing_credentials",
}: {
  brief: PlaylistsAiCurationBrief;
  intent: DetectedPlaylistsAiIntent;
  workspace: WorkspacePlaylistsToolResult;
  toolCalls?: string[];
  reason?: "missing_credentials" | "agent_failed" | "incomplete_run";
}): PlaylistsAiChatResponse {
  const result = response(
    intent.name,
    {
      text:
        reason === "missing_credentials"
          ? "A inteligência do Playlist OS ainda não foi ativada pelo administrador. Nenhuma recomendação foi gerada."
          : "Não consegui concluir esta consulta com segurança agora. Nenhuma recomendação foi gerada; tente novamente em instantes.",
      cards: [],
      actions: [],
      confidence: 0,
      dataSources: [
        buildWorkspaceSource(workspace),
        source(
          "music_intelligence",
          "Agente Sol",
          reason === "missing_credentials"
            ? "Inteligência global ainda não configurada no servidor."
            : "Execução do agente não concluída.",
          "unavailable",
        ),
      ],
    },
    {
      brief,
      mode: "analysis",
      contextComplete: brief.missingFields.length === 0,
    },
  );

  return {
    ...result,
    meta: {
      ...result.meta,
      execution: "unavailable",
      toolCalls,
      requestedCount: intent.limit,
      returnedCount: 0,
    },
  };
}

async function runToolCallingAgent({
  prompt,
  conversation,
  brief,
  fallbackIntent,
  workspace,
  tools,
  requestOverride,
}: {
  prompt: string;
  conversation: PlaylistsAiConversationMessage[];
  brief: PlaylistsAiCurationBrief;
  fallbackIntent: DetectedPlaylistsAiIntent;
  workspace: WorkspacePlaylistsToolResult;
  tools: PlaylistsAiAgentTools;
  requestOverride?: PlaylistsAiAgentRequest;
}): Promise<PlaylistsAiChatResponse | null> {
  try {
    const credentials = requestOverride
      ? null
      : await getEffectiveAiGatewayCredentials();
    if (!requestOverride && !credentials) {
      return unavailableAgentResponse({
        brief,
        intent: fallbackIntent,
        workspace,
      });
    }
    const request: PlaylistsAiAgentRequest =
      requestOverride ??
      ((body) => requestAiGatewayAgent(credentials?.authToken ?? "", body));
    const input: unknown[] = [
      ...conversation.slice(-30).map((item) => ({
        role: item.role,
        content: item.content.slice(0, 2400),
      })),
      { role: "user", content: prompt },
    ];
    const toolCalls: string[] = [];
    let selectedResult: PlaylistsAiChatResponse | null = null;
    let selectedIntent = fallbackIntent;
    let finalPayload: unknown = null;

    for (let step = 0; step < 6; step += 1) {
      const payload = await request({
        model: credentials?.model ?? "test-model",
        instructions: `Você é o Sol, copiloto read-only de curadoria do Playlist OS. Você pensa como curador editorial, A&R e analista de Spotify Charts, mas fala naturalmente em português brasileiro.

Contexto persistido da curadoria: ${JSON.stringify(brief)}
Playlists válidas deste workspace: ${JSON.stringify(workspace.playlists.map((playlist) => playlist.name))}

Regras de trabalho:
- Use as tools para qualquer afirmação sobre músicas, charts, histórico, gênero, popularidade ou playlists. Nunca responda uma consulta concreta só com memória ou texto genérico.
- A mensagem mais recente corrige as anteriores. Se o usuário mudar para funk, descarte o gênero anterior. Se pedir mais faixas ou disser para não repetir, preserve o restante do contexto e consulte novamente.
- Respeite exatamente mercado, gênero, janela e quantidade. O limite por consulta é 50. Se a base retornar menos, diga quantas encontrou e não complete com outro gênero.
- Para períodos como 7, 30 ou 180 dias, use modo historical. Para "bombando hoje", use heat. Para crescimento, use riser.
- Só faça uma pergunta quando faltar uma identidade indispensável, como o nome da playlist ou da música. Faça uma única pergunta específica, nunca um questionário.
- Depois das tools, responda em até três parágrafos curtos. Cite nominalmente de três a cinco faixas quando houver cards, explique o principal critério editorial e proponha um próximo passo útil.
- Não repita frases prontas nem a resposta anterior. Não diga apenas "estas são as decisões mais fortes". Traga uma leitura específica do resultado.
- Nunca invente posição, streams, gênero, presença em playlist, causalidade ou ação executada. Todas as ações permanecem preparadas e read-only.`,
        input,
        tools: PLAYLISTS_AI_FUNCTIONS,
        tool_choice: "auto",
        parallel_tool_calls: false,
        reasoning: { effort: "medium" },
        max_output_tokens: 1400,
        store: true,
      });
      finalPayload = payload;
      const output = recordValue(payload).output;
      const outputItems = Array.isArray(output) ? output : [];
      const calls = outputItems.filter((item): item is OpenAiFunctionCall =>
        Boolean(
          item &&
          typeof item === "object" &&
          (item as Record<string, unknown>).type === "function_call" &&
          typeof (item as Record<string, unknown>).name === "string" &&
          typeof (item as Record<string, unknown>).arguments === "string" &&
          typeof (item as Record<string, unknown>).call_id === "string",
        ),
      );
      if (calls.length === 0) break;

      input.push(...outputItems);
      for (const call of calls) {
        toolCalls.push(call.name);
        try {
          const executed = await executeAgentFunction({
            call,
            fallbackIntent,
            brief,
            workspace,
            tools,
          });
          if (executed.result) selectedResult = executed.result;
          selectedIntent = executed.intent;
          input.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify(executed.output),
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          input.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({
              verified: false,
              error: message.slice(0, 500),
            }),
          });
        }
      }
    }

    const generatedText = extractOpenAIText(finalPayload).slice(0, 4000);
    if (selectedResult) {
      let rememberedBrief = inferCurationBrief({
        message: prompt,
        messages: conversation,
        value: brief,
        intent: selectedIntent.name,
        playlistReference: selectedIntent.playlistReference,
      });
      if (selectedIntent.genres.length > 1) {
        rememberedBrief = {
          ...rememberedBrief,
          genre: selectedIntent.genres
            .map((genre) => TRACK_PROFILE_GENRE_LABELS[genre])
            .join(" + "),
        };
      }
      rememberedBrief = rememberAgentResult(
        rememberedBrief,
        selectedIntent,
        selectedResult,
      );
      return {
        ...selectedResult,
        text: evidenceLedText({
          text: generatedText,
          result: selectedResult,
          intent: selectedIntent,
          conversation,
        }),
        brief: rememberedBrief,
        meta: {
          ...selectedResult.meta,
          intent: selectedIntent.name,
          mode:
            selectedResult.cards.length > 0 || selectedResult.actions.length > 0
              ? "recommendation"
              : selectedResult.confidence <= 25
                ? "question"
                : "analysis",
          contextComplete: rememberedBrief.missingFields.length === 0,
          execution: "agent",
          toolCalls,
          requestedCount: selectedIntent.limit,
          returnedCount: selectedResult.cards.length,
        },
      };
    }

    if (!generatedText || fallbackIntent.name !== "general") {
      return unavailableAgentResponse({
        brief,
        intent: selectedIntent,
        workspace,
        toolCalls,
        reason: "incomplete_run",
      });
    }
    return response(
      "general",
      {
        text: generatedText,
        cards: [],
        actions: [],
        confidence: 72,
        dataSources: [buildWorkspaceSource(workspace)],
      },
      {
        brief,
        mode: generatedText.includes("?") ? "question" : "analysis",
        contextComplete: brief.missingFields.length === 0,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Playlists IA agent loop fallback: ${message}\n`);
    return unavailableAgentResponse({
      brief,
      intent: fallbackIntent,
      workspace,
      reason: "agent_failed",
    });
  }
}

export async function runPlaylistsAiAgent(
  {
    message,
    messages = [],
    brief: briefValue,
  }: {
    message: string;
    messages?: PlaylistsAiConversationMessage[];
    brief?: unknown;
  },
  {
    tools = DEFAULT_TOOLS,
    polish = true,
    planning = polish,
    agentRequest,
  }: {
    tools?: PlaylistsAiAgentTools;
    polish?: boolean;
    planning?: boolean;
    agentRequest?: PlaylistsAiAgentRequest;
  } = {},
) {
  const workspace = await tools.getWorkspacePlaylists();
  const playlistNames = workspace.playlists.map((playlist) => playlist.name);
  const fallbackIntent = classifyPlaylistAiIntent(message, playlistNames);
  const initialBrief = inferCurationBrief({
    message,
    messages,
    value: briefValue,
    intent: fallbackIntent.name,
    playlistReference: fallbackIntent.playlistReference,
  });
  if (polish) {
    const agentResult = await runToolCallingAgent({
      prompt: message,
      conversation: messages,
      brief: initialBrief,
      fallbackIntent,
      workspace,
      tools,
      requestOverride: agentRequest,
    });
    if (agentResult) return agentResult;
  }

  const planner =
    planning && !polish
      ? await planPlaylistAiRequest({
          prompt: message,
          conversation: messages,
          brief: briefValue,
          playlistNames,
          fallback: fallbackIntent,
        })
      : null;
  let intent = mergePlannerDecision(message, fallbackIntent, planner);
  let brief = inferCurationBrief({
    message,
    messages,
    value: briefValue,
    intent: intent.name,
    playlistReference: intent.playlistReference,
  });
  if (intent.genres.length > 1) {
    brief = {
      ...brief,
      genre: intent.genres
        .map((genre) => TRACK_PROFILE_GENRE_LABELS[genre])
        .join(" + "),
    };
  }
  const activeIntent =
    intent.name === "general" && brief.activeIntent
      ? brief.activeIntent
      : intent.name;
  intent = {
    ...intent,
    name: activeIntent,
    market: brief.market ?? intent.market,
    playlistReference: intent.playlistReference ?? brief.playlistName,
    trackQuery:
      intent.trackQuery ??
      (intent.name === "general" &&
      activeIntent === "track_presence" &&
      message.trim().length > 1
        ? message.trim()
        : null),
  };
  if (intent.genres.length === 0 && brief.genre) {
    const rememberedGenres = profileGenresFromPrompt(brief.genre);
    intent = {
      ...intent,
      genres: rememberedGenres,
      genre: rememberedGenres[0] ?? null,
    };
  }

  const directRequest = isDirectCurationRequest(message);
  const shouldAskFromContext = shouldAskForCurationContext({
    message,
    intent: intent.name,
    brief,
  });
  const shouldAskFromPlanner = Boolean(
    planner?.needsClarification && !directRequest,
  );
  if (shouldAskFromContext || shouldAskFromPlanner) {
    return response(
      intent.name,
      {
        text:
          shouldAskFromPlanner && planner?.clarificationQuestion
            ? planner.clarificationQuestion
            : buildCurationQuestion({ brief, playlistNames }),
        cards: [],
        actions: [],
        confidence: planner?.confidence ?? 80,
        dataSources: [buildWorkspaceSource(workspace)],
      },
      { brief, mode: "question", contextComplete: false },
    );
  }

  let result: PlaylistsAiChatResponse;

  if (intent.name === "chart_opportunities") {
    result = await answerChartOpportunities({ intent, workspace, tools });
  } else if (intent.name === "playlist_recommendations") {
    result = await answerPlaylistRecommendations({ intent, workspace, tools });
  } else if (intent.name === "track_presence") {
    result = await answerTrackPresence({ intent, workspace, tools });
  } else if (intent.name === "playlist_review") {
    result = await answerPlaylistReview({ intent, workspace, tools });
  } else if (intent.name === "playlist_idea") {
    result = await answerPlaylistIdea({
      intent,
      workspace,
      tools,
    });
  } else if (intent.name === "playlist_description") {
    result = await answerPlaylistDescription({ intent, workspace, tools });
  } else {
    result = await answerGeneral({ workspace });
  }

  const mode: PlaylistsAiResponseMode =
    result.cards.length > 0 || result.actions.length > 0
      ? "recommendation"
      : result.confidence <= 25
        ? "question"
        : "analysis";
  result = {
    ...result,
    brief: rememberAgentResult(brief, intent, result),
    meta: {
      ...result.meta,
      intent: intent.name,
      mode,
      contextComplete: brief.missingFields.length === 0,
      execution: polish ? "fallback" : "deterministic",
      requestedCount: intent.limit,
      returnedCount: result.cards.length,
    },
  };

  return result;
}
