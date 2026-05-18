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
import { getEffectiveOpenAICredentials } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  prompt?: unknown;
  messages?: unknown;
};

type TrackSource = "Spotify" | "TikTok" | "Catalogo" | "Curadoria";

type ConversationMessage = {
  role: "assistant" | "user";
  content: string;
};

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

const PLAYLIST_AI_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "playlist_ai_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      action: {
        type: "string",
        enum: ["clarifying_question", "playlist_brief", "playlist_plan"],
      },
      message: { type: "string" },
      questions: {
        type: "array",
        items: { type: "string" },
      },
      title: { type: "string" },
      subtitle: { type: "string" },
      targetSize: { type: "number" },
      confidence: { type: "number" },
      marketBlend: {
        type: "object",
        additionalProperties: false,
        properties: {
          spotify: { type: "number" },
          tiktok: { type: "number" },
          catalog: { type: "number" },
        },
        required: ["spotify", "tiktok", "catalog"],
      },
      researchSummary: { type: "string" },
      strategy: {
        type: "array",
        items: { type: "string" },
      },
      tracks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            artist: { type: "string" },
            spotifyTrackId: { type: ["string", "null"] },
            source: {
              type: "string",
              enum: ["Spotify", "TikTok", "Catalogo", "Curadoria"],
            },
            energy: { type: "number" },
            reason: { type: "string" },
          },
          required: [
            "title",
            "artist",
            "spotifyTrackId",
            "source",
            "energy",
            "reason",
          ],
        },
      },
      nextSteps: {
        type: "array",
        items: { type: "string" },
      },
      researchSources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            url: { type: "string" },
          },
          required: ["title", "url"],
        },
      },
    },
    required: [
      "action",
      "message",
      "questions",
      "title",
      "subtitle",
      "targetSize",
      "confidence",
      "marketBlend",
      "researchSummary",
      "strategy",
      "tracks",
      "nextSteps",
      "researchSources",
    ],
  },
} as const;

