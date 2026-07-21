import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { exports: {} });

const { classifyPlaylistAiIntent, runPlaylistsAiAgent } =
  await import("../src/lib/playlists-ai-agent.ts");

const playlist = {
  id: "playlist-funk-2026",
  name: "FUNK 2026",
  ownerId: "owner-1",
  ownerName: "Workspace",
  imageUrl: null,
  tracksTotal: 60,
  spotifyUrl: "https://open.spotify.com/playlist/playlist-funk-2026",
  isPublic: true,
  isCollaborative: false,
};

function card(index, market = "BR") {
  return {
    id: `track-${index}`,
    spotifyTrackId: `track-${index}`,
    spotifyUrl: `https://open.spotify.com/track/track-${index}`,
    coverUrl: null,
    name: `Faixa ${index}`,
    artists: "Artista Teste",
    opportunityScore: 90 - index,
    positions: { [market]: index + 1 },
    movement7d: 20 - index,
    reason: "Sinal real de teste.",
    status: "not_in_playlist",
    statusLabel: "Ainda não está na playlist",
    suggestedAction: "Avaliar para adicionar",
    playlistNames: [],
  };
}

function buildTools() {
  return {
    getWorkspacePlaylists: async () => ({
      connected: true,
      playlists: [playlist],
      message: null,
    }),
    getPlaylistTracks: async () => ({
      found: true,
      playlist: {
        ...playlist,
        description: "Funk em alta",
        snapshotId: "snapshot-1",
        tracks: [],
      },
      message: null,
    }),
    getChartOpportunities: async ({
      market = "BR",
      limit = 10,
      excludeTrackIds = new Set(),
    } = {}) => ({
      cards: Array.from({ length: limit }, (_, index) =>
        card(index, market),
      ).filter((item) => !excludeTrackIds.has(item.spotifyTrackId)),
      latestChartDate: "2026-07-12",
      maxWindow: 365,
      status: "ready",
    }),
    getChartTrackSignal: async () => ({
      track: null,
      latestChartDate: "2026-07-12",
      maxWindow: 365,
    }),
    getWorkspaceTrackIndex: async () => ({
      trackPlaylistNames: new Map([["track-0", ["FUNK 2026"]]]),
      playlistsChecked: 1,
      playlistsTotal: 1,
      complete: true,
    }),
    searchTrackInPlaylists: async () => ({
      track: null,
      playlistNames: [],
      playlistsChecked: 1,
      playlistsTotal: 1,
      complete: true,
      message: "Não encontrada.",
    }),
    searchSpotifyTrack: async () => [],
    recommendTracksForPlaylist: async (_reference, { limit = 10 } = {}) => ({
      playlist: {
        ...playlist,
        description: "Funk em alta",
        snapshotId: "snapshot-1",
        tracks: [],
      },
      cards: Array.from({ length: limit }, (_, index) => card(index, "BR")),
      playlistGenre: "funk",
      latestChartDate: "2026-07-12",
      maxWindow: 365,
      message: null,
    }),
  };
}

test("classifies the five acceptance questions without fixed prompt matching", () => {
  const playlistNames = ["FUNK 2026"];

  assert.equal(
    classifyPlaylistAiIntent(
      "Quais músicas estão mais quentes no BR hoje?",
      playlistNames,
    ).name,
    "chart_opportunities",
  );
  const global = classifyPlaylistAiIntent(
    "Quais oportunidades globais ainda não estão nas minhas playlists?",
    playlistNames,
  );
  assert.equal(global.name, "chart_opportunities");
  assert.equal(global.market, "GLOBAL");
  assert.equal(global.excludeWorkspaceTracks, true);
  assert.equal(
    classifyPlaylistAiIntent(
      "Essa música já está em alguma playlist?",
      playlistNames,
    ).name,
    "track_presence",
  );
  const recommendation = classifyPlaylistAiIntent(
    "Me sugere 10 músicas para FUNK 2026.",
    playlistNames,
  );
  assert.equal(recommendation.name, "playlist_recommendations");
  assert.equal(recommendation.playlistReference, "FUNK 2026");
  assert.equal(recommendation.limit, 10);
  const weeklyRisers = classifyPlaylistAiIntent(
    "Cria uma ideia de playlist baseada nas maiores subidas da semana.",
    playlistNames,
  );
  assert.equal(weeklyRisers.name, "playlist_idea");
  assert.equal(weeklyRisers.mode, "riser");
  assert.equal(weeklyRisers.windowDays, 7);
});

