import "server-only";
import {
  GENRE_LABEL,
  detectGenre,
  detectPlaylistGenre,
} from "@/lib/genre-detection";
import {
  buildCurationQuestion,
  createEmptyCurationBrief,
  inferCurationBrief,
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
import { getEffectiveOpenAICredentials } from "@/lib/workspaces";
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

export type DetectedPlaylistsAiIntent = {
  name: PlaylistsAiIntent;
  market: PlaylistsAiCurationMarket;
  limit: number;
  targetSize: number;
  playlistReference: string | null;
  trackQuery: string | null;
  excludeWorkspaceTracks: boolean;
  mode: "opportunity" | "heat" | "riser" | "review";
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

function extractNumbers(prompt: string) {
  return [...prompt.matchAll(/\b(\d{1,4})\b/g)]
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .filter((value) => Number.isFinite(value));
}

function inferLimit(prompt: string) {
  const requested = extractNumbers(prompt).find(
    (value) => value >= 1 && value <= 100,
  );
  return Math.min(requested ?? 10, 20);
}

function inferTargetSize(prompt: string) {
  const requested = extractNumbers(prompt).find(
    (value) => value >= 10 && value <= 500,
  );
  return requested ?? 50;
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
  const market: PlaylistsAiCurationMarket = /\bglobais?\b/.test(normalized)
    ? "GLOBAL"
    : "BR";
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
    mode: /maiores? subidas|subindo|crescendo|acelerando/.test(normalized)
      ? ("riser" as const)
      : /quentes|bombando|mais fortes|forca atual/.test(normalized)
        ? ("heat" as const)
        : ("opportunity" as const),
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

  return { ...base, name: "general" };
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
        ? `Top 200 completo até ${result.latestChartDate}.`
        : "Nenhum snapshot completo disponível.",
      result.latestChartDate ? "used" : "unavailable",
    ),
    source(
      "music_intelligence",
      "Music Intelligence",
      `Scores explicáveis com janela validada de até ${result.maxWindow} dias.`,
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
}: {
  intent: DetectedPlaylistsAiIntent;
  workspace: WorkspacePlaylistsToolResult;
  tools: PlaylistsAiAgentTools;
}) {
  let index: WorkspaceTrackIndex | null = null;
  if (intent.excludeWorkspaceTracks && workspace.connected) {
    index = await tools.getWorkspaceTrackIndex(workspace.playlists);
  }

  const chart = await tools.getChartOpportunities({
    market: intent.market,
    limit: intent.limit,
    excludeTrackIds: new Set(index?.trackPlaylistNames.keys() ?? []),
    mode: intent.mode,
  });
  const exclusions = intent.excludeWorkspaceTracks
    ? index?.complete
      ? ` e confirmei que não estão em nenhuma das ${index.playlistsTotal} playlists do workspace`
      : index
        ? ` e excluí as faixas encontradas em ${index.playlistsChecked} de ${index.playlistsTotal} playlists`
        : "; não consegui confirmar a ausência nas playlists porque o Spotify do workspace está indisponível"
    : "";
  const text = chart.cards.length
    ? `Estas são as ${chart.cards.length} decisões mais fortes de ${marketLabel(intent.market)} agora${exclusions}. A ordem considera força atual, movimento, frescor, estabilidade e risco de saturação.`
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
    limit: 20,
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
  prompt,
  intent,
  workspace,
  tools,
}: {
  prompt: string;
  intent: DetectedPlaylistsAiIntent;
  workspace: WorkspacePlaylistsToolResult;
  tools: PlaylistsAiAgentTools;
}) {
  const chart = await tools.getChartOpportunities({
    market: intent.market,
    limit: 20,
    mode: intent.mode === "opportunity" ? "riser" : intent.mode,
  });
  const genre = detectPlaylistGenre(prompt, "");
  const genreMatches =
    genre === "unknown"
      ? chart.cards
      : chart.cards.filter(
          (card) => detectGenre(card.artists, card.name) === genre,
        );
  const cards = (genreMatches.length >= 3 ? genreMatches : chart.cards).slice(
    0,
    intent.limit,
  );
  const genreLabel = genre === "unknown" ? "Radar" : GENRE_LABEL[genre];
  const playlistName = `${genreLabel} em Ascensão · ${intent.market === "BR" ? "BR" : intent.market === "GLOBAL" ? "Global" : "BR + Global"}`;
  const description = `Seleção editorial de ${genreLabel.toLowerCase()} baseada nas maiores subidas e oportunidades recentes do Spotify Charts ${marketLabel(intent.market)}. Atualize conforme os sinais mudarem.`;

  return response("playlist_idea", {
    text: cards.length
      ? `Ideia: “${playlistName}”, com alvo de ${intent.targetSize} faixas. Estas ${cards.length} formam o bloco inicial mais defensável pelos sinais atuais; complete o restante só depois de validar aderência e continuidade.`
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

async function polishResponseText({
  prompt,
  conversation,
  result,
}: {
  prompt: string;
  conversation: PlaylistsAiConversationMessage[];
  result: PlaylistsAiChatResponse;
}) {
  try {
    const credentials = await getEffectiveOpenAICredentials();
    if (!credentials) return result;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: credentials.model,
        instructions:
          "Você é o copiloto read-only de curadoria do Playlist OS. Pense como curador editorial, A&R, especialista em Spotify Charts e estrategista de playlists. Reescreva a resposta em português brasileiro natural, direto e executivo, sem soar como chatbot genérico. Use somente os fatos fornecidos. Nunca invente posições, movimentos, presença em playlists, gêneros ou ações executadas. Considere o brief da curadoria e preserve qualquer ressalva sobre dados parciais. Responda apenas JSON no schema pedido.",
        input: JSON.stringify({
          userMessage: prompt,
          conversation: conversation.slice(-6),
          curationBrief: result.brief,
          verifiedDraft: result.text,
          cards: result.cards.slice(0, 12).map((card) => ({
            name: card.name,
            artists: card.artists,
            opportunityScore: card.opportunityScore,
            positions: card.positions,
            movement7d: card.movement7d,
            status: card.statusLabel,
            reason: card.reason,
          })),
          dataSources: result.dataSources,
        }),
        text: {
          format: {
            type: "json_schema",
            name: "playlist_os_chat_text",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: { text: { type: "string" } },
              required: ["text"],
            },
          },
        },
        max_output_tokens: 500,
      }),
      cache: "no-store",
    });
    if (!response.ok) return result;

    const payload = await response.json();
    const parsed = JSON.parse(extractOpenAIText(payload)) as { text?: unknown };
    const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
    if (!text || text.length > 2200) return result;
    return { ...result, text };
  } catch {
    return result;
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
  }: {
    tools?: PlaylistsAiAgentTools;
    polish?: boolean;
  } = {},
) {
  const workspace = await tools.getWorkspacePlaylists();
  let intent = classifyPlaylistAiIntent(
    message,
    workspace.playlists.map((playlist) => playlist.name),
  );
  const brief = inferCurationBrief({
    message,
    messages,
    value: briefValue,
    intent: intent.name,
    playlistReference: intent.playlistReference,
  });
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

  if (
    shouldAskForCurationContext({
      message,
      intent: intent.name,
      brief,
    })
  ) {
    return response(
      intent.name,
      {
        text: buildCurationQuestion({
          brief,
          playlistNames: workspace.playlists.map((playlist) => playlist.name),
        }),
        cards: [],
        actions: [],
        confidence: 80,
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
      prompt: message,
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
    brief,
    meta: {
      ...result.meta,
      intent: intent.name,
      mode,
      contextComplete: brief.missingFields.length === 0,
    },
  };

  return polish && mode !== "question"
    ? polishResponseText({ prompt: message, conversation: messages, result })
    : result;
}
