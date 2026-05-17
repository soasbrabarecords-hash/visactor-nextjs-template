import { NextResponse } from "next/server";
import {
  fetchSpotifyAccountPlaylists,
  setSpotifyAuthCookies,
  withSpotifyToken,
  type SpotifyOAuthTokenResponse,
} from "@/lib/spotify-user";
import { searchSpotifyTracks, type SpotifyTrackRecord } from "@/lib/spotify";
import { getSnapshotDates, getSnapshotWithComparison } from "@/lib/chart-snapshots";
import { fetchTikTokPublicChart } from "@/lib/tiktok-public-charts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  prompt?: unknown;
};

type TrackSource = "Spotify" | "TikTok" | "Catalogo" | "Curadoria";

type CandidateTrack = {
  key: string;
  title: string;
  artist: string;
  imageUrl: string | null;
  spotifyTrackId: string | null;
  spotifyUrl: string | null;
  source: TrackSource;
  score: number;
  popularity: number | null;
  chartPosition: number | null;
  chartMovement: "new" | "up" | "down" | "stable" | null;
  streams: number | null;
  tiktokRank: number | null;
  signals: string[];
};

type AgentSource = {
  title: string;
  url: string;
};

type PlaylistPlanTrack = {
  id: string;
  title: string;
  artist: string;
  imageUrl: string | null;
  source: TrackSource;
  energy: number;
  reason: string;
  chartPosition?: number;
  movement?: "new" | "up" | "down" | "stable";
  spotifyTrackId?: string | null;
  streams?: number | null;
};

type PlaylistPlan = {
  id: string;
  title: string;
  subtitle: string;
  targetSize: number;
  confidence: number;
  marketBlend: {
    spotify: number;
    tiktok: number;
    catalog: number;
  };
  strategy: string[];
  tracks: PlaylistPlanTrack[];
  nextSteps: string[];
  spotifyResolvedCount: number;
  chartResolvedCount: number;
  dataSource: "openai-agent" | "spotify-api" | "charts-fallback" | "local-fallback";
  researchSummary?: string;
  researchSources?: AgentSource[];
};

type SpotifyTopTracksResponse = {
  items?: Array<{
    id?: string;
    name?: string;
    popularity?: number;
    external_urls?: { spotify?: string };
    artists?: Array<{ name?: string }>;
    album?: {
      images?: Array<{ url?: string }>;
    };
  }>;
};

type OpenAIResponseObject = Record<string, unknown>;

const OPENAI_MODEL =
  process.env.OPENAI_PLAYLISTS_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5";

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateKey(title: string, artist: string) {
  return `${normalizeText(title)}::${normalizeText(artist)}`;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function compactStreams(streams: number | null) {
  if (!streams) return null;
  if (streams >= 1_000_000) return `${(streams / 1_000_000).toFixed(1)}M`;
  if (streams >= 1_000) return `${Math.round(streams / 1_000)}K`;
  return String(streams);
}

function inferMood(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("funk") || lower.includes("baile") || lower.includes("festa")) return "funk";
  if (lower.includes("romant") || lower.includes("love") || lower.includes("sofrencia")) return "romantica";
  if (lower.includes("treino") || lower.includes("academia") || lower.includes("corrida")) return "treino";
  if (lower.includes("pop")) return "pop";
  return "trap";
}

function getSpotifyQueries(prompt: string) {
  const mood = inferMood(prompt);
  const cleanPrompt = prompt
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
  const moodQuery = {
    funk: "funk brasil hits atuais 2026",
    romantica: "romanticas brasil pop sertanejo classicos",
    treino: "trap funk treino energia brasil",
    pop: "pop brasil viral hits atuais",
    trap: "trap brasil rap hits atuais 2026",
  }[mood];
  const viralQuery = /viral|tiktok|reels|shorts|bomb/i.test(prompt)
    ? "viral brasil tiktok reels shorts"
    : "spotify brasil top tracks";

  return Array.from(new Set([cleanPrompt, moodQuery, viralQuery].filter(Boolean))).slice(0, 4);
}