test("understands a strict genre and a full historical window", () => {
  const intent = classifyPlaylistAiIntent(
    "Crie uma lista com as músicas de trap que mais tocaram nos charts nos últimos 180 dias.",
  );

  assert.equal(intent.name, "chart_opportunities");
  assert.equal(intent.market, "BR");
  assert.equal(intent.mode, "historical");
  assert.equal(intent.windowDays, 180);
  assert.equal(intent.genre, "trap");
  assert.deepEqual(intent.genres, ["trap"]);
  assert.equal(intent.limit, 10);
});

test("keeps trap and rap together instead of collapsing the request", () => {
  const intent = classifyPlaylistAiIntent(
    "Me entrega uma lista de músicas de trap e rap dos últimos 180 dias.",
  );

  assert.equal(intent.name, "chart_opportunities");
  assert.equal(intent.mode, "historical");
  assert.equal(intent.windowDays, 180);
  assert.deepEqual(intent.genres, ["trap", "rap"]);
});

test("classifies emerging low-saturation tracks as discovery", () => {
  const intent = classifyPlaylistAiIntent(
    "Quero descobrir 12 músicas novas e emergentes de trap, pouco saturadas no BR.",
  );

  assert.equal(intent.name, "chart_opportunities");
  assert.equal(intent.mode, "discovery");
  assert.equal(intent.limit, 12);
  assert.equal(intent.excludeWorkspaceTracks, true);
  assert.deepEqual(intent.genres, ["trap"]);
});

test("passes discovery safeguards to the chart tool", async () => {
  const tools = buildTools();
  let receivedOptions = null;
  tools.getChartOpportunities = async (options) => {
    receivedOptions = options;
    return {
      cards: [card(1, "BR")],
      latestChartDate: "2026-07-20",
      maxWindow: 365,
      status: "ready",
    };
  };

  const result = await runPlaylistsAiAgent(
    { message: "Descubra 8 faixas novas de funk pouco saturadas." },
    { tools, polish: false },
  );

  assert.equal(receivedOptions.mode, "discovery");
  assert.equal(receivedOptions.genre, "funk");
  assert.equal(receivedOptions.excludeTrackIds.has("track-0"), true);
  assert.match(result.text, /nova no chart/i);
});

test("does not mistake a historical window for the requested track count", () => {
  const intent = classifyPlaylistAiIntent(
    "Quais faixas de trap mais tocaram nos últimos 30 dias?",
  );

  assert.equal(intent.windowDays, 30);
  assert.equal(intent.limit, 10);
  assert.equal(intent.targetSize, 50);
});

test("respects an explicit request for fifty tracks", async () => {
  const intent = classifyPlaylistAiIntent(
    "Quero 50 músicas de funk no Brasil.",
  );
  assert.equal(intent.limit, 50);
  assert.deepEqual(intent.genres, ["funk"]);

  const result = await runPlaylistsAiAgent(
    { message: "Quero 50 músicas de funk no Brasil." },
    { tools: buildTools(), polish: false },
  );

  assert.equal(result.cards.length, 50);
  assert.equal(result.meta.requestedCount, 50);
  assert.equal(result.meta.returnedCount, 50);
  assert.equal(result.brief.lastRequestedCount, 50);
  assert.equal(result.brief.lastShownTrackIds.length, 50);
});

test("uses a real tool loop and grounds the answer in returned tracks", async () => {
  const requests = [];
  const agentRequest = async (body) => {
    requests.push(body);
    if (requests.length === 1) {
      return {
        id: "resp-tool-call",
        output: [
          {
            type: "function_call",
            name: "get_chart_opportunities",
            call_id: "call-chart",
            arguments: JSON.stringify({
              purpose: "opportunities",
              market: "BR",
              genres: ["funk"],
              mode: "heat",
              windowDays: null,
              limit: 50,
              targetSize: 50,
              playlistReference: null,
              excludeWorkspaceTracks: false,
              excludePreviouslyShown: false,
            }),
          },
        ],
      };
    }
    return {
      id: "resp-final",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Fechei 50 faixas de funk. Faixa 0, Faixa 1 e Faixa 2 abrem a seleção porque combinam força atual e movimento recente.",
            },
          ],
        },
      ],
    };
  };

  const result = await runPlaylistsAiAgent(
    { message: "Quero 50 músicas de funk." },
    { tools: buildTools(), agentRequest },
  );

  assert.equal(requests.length, 2);
  assert.equal(result.meta.execution, "agent");
  assert.deepEqual(result.meta.toolCalls, ["get_chart_opportunities"]);
  assert.equal(result.cards.length, 50);
  assert.match(result.text, /Faixa 0/);
  assert.match(result.text, /50 faixas de funk/i);
  assert.equal(
    requests[1].input.some(
      (item) =>
        item.type === "function_call_output" && item.call_id === "call-chart",
    ),
    true,
  );
});

