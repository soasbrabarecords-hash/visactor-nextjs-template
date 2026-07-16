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

test("does not mistake a historical window for the requested track count", () => {
  const intent = classifyPlaylistAiIntent(
    "Quais faixas de trap mais tocaram nos últimos 30 dias?",
  );

  assert.equal(intent.windowDays, 30);
  assert.equal(intent.limit, 10);
  assert.equal(intent.targetSize, 50);
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