function getMovementBoost(status: CandidateTrack["chartMovement"]) {
  if (status === "new") return 18;
  if (status === "up") return 14;
  if (status === "stable") return 4;
  if (status === "down") return -8;
  return 0;
}

function addCandidate(
  map: Map<string, CandidateTrack>,
  input: Omit<CandidateTrack, "key">,
) {
  const key = input.spotifyTrackId ? `spotify:${input.spotifyTrackId}` : candidateKey(input.title, input.artist);
  const existing = map.get(key);

  if (!existing) {
    map.set(key, { ...input, key });
    return;
  }

  map.set(key, {
    ...existing,
    imageUrl: existing.imageUrl ?? input.imageUrl,
    spotifyTrackId: existing.spotifyTrackId ?? input.spotifyTrackId,
    spotifyUrl: existing.spotifyUrl ?? input.spotifyUrl,
    source: existing.source === "TikTok" ? existing.source : input.source,
    score: Math.max(existing.score, input.score) + 8,
    popularity: Math.max(existing.popularity ?? 0, input.popularity ?? 0) || null,
    chartPosition: existing.chartPosition ?? input.chartPosition,
    chartMovement: existing.chartMovement ?? input.chartMovement,
    streams: existing.streams ?? input.streams,
    tiktokRank: existing.tiktokRank ?? input.tiktokRank,
    signals: Array.from(new Set([...existing.signals, ...input.signals])).slice(0, 6),
  });
}

function spotifyRecordToCandidate(track: SpotifyTrackRecord, score: number, signal: string): Omit<CandidateTrack, "key"> {
  return {
    title: track.name,
    artist: track.artists.join(", "),
    imageUrl: track.coverUrl,
    spotifyTrackId: track.id,
    spotifyUrl: track.spotifyUrl,
    source: "Spotify",
    score: score + Math.round(track.popularity * 0.35),
    popularity: track.popularity,
    chartPosition: null,
    chartMovement: null,
    streams: null,
    tiktokRank: null,
    signals: [signal, `Spotify popularity ${track.popularity}/100`],
  };
}

async function getSpotifySearchCandidates(prompt: string) {
  const queries = getSpotifyQueries(prompt);
  const settled = await Promise.allSettled(
    queries.map(async (query) => ({
      query,
      tracks: await searchSpotifyTracks(query, "BR", 12),
    })),
  );
  const candidates = new Map<string, CandidateTrack>();

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const track of result.value.tracks) {
      addCandidate(candidates, spotifyRecordToCandidate(track, 58, `Busca Spotify: ${result.value.query}`));
    }
  }

  return Array.from(candidates.values());
}

async function getChartCandidates() {
  const dates = await getSnapshotDates("BR");
  const selectedDate = dates[0] ?? null;
  const snapshot = selectedDate ? await getSnapshotWithComparison(selectedDate, "BR") : null;

  return {
    selectedDate,
    tracks: (snapshot?.tracks ?? []).slice(0, 100).map((track): Omit<CandidateTrack, "key"> => {
      const streamLabel = compactStreams(track.streams);
      return {
        title: track.track_name,
        artist: track.artist_name ?? "Artista desconhecido",
        imageUrl: track.image_url,
        spotifyTrackId: track.spotify_track_id,
        spotifyUrl: track.spotify_track_id
          ? `https://open.spotify.com/track/${track.spotify_track_id}`
          : null,
        source: "Spotify",
        score:
          92 -
          Math.min(track.position, 100) * 0.32 +
          getMovementBoost(track.status),
        popularity: null,
        chartPosition: track.position,
        chartMovement: track.status,
        streams: track.streams,
        tiktokRank: null,
        signals: [
          `Spotify Charts BR #${track.position}`,
          track.status === "new" ? "entrada nova" : `movimento ${track.status}`,
          streamLabel ? `${streamLabel} streams` : "streams indisponiveis",
        ],
      };
    }),
  };
}