test("never replaces an unavailable conversational agent with fake recommendations", async () => {
  const result = await runPlaylistsAiAgent(
    { message: "Quero 50 músicas de trap dos últimos 180 dias." },
    {
      tools: buildTools(),
      agentRequest: async () => {
        throw new Error("provider unavailable");
      },
    },
  );

  assert.equal(result.meta.execution, "unavailable");
  assert.equal(result.cards.length, 0);
  assert.equal(result.meta.returnedCount, 0);
  assert.doesNotMatch(result.text, /^Ideia:/);
  assert.match(result.text, /Nenhuma recomendação foi gerada/i);
});

test("keeps real chart intelligence available when the AI Gateway rate limits", async () => {
  const result = await runPlaylistsAiAgent(
    { message: "Quero 10 músicas de trap dos últimos 180 dias." },
    {
      tools: buildTools(),
      agentRequest: async () => {
        throw new Error("AI Gateway 429: free tier rate limited");
      },
    },
  );

  assert.equal(result.meta.execution, "fallback");
  assert.equal(result.cards.length, 10);
  assert.equal(result.meta.returnedCount, 10);
  assert.equal(result.confidence > 0, true);
  assert.doesNotMatch(result.text, /Nenhuma recomendação foi gerada/i);
});

test("queries verified system data before asking the model to explain it", async () => {
  const requests = [];
  const result = await runPlaylistsAiAgent(
    { message: "Quero 10 músicas de trap dos últimos 180 dias." },
    {
      tools: buildTools(),
      responseRequest: async (body) => {
        requests.push(body);
        return {
          id: "resp-grounded",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "A seleção de trap começa por Faixa 0, Faixa 1 e Faixa 2 porque elas sustentaram os sinais históricos mais fortes da janela.",
                },
              ],
            },
          ],
        };
      },
    },
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].tools, undefined);
  assert.match(
    requests[0].input.at(-1).content,
    /DADOS_VERIFICADOS:[\s\S]*Faixa 0/,
  );
  assert.equal(result.meta.execution, "agent");
  assert.equal(result.cards.length, 10);
  assert.match(result.text, /Faixa 0/);
});

test("preserves verified recommendations when the final model pass is limited", async () => {
  const result = await runPlaylistsAiAgent(
    { message: "Quero 10 músicas de trap dos últimos 180 dias." },
    {
      tools: buildTools(),
      responseRequest: async () => {
        throw new Error("AI Gateway 429: free tier rate limited");
      },
    },
  );

  assert.equal(result.meta.execution, "fallback");
  assert.equal(result.cards.length, 10);
  assert.equal(result.meta.returnedCount, 10);
  assert.doesNotMatch(result.text, /Nenhuma recomendação foi gerada/i);
});

test("answers a methodology follow-up from the verified conversation context", async () => {
  const result = await runPlaylistsAiAgent(
    {
      message:
        "Essa pesquisa está sendo feita em todos os dias do banco de dados dos charts?",
      messages: [
        {
          role: "assistant",
          content:
            "Pesquisei todos os snapshots diários dos últimos 180 dias e encontrei 12 faixas de trap.",
        },
      ],
      brief: {
        goal: null,
        market: "BR",
        playlistMode: "new",
        playlistName: null,
        genre: "Trap",
        audience: null,
        strategy: null,
        targetSize: 50,
        activeIntent: "chart_opportunities",
        completeness: 0,
        missingFields: [],
      },
    },
    {
      tools: buildTools(),
      agentRequest: async () => ({
        id: "resp-contextual-answer",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Sim. A consulta percorreu os 180 snapshots diários completos disponíveis na janela pedida.",
              },
            ],
          },
        ],
      }),
    },
  );

  assert.equal(result.meta.execution, "agent");
  assert.equal(result.meta.intent, "chart_opportunities");
  assert.equal(result.cards.length, 0);
  assert.equal(result.confidence, 84);
  assert.match(result.text, /180 snapshots diários completos/i);
});

test("still rejects a concrete music request when the agent skips tools", async () => {
  const result = await runPlaylistsAiAgent(
    { message: "Mostra as 10 músicas mais quentes nos charts do Brasil." },
    {
      tools: buildTools(),
      agentRequest: async () => ({
        id: "resp-ungrounded-list",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Aqui estão dez músicas." }],
          },
        ],
      }),
    },
  );

  assert.equal(result.meta.execution, "unavailable");
  assert.equal(result.cards.length, 0);
  assert.equal(result.confidence, 0);
});