type CuratorIntent =
  | {
      action: "clarifying_question";
      message: string;
      questions: string[];
    }
  | {
      action: "playlist_brief";
      message: string;
      questions: string[];
    }
  | {
      action: "playlist_plan";
      plan: PlaylistPlan;
    };

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseConversationMessages(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((item): ConversationMessage[] => {
      const record = asRecord(item);
      if (!record) return [];
      const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
      const content = typeof record.content === "string" ? record.content.trim() : "";
      if (!role || !content) return [];
      return [{ role, content: content.slice(0, 1000) }];
    })
    .slice(-10);
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

function buildClarifyingQuestions(prompt: string, conversation: ConversationMessage[]) {
  const context = normalizeText(
    [prompt, ...conversation.map((message) => message.content)].join(" "),
  );
  const questions: string[] = [];

  const hasGenre =
    /\b(funk|trap|rap|pop|sertanejo|pagode|eletronica|phonk|indie|rock|reggaeton|afro|r b|rnb)\b/.test(context);
  const hasUseCase =
    /\b(festa|treino|academia|churrasco|carro|loja|bar|viagem|romantica|sofrencia|viral|balada|estudo|relax)\b/.test(context);
  const hasEnergy =
    /\b(leve|pesada|alto astral|energia|calma|agressiva|melodica|dançante|dancante|noturna|pique|bpm)\b/.test(context);
  const hasEra =
    /\b(atual|novo|novidade|2026|2025|classico|anos|2000|2010|antigo|nostalgia)\b/.test(context);

  if (!hasGenre) {
    questions.push("Qual genero ou mistura manda: funk, trap, pop, sertanejo, pagode, eletronica ou outro?");
  }

  if (!hasUseCase) {
    questions.push("Essa playlist e para qual momento: festa, treino, carro, bar, romance, discovery ou viral?");
  }

  if (!hasEnergy) {
    questions.push("A energia deve ser mais pesada, dançante, melodica, calma ou crescente?");
  }

  if (!hasEra && questions.length < 3) {
    questions.push("Quer foco em lancamentos atuais, virais da semana ou mistura com classicos?");
  }

  return questions.slice(0, 3);
}

function shouldAskForMoreContext(prompt: string, conversation: ConversationMessage[]) {
  const normalized = normalizeText(prompt);
  const hasPriorBrief = hasPriorPlaylistBrief(conversation);
  const confirmedBrief = hasPriorBrief && isPlaylistGenerationConfirmation(prompt);

  if (confirmedBrief) return false;

  const hasPriorAssistantQuestion = conversation.some(
    (message) =>
      message.role === "assistant" &&
      normalizeText(message.content).includes("pra eu acertar a vibe"),
  );

  if (hasPriorAssistantQuestion) return false;
  if (normalized.length < 18) return true;

  const signals = [
    /\b(funk|trap|rap|pop|sertanejo|pagode|eletronica|phonk|rock|reggaeton|afro|rnb)\b/,
    /\b(festa|treino|academia|carro|bar|romantica|viral|balada|discovery|churrasco)\b/,
    /\b(atual|novo|2026|2025|classico|anos|viral|reels|tiktok|shorts)\b/,
    /\b(pesada|leve|calma|energia|melodica|dancante|noturna|alto astral)\b/,
  ].filter((pattern) => pattern.test(normalized)).length;

  return signals < 2 && normalized.split(" ").length < 10;
}

function hasPriorPlaylistBrief(conversation: ConversationMessage[]) {
  return conversation.some((message) => {
    if (message.role !== "assistant") return false;
    const content = normalizeText(message.content);
    return content.includes("brief da playlist") || content.includes("brand da playlist");
  });
}

function isPlaylistGenerationConfirmation(prompt: string) {
  const normalized = normalizeText(prompt);
  if (!normalized) return false;

  const revisionSignals = /\b(nao|muda|ajusta|troca|sem|menos|mais|porem|mas|antes|prefiro)\b/;
  if (revisionSignals.test(normalized)) return false;

  return /\b(confirmo|confirmado|pode gerar|pode criar|pode mandar|gera|gerar|cria|criar|manda|fechado|fechou|bora|segue|sim|ok|okay|isso|ta bom|esta bom|ta certo|esta certo|perfeito)\b/.test(
    normalized,
  );
}

function inferBriefValue(
  context: string,
  matches: Array<[RegExp, string]>,
  fallback: string,
) {
  return matches.find(([pattern]) => pattern.test(context))?.[1] ?? fallback;
}

function buildPlaylistBriefResponse(prompt: string, conversation: ConversationMessage[]) {
  const context = normalizeText(
    [...conversation.map((message) => message.content), prompt].join(" "),
  );
  const lastUserContext = [
    ...conversation.filter((message) => message.role === "user").map((message) => message.content),
    prompt,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const genre = inferBriefValue(
    context,
    [
      [/\bfunk|baile|mandela\b/, "funk/baile com leitura viral"],
      [/\btrap|rap|plug|drill\b/, "trap/rap BR moderno"],
      [/\bsertanejo|sofrencia\b/, "sertanejo/pop romantico"],
      [/\bpagode|samba\b/, "pagode/samba popular"],
      [/\bpop\b/, "pop brasileiro atual"],
      [/\beletronica|house|edm|phonk\b/, "eletronica/club"],
    ],
    "hits brasileiros com curadoria de demanda real",
  );
  const useCase = inferBriefValue(
    context,
    [
      [/\bfesta|balada|baile|churrasco\b/, "festa e descoberta rapida"],
      [/\btreino|academia|corrida\b/, "treino sem queda de energia"],
      [/\bcarro|viagem|estrada\b/, "carro/viagem com alto replay"],
      [/\bbar|loja|ambiente\b/, "ambiente comercial com skip baixo"],
      [/\bromantica|romance|love|sofrencia\b/, "clima afetivo e cantavel"],
      [/\bviral|tiktok|reels|shorts\b/, "radar viral para crescimento"],
    ],
    "playlist editorial para crescer no Spotify",
  );
  const energy = inferBriefValue(
    context,
    [
      [/\bpesada|agressiva|energia alta|pique|explodir\b/, "alta, direta e com picos fortes"],
      [/\bdancante|dançante|festa|baile\b/, "dancante, quente e facil de entrar"],
      [/\bcalma|leve|relax|melodica\b/, "mais leve, melodica e sustentada"],
      [/\bcrescente|subindo|progressiva\b/, "crescente, com blocos bem marcados"],
    ],
    "media-alta, com abertura forte e meio consistente",
  );
  const era = inferBriefValue(
    context,
    [
      [/\bclassico|antigo|nostalgia|2000|2010|anos\b/, "mistura de catalogo forte com faixas atuais"],
      [/\batual|novo|novidade|2026|2025|viral|reels|tiktok|shorts\b/, "foco em sinais atuais e virais"],
    ],
    "atual, mas sem ignorar catalogo quando fizer sentido",
  );
  const size = inferBriefValue(
    context,
    [
      [/\b(100|cem)\b/, "100 faixas"],
      [/\b(80|oitenta)\b/, "80 faixas"],
      [/\b(60|sessenta)\b/, "60 faixas"],
      [/\b(50|cinquenta)\b/, "50 faixas"],
      [/\b(30|trinta)\b/, "30 faixas"],
    ],
    "50 a 60 faixas",
  );

  const questions = [
    "Se esse brief estiver certo, responde: confirmo, pode gerar.",
    "Se quiser ajustar, manda o ajuste em uma frase.",
  ];
  const message = [
    "Brief da playlist",
    `Brand: ${genre}.`,
    `Uso: ${useCase}.`,
    `Energia: ${energy}.`,
    `Recorte: ${era}.`,
    `Tamanho alvo: ${size}.`,
    "Pesquisa apos confirmar: TikTok, Reels, Shorts, Spotify/Viral charts, noticias musicais e dados internos do sistema.",
    lastUserContext ? `Base do pedido: ${lastUserContext.slice(0, 220)}${lastUserContext.length > 220 ? "..." : ""}` : null,
    "",
    ...questions,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    action: "playlist_brief" as const,
    message,
    questions,
  };
}

function buildPlanningPrompt(prompt: string, conversation: ConversationMessage[]) {
  const context = conversation
    .map((message) => `${message.role === "user" ? "Usuario" : "Assistente"}: ${message.content}`)
    .join("\n")
    .slice(-5000);

  return [context, `Confirmacao do usuario: ${prompt}`].filter(Boolean).join("\n\n");
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
  conversation,
  candidates,
  playlistNames,
  chartDate,
  tiktokDate,
}: {
  prompt: string;
  conversation: ConversationMessage[];
  candidates: CandidateTrack[];
  playlistNames: string[];
  chartDate: string | null;
  tiktokDate: string | null;
}) {
  const researchQueries = [
    `musicas bombando TikTok Brasil ${prompt}`,
    `musicas em alta Instagram Reels Brasil ${prompt}`,
    `musicas virais YouTube Shorts Brasil ${prompt}`,
    `Spotify Viral Brasil musicas em alta ${prompt}`,
    `noticias musica brasileira viral hit ${prompt}`,
  ];

  return `Voce e um agente de pesquisa e curadoria musical profissional para playlists brasileiras.
Objetivo: conversar com o usuario ate entender a vibe real e, so entao, montar uma playlist pesquisada e pronta para revisar/criar no Spotify.

Pedido do usuario:
${prompt}

Historico recente da conversa:
${conversation.length > 0 ? JSON.stringify(conversation) : "[]"}

Dados internos disponiveis:
- Spotify Charts BR snapshot: ${chartDate ?? "indisponivel"}
- TikTok/Kworb BR snapshot: ${tiktokDate ?? "indisponivel"}
- Playlists da conta conectada: ${playlistNames.length > 0 ? playlistNames.slice(0, 18).join(", ") : "indisponiveis"}
- Candidatas resolvidas por Spotify API, charts e perfil:
${JSON.stringify(candidates.slice(0, 70).map(candidateForPrompt))}

Pesquisa externa obrigatoria quando for montar playlist:
- Use web_search para buscar sinais atuais em pelo menos 4 frentes: TikTok, Instagram Reels, YouTube Shorts, Spotify/Viral charts e noticias/sites musicais.
- Consultas sugeridas:
${researchQueries.map((query) => `  - ${query}`).join("\n")}
- Dê preferencia a fontes confiaveis e/ou verificaveis: charts, plataformas, paginas oficiais, veiculos de musica/entretenimento, rankings publicos e agregadores reconheciveis.
- Nao dependa apenas dos dados internos. Use dados internos para resolver IDs do Spotify e dados externos para confirmar hype/momentum.
- Trabalhe como diretor de playlist: defina uma tese editorial, escolha ancoras populares, adicione apostas com sinal real e organize a ordem para reduzir skip.
- Nao selecione faixa apenas porque e famosa. Cada faixa precisa ter fit com brand, momento de uso, energia, recorte e algum sinal de demanda.
- Se uma faixa vier de pesquisa externa e nao estiver nas candidatas internas, inclua title/artist e spotifyTrackId null. O sistema tentara resolver na Spotify API depois.
- Se uma fonte externa nao confirmar um ranking exato, nao invente posicao. Cite o sinal de forma honesta: tendencia social, cobertura, chart publico, artista aquecido ou fit editorial.

Regra de conversa:
- Esta chamada so deve acontecer depois que o usuario confirmou o brief/brand da playlist.
- Se mesmo assim faltar algum ponto critico para nao inventar, NAO monte playlist ainda. Faça 2 ou 3 perguntas diretas.
- Se houver brief confirmado no historico, monte a playlist final com pesquisa profunda.

Regras:
- Priorize faixas da lista de candidatas quando for criar tracks, porque elas tem ID oficial do Spotify.
- Nao invente spotifyTrackId. Use apenas IDs fornecidos nas candidatas.
- Pode incluir classicos/catalogo se o usuario pedir, mas explique quando nao houver ID.
- Monte 10 a 14 faixas, ordenadas com logica editorial.
- Cada reason deve citar sinais concretos: TikTok/Reels/Shorts/Spotify chart/noticia/perfil da conta, quando houver.
- Responda somente JSON valido, sem markdown.
- O JSON precisa seguir o schema definido pela API. Mesmo quando action nao for playlist_plan, preencha os campos de playlist com valores neutros: strings vazias, numeros 0 e arrays vazios.

Formato obrigatorio se precisar perguntar:
{
  "action": "clarifying_question",
  "message": "Pra eu acertar a vibe real antes de criar...",
  "questions": ["pergunta curta"],
  "title": "",
  "subtitle": "",
  "targetSize": 0,
  "confidence": 0,
  "marketBlend": { "spotify": 0, "tiktok": 0, "catalog": 0 },
  "researchSummary": "",
  "strategy": [],
  "tracks": [],
  "nextSteps": [],
  "researchSources": []
}

Formato reservado para etapa anterior, se for necessario devolver brief:
{
  "action": "playlist_brief",
  "message": "Brief da playlist...",
  "questions": ["confirmar ou ajustar"],
  "title": "",
  "subtitle": "",
  "targetSize": 0,
  "confidence": 0,
  "marketBlend": { "spotify": 0, "tiktok": 0, "catalog": 0 },
  "researchSummary": "",
  "strategy": [],
  "tracks": [],
  "nextSteps": [],
  "researchSources": []
}

Formato obrigatorio se for montar playlist:
{
  "action": "playlist_plan",
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
  const credentials = await getEffectiveOpenAICredentials();
  if (!credentials) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: credentials.model,
      reasoning: { effort: "high" },
      text: {
        format: PLAYLIST_AI_RESPONSE_FORMAT,
      },
      tools: [
        {
          type: "web_search",
          search_context_size: "high",
          user_location: {
            type: "approximate",
            country: "BR",
            city: "Sao Paulo",
            region: "Sao Paulo",
          },
        },
      ],
      tool_choice: "required",
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
    model: credentials.model,
    source: credentials.source,
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

function getModelTrackRequests(modelJson: Record<string, unknown>) {
  if (!Array.isArray(modelJson.tracks)) return [];

  const seen = new Set<string>();

  return modelJson.tracks.flatMap((item): Array<{ title: string; artist: string }> => {
    const record = asRecord(item);
    if (!record) return [];
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const artist = typeof record.artist === "string" ? record.artist.trim() : "";
    const key = candidateKey(title, artist);

    if (!title || !artist || seen.has(key)) return [];
    seen.add(key);
    return [{ title, artist }];
  });
}

async function resolveModelTracksWithSpotify(modelJson: Record<string, unknown>) {
  const requests = getModelTrackRequests(modelJson).slice(0, 16);
  const settled = await Promise.allSettled(
    requests.map(async (request) => {
      const tracks = await searchSpotifyTracks(
        `track:${request.title} artist:${request.artist}`,
        "BR",
        5,
      );
      const requestKey = candidateKey(request.title, request.artist);
      const bestMatch =
        tracks
          .map((track) => ({
            track,
            score:
              (candidateKey(track.name, track.artists.join(" ")) === requestKey ? 20 : 0) +
              (normalizeText(track.name).includes(normalizeText(request.title)) ? 8 : 0) +
              (normalizeText(track.artists.join(" ")).includes(normalizeText(request.artist)) ? 8 : 0) +
              Math.round(track.popularity / 20),
          }))
          .sort((left, right) => right.score - left.score)[0]?.track ?? null;

      return bestMatch
        ? spotifyRecordToCandidate(
            bestMatch,
            74,
            "Resolvida na Spotify API depois da pesquisa externa",
          )
        : null;
    }),
  );

  return settled.flatMap((result): Array<Omit<CandidateTrack, "key">> => {
    if (result.status !== "fulfilled" || !result.value) return [];
    return [result.value];
  });
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
      "Configurar ChatGPT em Configuracoes para ativar pesquisa ampla.",
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

function buildClarifyingResponse(prompt: string, conversation: ConversationMessage[]) {
  const questions = buildClarifyingQuestions(prompt, conversation);
  const message = [
    "Pra eu acertar a vibe real antes de criar, me responde rapidinho:",
    ...questions.map((question, index) => `${index + 1}. ${question}`),
  ].join("\n");

  return {
    action: "clarifying_question" as const,
    message,
    questions,
  };
}

function parseCuratorIntent(
  prompt: string,
  modelJson: Record<string, unknown>,
  candidates: CandidateTrack[],
  sources: AgentSource[],
): CuratorIntent {
  if (modelJson.action === "clarifying_question") {
    const questions = Array.isArray(modelJson.questions)
      ? modelJson.questions
          .map((question) => (typeof question === "string" ? question.trim() : ""))
          .filter(Boolean)
          .slice(0, 3)
      : [];
    const message = asString(
      modelJson.message,
      [
        "Pra eu acertar a vibe real antes de criar, me responde rapidinho:",
        ...questions.map((question, index) => `${index + 1}. ${question}`),
      ].join("\n"),
    );

    return {
      action: "clarifying_question",
      message,
      questions,
    };
  }

  if (modelJson.action === "playlist_brief") {
    const questions = Array.isArray(modelJson.questions)
      ? modelJson.questions
          .map((question) => (typeof question === "string" ? question.trim() : ""))
          .filter(Boolean)
          .slice(0, 3)
      : ["Confirma o brief ou quer ajustar algum ponto?"];
    const message = asString(
      modelJson.message,
      buildPlaylistBriefResponse(prompt, []).message,
    );

    return {
      action: "playlist_brief",
      message,
      questions,
    };
  }

  return {
    action: "playlist_plan",
    plan: buildModelPlan({
      prompt,
      modelJson,
      candidates,
      sources,
    }),
  };
}

export async function POST(request: Request) {
  let refreshedToken: SpotifyOAuthTokenResponse | null = null;

  try {
    const body = (await request.json()) as ChatBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const conversation = parseConversationMessages(body.messages);

    if (!prompt) {
      return NextResponse.json({ message: "prompt e obrigatorio." }, { status: 400 });
    }

    const hasBrief = hasPriorPlaylistBrief(conversation);
    const confirmedBrief = hasBrief && isPlaylistGenerationConfirmation(prompt);
    const planningPrompt = confirmedBrief ? buildPlanningPrompt(prompt, conversation) : prompt;

    if (!confirmedBrief && shouldAskForMoreContext(prompt, conversation)) {
      return NextResponse.json({
        mode: "clarifying_question",
        ...buildClarifyingResponse(prompt, conversation),
      });
    }

    if (!confirmedBrief) {
      return NextResponse.json({
        mode: "brief",
        ...buildPlaylistBriefResponse(prompt, conversation),
      });
    }

    const [
      spotifySearchResult,
      chartResult,
      tiktokResult,
      accountPlaylistsResult,
      userTopResult,
    ] = await Promise.allSettled([
      getSpotifySearchCandidates(planningPrompt),
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

    let candidates = mergeCandidates([
      spotifySearchTracks,
      chartTracks,
      tiktokTracks,
      userTopTracks,
    ]);

    let plan: PlaylistPlan;
    let mode: "openai-agent" | "fallback";
    let message: string;
    let aiModel: string | null = null;
    let aiSource: "global_app" | "workspace_app" | null = null;

    try {
      const aiResult = await runOpenAICurator(
        buildOpenAIInput({
          prompt: planningPrompt,
          conversation,
          candidates,
          playlistNames: accountPlaylists.map((playlist) => playlist.name),
          chartDate,
          tiktokDate,
        }),
      );

      if (aiResult) {
        if (aiResult.json.action !== "clarifying_question" && aiResult.json.action !== "playlist_brief") {
          const externallyResolvedTracks = await resolveModelTracksWithSpotify(aiResult.json);
          if (externallyResolvedTracks.length > 0) {
            candidates = mergeCandidates([candidates, externallyResolvedTracks]);
          }
        }

        const intent = parseCuratorIntent(
          planningPrompt,
          aiResult.json,
          candidates,
          aiResult.sources,
        );

        if (intent.action === "clarifying_question") {
          const response = NextResponse.json({
            mode: "openai-agent",
            action: intent.action,
            message: intent.message,
            questions: intent.questions,
          });
          if (refreshedToken) setSpotifyAuthCookies(response, refreshedToken);
          return response;
        }

        if (intent.action === "playlist_brief") {
          const response = NextResponse.json({
            mode: "openai-agent",
            action: intent.action,
            message: intent.message,
            questions: intent.questions,
          });
          if (refreshedToken) setSpotifyAuthCookies(response, refreshedToken);
          return response;
        }

        plan = intent.plan;
        mode = "openai-agent";
        aiModel = aiResult.model;
        aiSource = aiResult.source;
        message =
          `Brief confirmado. Usei ${aiResult.model} (${aiResult.source === "workspace_app" ? "chave do workspace" : "chave global"}) com pesquisa web profunda e cruzei com Spotify API, charts internos, TikTok/Kworb e teu contexto de conta. Revisa a lista e, se fizer sentido, cria no Spotify.`;
      } else {
        plan = buildFallbackPlan(
          planningPrompt,
          candidates,
          "ChatGPT ainda nao configurado. Usei ranking interno com Spotify API, charts e TikTok/Kworb.",
        );
        mode = "fallback";
        message =
          "Montei com ranking interno. Para pesquisa ampla com ChatGPT, conecte a OpenAI em Configuracoes.";
      }
    } catch (error) {
      plan = buildFallbackPlan(
        planningPrompt,
        candidates,
        error instanceof Error
          ? `OpenAI indisponivel agora: ${error.message}`
          : "OpenAI indisponivel agora.",
      );
      mode = "fallback";
      message =
        "A pesquisa com ChatGPT falhou agora, entao usei o ranking interno para nao travar o fluxo.";
    }

    const response = NextResponse.json({ message, mode, plan, aiModel, aiSource });
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