async function getTikTokCandidates() {
  const chart = await fetchTikTokPublicChart();

  return {
    snapshotDate: chart.snapshotDate,
    tracks: chart.tracks.slice(0, 80).map((track): Omit<CandidateTrack, "key"> => ({
      title: track.trackName,
      artist: track.artistName,
      imageUrl: track.coverUrl,
      spotifyTrackId: track.spotifyTrackId,
      spotifyUrl: track.spotifyUrl,
      source: "TikTok",
      score: 88 - Math.min(track.rank, 80) * 0.34 + (track.movementLabel === "NEW" ? 16 : track.movementLabel.startsWith("+") ? 10 : 0),
      popularity: null,
      chartPosition: null,
      chartMovement: null,
      streams: null,
      tiktokRank: track.rank,
      signals: [`TikTok BR #${track.rank}`, `movimento ${track.movementLabel}`],
    })),
  };
}

function mapTopItemToCandidate(
  item: NonNullable<SpotifyTopTracksResponse["items"]>[number],
  range: string,
): Omit<CandidateTrack, "key"> | null {
  if (!item.id || !item.name) return null;

  return {
    title: item.name,
    artist: (item.artists ?? []).map((artist) => artist.name).filter(Boolean).join(", "),
    imageUrl: item.album?.images?.[0]?.url ?? null,
    spotifyTrackId: item.id,
    spotifyUrl: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`,
    source: "Curadoria",
    score: 78 + Math.round((item.popularity ?? 0) * 0.18),
    popularity: item.popularity ?? null,
    chartPosition: null,
    chartMovement: null,
    streams: null,
    tiktokRank: null,
    signals: [`Top pessoal ${range}`, `Spotify popularity ${item.popularity ?? 0}/100`],
  };
}

async function getUserTopCandidates() {
  const ranges = ["short_term", "medium_term"] as const;
  const { data, refreshedToken } = await withSpotifyToken(async (token) => {
    const results: Omit<CandidateTrack, "key">[] = [];

    for (const range of ranges) {
      const url = new URL("https://api.spotify.com/v1/me/top/tracks");
      url.searchParams.set("time_range", range);
      url.searchParams.set("limit", "20");
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!response.ok) continue;

      const body = (await response.json()) as SpotifyTopTracksResponse;
      for (const item of body.items ?? []) {
        const candidate = mapTopItemToCandidate(item, range === "short_term" ? "4 semanas" : "6 meses");
        if (candidate) results.push(candidate);
      }
    }

    return results;
  });

  return { tracks: data, refreshedToken };
}

function mergeCandidates(groups: Array<Array<Omit<CandidateTrack, "key"> | CandidateTrack>>) {
  const map = new Map<string, CandidateTrack>();

  for (const group of groups) {
    for (const track of group) {
      const { key: _key, ...candidate } = track as CandidateTrack;
      void _key;
      addCandidate(map, candidate);
    }
  }

  return Array.from(map.values()).sort((left, right) => right.score - left.score);
}

function candidateForPrompt(candidate: CandidateTrack) {
  return {
    id: candidate.spotifyTrackId ?? candidate.key,
    title: candidate.title,
    artist: candidate.artist,
    spotifyTrackId: candidate.spotifyTrackId,
    source: candidate.source,
    score: Math.round(candidate.score),
    popularity: candidate.popularity,
    spotifyChart: candidate.chartPosition,
    tiktokRank: candidate.tiktokRank,
    signals: candidate.signals,
  };
}

function buildOpenAIInput({
  prompt,
  candidates,
  playlistNames,
  chartDate,
  tiktokDate,
}: {
  prompt: string;
  candidates: CandidateTrack[];
  playlistNames: string[];
  chartDate: string | null;
  tiktokDate: string | null;
}) {
  return `Voce e um curador musical profissional para playlists brasileiras.
Objetivo: responder ao pedido do usuario montando uma playlist util, pesquisada e pronta para revisar/criar no Spotify.

Pedido do usuario:
${prompt}

Dados internos disponiveis:
- Spotify Charts BR snapshot: ${chartDate ?? "indisponivel"}
- TikTok/Kworb BR snapshot: ${tiktokDate ?? "indisponivel"}
- Playlists da conta conectada: ${playlistNames.length > 0 ? playlistNames.slice(0, 18).join(", ") : "indisponiveis"}
- Candidatas resolvidas por Spotify API, charts e perfil:
${JSON.stringify(candidates.slice(0, 70).map(candidateForPrompt))}

Use web_search para pesquisar sinais atuais quando isso ajudar: TikTok, Reels, Shorts, Spotify viral, musicas em alta e contexto de mercado.
Regras:
- Priorize faixas da lista de candidatas quando for criar tracks, porque elas tem ID oficial do Spotify.
- Nao invente spotifyTrackId. Use apenas IDs fornecidos nas candidatas.
- Pode incluir classicos/catalogo se o usuario pedir, mas explique quando nao houver ID.
- Monte 10 a 14 faixas, ordenadas com logica editorial.
- Responda somente JSON valido, sem markdown.

Formato obrigatorio:
{
  "title": "nome curto da playlist",
  "subtitle": "resumo do pedido",
  "targetSize": 50,
  "confidence": 0,
  "marketBlend": { "spotify": 0, "tiktok": 0, "catalog": 0 },
  "researchSummary": "resumo curto da pesquisa e da tese curatorial",
  "strategy": ["passo editorial"],
  "tracks": [
    {
      "title": "musica",
      "artist": "artista",
      "spotifyTrackId": "id ou null",
      "source": "Spotify ou TikTok ou Catalogo ou Curadoria",
      "energy": 0,
      "reason": "por que entrou"
    }
  ],
  "nextSteps": ["proximo passo"],
  "researchSources": [{ "title": "fonte", "url": "https://..." }]
}`;
}

function extractOpenAIText(response: OpenAIResponseObject) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const texts: string[] = [];

  function visit(value: unknown) {
    if (typeof value === "string") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = asRecord(value);
    if (!record) return;

    if (record.type === "output_text" && typeof record.text === "string") {
      texts.push(record.text);
    }

    Object.values(record).forEach(visit);
  }

  visit(response.output);
  return texts.join("\n").trim();
}

function parseJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Resposta da IA sem JSON valido.");
  }

  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function collectOpenAISources(response: OpenAIResponseObject) {
  const sources = new Map<string, AgentSource>();

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = asRecord(value);
    if (!record) return;

    const url = typeof record.url === "string" ? record.url : null;
    if (url?.startsWith("http")) {
      const title =
        typeof record.title === "string"
          ? record.title
          : typeof record.name === "string"
            ? record.name
            : new URL(url).hostname;
      sources.set(url, { title, url });
    }

    Object.values(record).forEach(visit);
  }

  visit(response);
  return Array.from(sources.values()).slice(0, 8);
}

async function runOpenAICurator(input: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: "low" },
      tools: [
        {
          type: "web_search",
          search_context_size: "medium",
          user_location: {
            type: "approximate",
            country: "BR",
            city: "Sao Paulo",
            region: "Sao Paulo",
          },
        },
      ],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      input,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `OpenAI error ${response.status}`);
  }

  const body = (await response.json()) as OpenAIResponseObject;
  return {
    json: parseJsonObject(extractOpenAIText(body)),
    sources: collectOpenAISources(body),
  };
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number, min = 0, max = 100) {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(Math.round(value), min, max)
    : fallback;
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return items.length > 0 ? items.slice(0, 6) : fallback;
}

function asSources(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): AgentSource[] => {
    const record = asRecord(item);
    if (!record) return [];
    const url = typeof record.url === "string" ? record.url : "";
    if (!url.startsWith("http")) return [];
    return [
      {
        title: asString(record.title, new URL(url).hostname),
        url,
      },
    ];
  });
}

function validSource(value: unknown, fallback: TrackSource): TrackSource {
  return value === "Spotify" || value === "TikTok" || value === "Catalogo" || value === "Curadoria"
    ? value
    : fallback;
}

function findCandidateForTrack(track: Record<string, unknown>, candidates: CandidateTrack[]) {
  const spotifyTrackId = typeof track.spotifyTrackId === "string" ? track.spotifyTrackId : null;
  if (spotifyTrackId) {
    const byId = candidates.find((candidate) => candidate.spotifyTrackId === spotifyTrackId);
    if (byId) return byId;
  }

  const title = typeof track.title === "string" ? track.title : "";
  const artist = typeof track.artist === "string" ? track.artist : "";
  const key = candidateKey(title, artist);

  return candidates.find((candidate) => candidateKey(candidate.title, candidate.artist) === key) ?? null;
}

function candidateToPlanTrack(candidate: CandidateTrack, index: number): PlaylistPlanTrack {
  const streamLabel = compactStreams(candidate.streams);
  const reason = [
    candidate.signals[0] ?? "Sinal de curadoria",
    candidate.tiktokRank ? `TikTok #${candidate.tiktokRank}` : null,
    candidate.chartPosition ? `Spotify Chart #${candidate.chartPosition}` : null,
    streamLabel ? `${streamLabel} streams` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    id: `agent-track-${index}-${candidate.spotifyTrackId ?? candidate.key}`,
    title: candidate.title,
    artist: candidate.artist,
    imageUrl: candidate.imageUrl,
    source: candidate.source,
    energy: clamp(Math.round(62 + candidate.score * 0.28), 35, 98),
    reason,
    chartPosition: candidate.chartPosition ?? undefined,
    movement: candidate.chartMovement ?? undefined,
    spotifyTrackId: candidate.spotifyTrackId,
    streams: candidate.streams,
  };
}