test("keeps the verified explanation when discovery returns no tracks", async () => {
  const tools = buildTools();
  tools.getChartOpportunities = async () => ({
    cards: [],
    latestChartDate: "2026-07-20",
    maxWindow: 365,
    status: "ready",
  });
  let calls = 0;
  const result = await runPlaylistsAiAgent(
    { message: "Descubra faixas novas de trap pouco saturadas no Brasil." },
    {
      tools,
      agentRequest: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            output: [
              {
                type: "function_call",
                name: "get_chart_opportunities",
                call_id: "empty-discovery",
                arguments: JSON.stringify({
                  purpose: "opportunities",
                  market: "BR",
                  genres: ["trap"],
                  mode: "discovery",
                  windowDays: null,
                  limit: 10,
                  targetSize: 50,
                  playlistReference: null,
                  excludeWorkspaceTracks: true,
                  excludePreviouslyShown: false,
                }),
              },
            ],
          };
        }
        return {
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "O trap está consolidado; misture gênero desconhecido.",
                },
              ],
            },
          ],
        };
      },
    },
  );

  assert.equal(result.cards.length, 0);
  assert.match(result.text, /Não encontrei descobertas de Trap/i);
  assert.doesNotMatch(result.text, /consolidado|gênero desconhecido/i);
});

test("treats a natural genre correction as a data request", async () => {
  const tools = buildTools();
  let receivedOptions = null;
  tools.getChartOpportunities = async (options) => {
    receivedOptions = options;
    return {
      cards: [card(1, "BR"), card(2, "BR")],
      latestChartDate: "2026-07-12",
      maxWindow: 365,
      status: "ready",
      historical: true,
      windowDays: 180,
      windowStartDate: "2026-01-14",
    };
  };

  const result = await runPlaylistsAiAgent(
    {
      message:
        "Isso ficou genérico. Quero músicas de trap e rap que realmente tocaram nos últimos 180 dias.",
    },
    { tools, polish: false },
  );

  assert.equal(result.meta.mode, "recommendation");
  assert.deepEqual(receivedOptions.genres, ["trap", "rap"]);
  assert.equal(receivedOptions.mode, "historical");
  assert.equal(result.cards.length, 2);
  assert.match(result.text, /Trap \+ Rap/i);
});

test("passes historical genre filters to the database tool without broad fallback", async () => {
  const tools = buildTools();
  let receivedOptions = null;
  tools.getChartOpportunities = async (options) => {
    receivedOptions = options;
    return {
      cards: [],
      latestChartDate: "2026-07-13",
      maxWindow: 180,
      status: "partial",
      historical: true,
      windowDays: 180,
      windowStartDate: "2026-01-15",
    };
  };

  const result = await runPlaylistsAiAgent(
    {
      message:
        "Crie uma lista com as músicas de trap que mais tocaram nos charts nos últimos 180 dias.",
    },
    { tools, polish: false },
  );

  assert.equal(receivedOptions.mode, "historical");
  assert.equal(receivedOptions.windowDays, 180);
  assert.equal(receivedOptions.genre, "trap");
  assert.equal(result.cards.length, 0);
  assert.match(result.text, /não encontrei|misturar outros gêneros/i);
});

test("answers hot BR tracks with real-data cards and prepared actions", async () => {
  const result = await runPlaylistsAiAgent(
    { message: "Quais músicas estão mais quentes no BR hoje?" },
    { tools: buildTools(), polish: false },
  );

  assert.equal(result.meta.intent, "chart_opportunities");
  assert.equal(result.meta.readOnly, true);
  assert.equal(result.cards.length, 10);
  assert.equal(result.cards[0].positions.BR, 1);
  assert.equal(
    result.actions.every((item) => item.disabled),
    true,
  );
  assert.equal(
    result.dataSources.some((item) => item.id === "spotify_charts"),
    true,
  );
});

test("excludes tracks already indexed in workspace from global opportunities", async () => {
  const result = await runPlaylistsAiAgent(
    {
      message:
        "Quais oportunidades globais ainda não estão nas minhas playlists?",
    },
    { tools: buildTools(), polish: false },
  );

  assert.equal(
    result.cards.some((item) => item.spotifyTrackId === "track-0"),
    false,
  );
  assert.equal(
    result.cards.every((item) => item.positions.GLOBAL),
    true,
  );
  assert.match(result.text, /não estão|excluí|confirmei/i);
});