function modelTrackToPlanTrack(
  track: Record<string, unknown>,
  candidate: CandidateTrack | null,
  index: number,
): PlaylistPlanTrack {
  const fallback = candidate ? candidateToPlanTrack(candidate, index) : null;
  const title = asString(track.title, fallback?.title ?? "Faixa sugerida");
  const artist = asString(track.artist, fallback?.artist ?? "Artista");

  return {
    id: `agent-track-${index}-${candidate?.spotifyTrackId ?? normalizeText(`${title}-${artist}`)}`,
    title,
    artist,
    imageUrl: fallback?.imageUrl ?? null,
    source: validSource(track.source, fallback?.source ?? "Curadoria"),
    energy: asNumber(track.energy, fallback?.energy ?? 72, 30, 100),
    reason: asString(track.reason, fallback?.reason ?? "Escolha feita pela leitura cruzada da IA."),
    chartPosition: fallback?.chartPosition,
    movement: fallback?.movement,
    spotifyTrackId: candidate?.spotifyTrackId ?? null,
    streams: fallback?.streams ?? null,
  };
}

function normalizeBlend(value: unknown) {
  const record = asRecord(value);
  const spotify = asNumber(record?.spotify, 62);
  const tiktok = asNumber(record?.tiktok, 24);
  const catalog = asNumber(record?.catalog, 100 - spotify - tiktok);
  const total = spotify + tiktok + catalog;

  if (total === 100) return { spotify, tiktok, catalog };
  if (total <= 0) return { spotify: 62, tiktok: 24, catalog: 14 };

  const normalizedSpotify = Math.round((spotify / total) * 100);
  const normalizedTiktok = Math.round((tiktok / total) * 100);

  return {
    spotify: normalizedSpotify,
    tiktok: normalizedTiktok,
    catalog: 100 - normalizedSpotify - normalizedTiktok,
  };
}