test("asks for track identity instead of inventing a presence result", async () => {
  const result = await runPlaylistsAiAgent(
    { message: "Essa música já está em alguma playlist?" },
    { tools: buildTools(), polish: false },
  );

  assert.equal(result.meta.intent, "track_presence");
  assert.equal(result.cards.length, 0);
  assert.match(result.text, /nome da música|link da faixa/i);
  assert.equal(result.confidence, 10);
});

test("returns ten playlist-fit recommendations for FUNK 2026", async () => {
  const result = await runPlaylistsAiAgent(
    { message: "Me sugere 10 músicas para FUNK 2026." },
    { tools: buildTools(), polish: false },
  );

  assert.equal(result.meta.intent, "playlist_recommendations");
  assert.equal(result.cards.length, 10);
  assert.match(result.text, /FUNK 2026/);
  assert.equal(result.actions[0].type, "add_to_playlist");
  assert.equal(result.actions[0].disabled, true);
});

test("propagates adaptive ranking metadata without enabling prepared actions", async () => {
  const tools = buildTools();
  const baselineRecommend = tools.recommendTracksForPlaylist;
  tools.recommendTracksForPlaylist = async (...args) => {
    const baseline = await baselineRecommend(...args);
    return {
      ...baseline,
      cards: baseline.cards.map((item, index) => ({
        ...item,
        ranking: {
          requestId: "request-1",
          modelVersion: "ltr-1",
          rank: index + 1,
          baseScore: item.opportunityScore,
          learnedScore: item.opportunityScore,
          reasonCodes: ["chart_strength"],
          propensity: 0.5,
        },
      })),
      ranking: {
        provider: "python",
        status: "ranked",
        requestId: "request-1",
        modelVersion: "ltr-1",
        personalized: true,
        coldStart: false,
      },
    };
  };

  const result = await runPlaylistsAiAgent(
    { message: "Me sugere 10 músicas para FUNK 2026." },
    { tools, polish: false },
  );

  assert.equal(result.meta.ranking.provider, "python");
  assert.equal(result.cards[0].ranking.requestId, "request-1");
  assert.equal(result.actions[0].disabled, true);
  assert.equal(result.meta.readOnly, true);
});

test("builds a read-only playlist idea from weekly risers", async () => {
  const result = await runPlaylistsAiAgent(
    {
      message:
        "Cria uma ideia de playlist baseada nas maiores subidas da semana.",
    },
    { tools: buildTools(), polish: false },
  );

  assert.equal(result.meta.intent, "playlist_idea");
  assert.equal(result.cards.length, 10);
  assert.equal(result.actions[0].type, "create_playlist");
  assert.equal(result.actions[0].disabled, true);
  assert.match(result.text, /Ideia:/);
});

test("uses the real playlist immediately instead of asking a generic questionnaire", async () => {
  let recommendationCalls = 0;
  const tools = buildTools();
  tools.recommendTracksForPlaylist = async (...args) => {
    recommendationCalls += 1;
    return buildTools().recommendTracksForPlaylist(...args);
  };

  const result = await runPlaylistsAiAgent(
    { message: "Quero melhorar a FUNK 2026." },
    { tools, polish: false },
  );

  assert.equal(result.meta.intent, "playlist_recommendations");
  assert.equal(result.meta.mode, "recommendation");
  assert.equal(result.cards.length, 10);
  assert.equal(result.brief.playlistName, "FUNK 2026");
  assert.match(result.text, /FUNK 2026/i);
  assert.equal(recommendationCalls, 1);
});

test("remembers the brief and recommends after the user supplies context", async () => {
  const tools = buildTools();
  const first = await runPlaylistsAiAgent(
    { message: "Quero melhorar a FUNK 2026." },
    { tools, polish: false },
  );
  const second = await runPlaylistsAiAgent(
    {
      message: "Quero crescimento no Brasil, com foco em descoberta.",
      messages: [
        { role: "user", content: "Quero melhorar a FUNK 2026." },
        { role: "assistant", content: first.text },
      ],
      brief: first.brief,
    },
    { tools, polish: false },
  );

  assert.equal(second.meta.intent, "playlist_recommendations");
  assert.equal(second.meta.mode, "recommendation");
  assert.equal(second.meta.contextComplete, true);
  assert.equal(second.brief.goal, "growth");
  assert.equal(second.brief.market, "BR");
  assert.equal(second.brief.strategy, "discovery");
  assert.equal(second.cards.length, 10);
});