function buildFallbackPlan(prompt: string, candidates: CandidateTrack[], reason: string): PlaylistPlan {
  const selected = candidates.slice(0, 12);
  const tracks = selected.map(candidateToPlanTrack);

  return {
    id: newId("plan"),
    title: inferMood(prompt) === "funk" ? "Baile Radar IA" : "Radar Playlist IA",
    subtitle: prompt,
    targetSize: 60,
    confidence: selected.length > 0 ? 84 : 62,
    marketBlend: { spotify: 62, tiktok: 24, catalog: 14 },
    strategy: [
      "Cruzar Spotify API, charts internos e TikTok/Kworb antes de sugerir a ordem.",
      "Priorizar faixas com ID oficial do Spotify para permitir criacao direta.",
      "Usar fallback local quando a pesquisa externa nao estiver disponivel.",
    ],
    tracks,
    nextSteps: [
      "Revisar as faixas sugeridas antes de criar no Spotify.",
      "Configurar OPENAI_API_KEY para ativar pesquisa ampla com ChatGPT.",
      "Salvar a playlist como privada e ajustar no editor do sistema.",
    ],
    spotifyResolvedCount: tracks.filter((track) => Boolean(track.spotifyTrackId)).length,
    chartResolvedCount: tracks.filter((track) => Boolean(track.chartPosition)).length,
    dataSource: "spotify-api",
    researchSummary: reason,
    researchSources: [],
  };
}

function buildModelPlan({
  prompt,
  modelJson,
  candidates,
  sources,
}: {
  prompt: string;
  modelJson: Record<string, unknown>;
  candidates: CandidateTrack[];
  sources: AgentSource[];
}): PlaylistPlan {
  const modelTracks = Array.isArray(modelJson.tracks) ? modelJson.tracks : [];
  const usedKeys = new Set<string>();
  const tracks = modelTracks
    .flatMap((item, index): PlaylistPlanTrack[] => {
      const record = asRecord(item);
      if (!record) return [];
      const candidate = findCandidateForTrack(record, candidates);
      if (candidate?.key && usedKeys.has(candidate.key)) return [];
      if (candidate?.key) usedKeys.add(candidate.key);
      return [modelTrackToPlanTrack(record, candidate, index)];
    })
    .filter((track) => track.title && track.artist)
    .slice(0, 14);

  for (const candidate of candidates) {
    if (tracks.length >= 12) break;
    if (usedKeys.has(candidate.key)) continue;
    usedKeys.add(candidate.key);
    tracks.push(candidateToPlanTrack(candidate, tracks.length));
  }

  const modelSources = asSources(modelJson.researchSources);
  const researchSources = Array.from(
    new Map([...modelSources, ...sources].map((source) => [source.url, source])).values(),
  ).slice(0, 8);

  return {
    id: newId("plan"),
    title: asString(modelJson.title, "Playlist IA"),
    subtitle: asString(modelJson.subtitle, prompt),
    targetSize: asNumber(modelJson.targetSize, 60, 10, 120),
    confidence: asNumber(modelJson.confidence, 91, 0, 100),
    marketBlend: normalizeBlend(modelJson.marketBlend),
    strategy: asStringArray(modelJson.strategy, [
      "Pesquisar sinais atuais na web e cruzar com dados internos.",
      "Usar Spotify API para resolver IDs oficiais antes de criar.",
      "Balancear hype, retencao e identidade da playlist.",
    ]),
    tracks,
    nextSteps: asStringArray(modelJson.nextSteps, [
      "Revisar a lista e criar como playlist privada.",
      "Ajustar ordem no editor do sistema.",
      "Monitorar desempenho na proxima importacao de charts.",
    ]),
    spotifyResolvedCount: tracks.filter((track) => Boolean(track.spotifyTrackId)).length,
    chartResolvedCount: tracks.filter((track) => Boolean(track.chartPosition)).length,
    dataSource: "openai-agent",
    researchSummary: asString(
      modelJson.researchSummary,
      "Pesquisa ampla combinada com Spotify API, charts internos e sinais sociais.",
    ),
    researchSources,
  };
}

export async function POST(request: Request) {
  let refreshedToken: SpotifyOAuthTokenResponse | null = null;

  try {
    const body = (await request.json()) as ChatBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ message: "prompt e obrigatorio." }, { status: 400 });
    }

    const [
      spotifySearchResult,
      chartResult,
      tiktokResult,
      accountPlaylistsResult,
      userTopResult,
    ] = await Promise.allSettled([
      getSpotifySearchCandidates(prompt),
      getChartCandidates(),
      getTikTokCandidates(),
      fetchSpotifyAccountPlaylists(),
      getUserTopCandidates(),
    ]);

    const spotifySearchTracks =
      spotifySearchResult.status === "fulfilled" ? spotifySearchResult.value : [];
    const chartTracks =
      chartResult.status === "fulfilled" ? chartResult.value.tracks : [];
    const chartDate =
      chartResult.status === "fulfilled" ? chartResult.value.selectedDate : null;
    const tiktokTracks =
      tiktokResult.status === "fulfilled" ? tiktokResult.value.tracks : [];
    const tiktokDate =
      tiktokResult.status === "fulfilled" ? tiktokResult.value.snapshotDate : null;
    const accountPlaylists =
      accountPlaylistsResult.status === "fulfilled" && accountPlaylistsResult.value.result.connected
        ? accountPlaylistsResult.value.result.playlists
        : [];
    const userTopTracks =
      userTopResult.status === "fulfilled" ? userTopResult.value.tracks : [];

    if (accountPlaylistsResult.status === "fulfilled") {
      refreshedToken = accountPlaylistsResult.value.refreshedToken ?? refreshedToken;
    }

    if (userTopResult.status === "fulfilled") {
      refreshedToken = userTopResult.value.refreshedToken ?? refreshedToken;
    }

    const candidates = mergeCandidates([
      spotifySearchTracks,
      chartTracks,
      tiktokTracks,
      userTopTracks,
    ]);

    let plan: PlaylistPlan;
    let mode: "openai-agent" | "fallback";
    let message: string;

    try {
      const aiResult = await runOpenAICurator(
        buildOpenAIInput({
          prompt,
          candidates,
          playlistNames: accountPlaylists.map((playlist) => playlist.name),
          chartDate,
          tiktokDate,
        }),
      );

      if (aiResult) {
        plan = buildModelPlan({
          prompt,
          modelJson: aiResult.json,
          candidates,
          sources: aiResult.sources,
        });
        mode = "openai-agent";
        message =
          "Pesquisei com ChatGPT, cruzei Spotify API, charts internos, TikTok/Kworb e teu contexto de conta.";
      } else {
        plan = buildFallbackPlan(
          prompt,
          candidates,
          "OPENAI_API_KEY ainda nao configurada. Usei ranking interno com Spotify API, charts e TikTok/Kworb.",
        );
        mode = "fallback";
        message =
          "Montei com ranking interno. Para pesquisa ampla com ChatGPT, configure OPENAI_API_KEY.";
      }
    } catch (error) {
      plan = buildFallbackPlan(
        prompt,
        candidates,
        error instanceof Error
          ? `OpenAI indisponivel agora: ${error.message}`
          : "OpenAI indisponivel agora.",
      );
      mode = "fallback";
      message =
        "A pesquisa com ChatGPT falhou agora, entao usei o ranking interno para nao travar o fluxo.";
    }

    const response = NextResponse.json({ message, mode, plan });
    if (refreshedToken) setSpotifyAuthCookies(response, refreshedToken);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro ao conversar com Playlists IA.",
      },
      { status: 500 },
    );
  }
}
