"use client";

import { startTransition, useState } from "react";
import type { FormEvent } from "react";
import {
  Bot,
  CheckCircle2,
  Disc3,
  ExternalLink,
  ListMusic,
  Loader2,
  MessageSquareText,
  PlusCircle,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatRole = "assistant" | "user";

type TrackSuggestion = {
  id: string;
  title: string;
  artist: string;
  imageUrl: string | null;
  source: "Spotify" | "TikTok" | "Catalogo" | "Curadoria";
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
  tracks: TrackSuggestion[];
  nextSteps: string[];
  spotifyResolvedCount: number;
  chartResolvedCount: number;
  dataSource: "openai-agent" | "spotify-api" | "charts-fallback" | "local-fallback";
  researchSummary?: string;
  researchSources?: Array<{
    title: string;
    url: string;
  }>;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  plan?: PlaylistPlan;
};

type SpotifySearchTrack = {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  imageUrl: string | null;
  durationLabel: string;
  spotifyUrl: string;
  popularity: number;
};

type PlaylistCreation = {
  playlistId: string;
  playlistUrl: string;
};

type PlaylistsAiAgentResponse = {
  message?: string;
  mode?: "openai-agent" | "fallback";
  plan?: PlaylistPlan;
};

export type PlaylistsAiChartTrack = {
  id: string;
  spotifyTrackId: string | null;
  title: string;
  artist: string;
  imageUrl: string | null;
  position: number;
  status: "new" | "up" | "down" | "stable";
  positionChange: number | null;
  streams: number | null;
};

const promptPresets = [
  "Cria uma playlist trap BR atual, com energia alta e musicas para bombar no fim de semana.",
  "Monta uma playlist funk para festa, misturando hits atuais com algumas apostas virais.",
  "Quero uma playlist romantica brasileira, moderna, mas com classicos marcantes.",
  "Faz uma playlist treino pesado, rap/trap/funk, sem deixar cair a energia.",
];

const catalogTracks: Record<string, TrackSuggestion[]> = {
  trap: [
    { id: "fallback-trap-1", title: "Noite Cara", artist: "KayBlack", imageUrl: null, source: "Spotify", energy: 86, reason: "Funciona como ancora popular para abrir a playlist." },
    { id: "fallback-trap-2", title: "Flow de Rua", artist: "Veigh", imageUrl: null, source: "Spotify", energy: 88, reason: "Mantem linguagem atual e alto encaixe com trap BR." },
    { id: "fallback-trap-3", title: "Luxo e Lama", artist: "Wiu", imageUrl: null, source: "TikTok", energy: 82, reason: "Boa ponte entre descoberta social e consumo de streaming." },
    { id: "fallback-trap-4", title: "Vitrine", artist: "Teto", imageUrl: null, source: "Curadoria", energy: 79, reason: "Ajuda a deixar o bloco mais melodico sem perder identidade." },
    { id: "fallback-trap-5", title: "Sem Sinal", artist: "Brandao85", imageUrl: null, source: "Catalogo", energy: 76, reason: "Aposta de textura para nao ficar so no obvio." },
    { id: "fallback-trap-6", title: "Plug Nacional", artist: "Alee", imageUrl: null, source: "Curadoria", energy: 81, reason: "Boa faixa de meio para sustentar retencao." },
  ],
  funk: [
    { id: "fallback-funk-1", title: "Sequencia de Vapo", artist: "DJ GBR", imageUrl: null, source: "TikTok", energy: 94, reason: "Abre com impacto e leitura viral clara." },
    { id: "fallback-funk-2", title: "Ela Joga", artist: "MC Tuto", imageUrl: null, source: "Spotify", energy: 91, reason: "Hit direto para manter skip baixo no comeco." },
    { id: "fallback-funk-3", title: "Baile Acendeu", artist: "DJ Arana", imageUrl: null, source: "TikTok", energy: 93, reason: "Funciona como faixa de pico para festa." },
    { id: "fallback-funk-4", title: "Modo Mandela", artist: "MC GW", imageUrl: null, source: "Curadoria", energy: 89, reason: "Entrega identidade de baile e movimento." },
    { id: "fallback-funk-5", title: "Tropa da Madruga", artist: "MC IG", imageUrl: null, source: "Spotify", energy: 86, reason: "Conecta funk com publico de trap/funk." },
    { id: "fallback-funk-6", title: "Paredao Ligado", artist: "DJ Topo", imageUrl: null, source: "Catalogo", energy: 90, reason: "Aposta para variar assinatura sonora." },
  ],
  romantica: [
    { id: "fallback-romantica-1", title: "Ainda Bem", artist: "Marisa Monte", imageUrl: null, source: "Catalogo", energy: 46, reason: "Classico afetivo para criar memoria emocional." },
    { id: "fallback-romantica-2", title: "Seu Astral", artist: "Jorge & Mateus", imageUrl: null, source: "Catalogo", energy: 58, reason: "Funciona como ponte popular e cantavel." },
    { id: "fallback-romantica-3", title: "Idiota", artist: "Jao", imageUrl: null, source: "Spotify", energy: 62, reason: "Traz pop brasileiro moderno para renovar o clima." },
    { id: "fallback-romantica-4", title: "Meu Abrigo", artist: "Melim", imageUrl: null, source: "Spotify", energy: 54, reason: "Mantem leveza e alto reconhecimento." },
    { id: "fallback-romantica-5", title: "Temporal", artist: "Lagum", imageUrl: null, source: "Curadoria", energy: 57, reason: "Boa transicao entre pop e romantico alternativo." },
    { id: "fallback-romantica-6", title: "Pra Voce Guardei", artist: "Nando Reis", imageUrl: null, source: "Catalogo", energy: 49, reason: "Fecha bloco com valor de catalogo forte." },
  ],
  treino: [
    { id: "fallback-treino-1", title: "Modo Aviao", artist: "Matue", imageUrl: null, source: "Spotify", energy: 90, reason: "Energia alta e refrao forte para inicio de treino." },
    { id: "fallback-treino-2", title: "Toma Toma Vapo Vapo", artist: "Ze Felipe", imageUrl: null, source: "TikTok", energy: 92, reason: "Hook rapido para manter ritmo e humor." },
    { id: "fallback-treino-3", title: "Poesia Acustica Energia", artist: "Pineapple StormTV", imageUrl: null, source: "Curadoria", energy: 78, reason: "Respiro de rap sem derrubar totalmente o BPM." },
    { id: "fallback-treino-4", title: "Acorda Pedrinho", artist: "Jovem Dionisio", imageUrl: null, source: "Catalogo", energy: 74, reason: "Contraste conhecido para evitar fadiga." },
    { id: "fallback-treino-5", title: "Foguete", artist: "Oruam", imageUrl: null, source: "Spotify", energy: 88, reason: "Mantem intensidade urbana no meio da sequencia." },
    { id: "fallback-treino-6", title: "Mega Energia", artist: "DJ GM", imageUrl: null, source: "TikTok", energy: 95, reason: "Bloco de pico para sprint ou final." },
  ],
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function inferMood(prompt: string) {
  const lower = prompt.toLowerCase();

  if (lower.includes("funk") || lower.includes("baile") || lower.includes("festa")) return "funk";
  if (lower.includes("romant") || lower.includes("love") || lower.includes("sofrencia")) return "romantica";
  if (lower.includes("treino") || lower.includes("academia") || lower.includes("corrida")) return "treino";
  return "trap";
}

function movementLabel(status: PlaylistsAiChartTrack["status"], change: number | null) {
  if (status === "new") return "entrada nova";
  if (status === "up") return `subiu ${Math.abs(change ?? 0)} posicoes`;
  if (status === "down") return `caiu ${Math.abs(change ?? 0)} posicoes`;
  return "estavel";
}

function compactStreams(streams: number | null) {
  if (!streams) return null;
  if (streams >= 1_000_000) return `${(streams / 1_000_000).toFixed(1)}M`;
  if (streams >= 1_000) return `${Math.round(streams / 1_000)}K`;
  return `${streams}`;
}

function clampScore(value: number, min = 35, max = 98) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTrackKey(title: string, artist: string) {
  return `${title}::${artist}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeTrackSuggestions(tracks: TrackSuggestion[]) {
  const seen = new Set<string>();

  return tracks.filter((track) => {
    const key = track.spotifyTrackId
      ? `spotify:${track.spotifyTrackId}`
      : normalizeTrackKey(track.title, track.artist);

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSpotifySearchQueries(prompt: string, mood: string) {
  const cleanPrompt = prompt
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const moodQuery = {
    funk: "funk brasil hits atuais 2026",
    romantica: "romanticas brasil pop sertanejo classicos",
    treino: "trap funk treino energia brasil",
    trap: "trap brasil rap hits atuais 2026",
  }[mood] ?? "hits brasil atuais";
  const intentQuery = /viral|tiktok|reels|bomb/i.test(prompt)
    ? "viral brasil tiktok reels spotify"
    : "spotify brasil top tracks";

  return Array.from(new Set([cleanPrompt, moodQuery, intentQuery].filter(Boolean))).slice(0, 3);
}

async function fetchSpotifySearchTracks(query: string, limit = 8) {
  const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Falha ao pesquisar no Spotify.");
  }

  const body = (await response.json()) as { tracks?: SpotifySearchTrack[] };
  return body.tracks ?? [];
}

function getMoodKeywords(mood: string) {
  if (mood === "funk") return ["mc", "dj", "funk", "baile", "mandela", "set"];
  if (mood === "romantica") return ["amor", "love", "saudade", "volta", "coracao", "sentimento"];
  if (mood === "treino") return ["mc", "dj", "trap", "funk", "beat", "mega"];
  return ["mc", "trap", "matue", "veigh", "teto", "kay", "wiu", "orochi", "oruan", "poze", "borges"];
}

function getChartTrackScore(track: PlaylistsAiChartTrack, mood: string) {
  const searchable = `${track.title} ${track.artist}`.toLowerCase();
  const keywordHit = getMoodKeywords(mood).some((keyword) => searchable.includes(keyword));
  const movementBoost = track.status === "new" ? 22 : track.status === "up" ? 16 : track.status === "stable" ? 6 : -8;
  const rankScore = Math.max(0, 220 - track.position);
  const moodBoost = keywordHit ? 42 : mood === "romantica" ? -4 : 0;

  return rankScore + movementBoost + moodBoost;
}

function chartToSuggestion(track: PlaylistsAiChartTrack, mood: string): TrackSuggestion {
  const streamLabel = compactStreams(track.streams);
  const movement = movementLabel(track.status, track.positionChange);
  const baseEnergy = mood === "romantica" ? 48 : mood === "treino" ? 86 : mood === "funk" ? 88 : 82;
  const rankBoost = Math.max(0, 18 - Math.floor(track.position / 10));
  const movementBoost = track.status === "up" || track.status === "new" ? 6 : track.status === "down" ? -4 : 0;

  return {
    id: `chart-${track.id}`,
    title: track.title,
    artist: track.artist,
    imageUrl: track.imageUrl,
    source: "Spotify",
    energy: clampScore(baseEnergy + rankBoost + movementBoost),
    reason: `#${track.position} no Spotify Charts BR, ${movement}${streamLabel ? `, ${streamLabel} streams` : ""}.`,
    chartPosition: track.position,
    movement: track.status,
    spotifyTrackId: track.spotifyTrackId,
    streams: track.streams,
  };
}

function spotifySearchToSuggestion(
  track: SpotifySearchTrack,
  mood: string,
  query: string,
): TrackSuggestion {
  const moodEnergy = mood === "romantica" ? 46 : mood === "treino" ? 88 : mood === "funk" ? 90 : 84;
  const popularityBoost = Math.round((track.popularity - 50) / 3);

  return {
    id: `spotify-api-${track.id}`,
    title: track.name,
    artist: track.artists || "Artista nao identificado",
    imageUrl: track.imageUrl,
    source: "Spotify",
    energy: clampScore(moodEnergy + popularityBoost),
    reason: `Encontrada pela Spotify API em "${query}", popularidade ${track.popularity}/100.`,
    spotifyTrackId: track.id,
  };
}

function getRealTrackSuggestions(
  prompt: string,
  chartTracks: PlaylistsAiChartTrack[],
  mood: string,
) {
  if (chartTracks.length === 0) return [];

  const wantsViral = /viral|tiktok|reels|bomb/i.test(prompt);
  const source = [...chartTracks]
    .sort((a, b) => getChartTrackScore(b, mood) - getChartTrackScore(a, mood))
    .slice(0, wantsViral ? 8 : 6);

  return source.map((track) => chartToSuggestion(track, mood));
}

function buildPlaylistPlan(
  prompt: string,
  chartTracks: PlaylistsAiChartTrack[],
  chartDate: string | null,
): PlaylistPlan {
  const mood = inferMood(prompt);
  const fallbackTracks = catalogTracks[mood] ?? catalogTracks.trap;
  const realTracks = getRealTrackSuggestions(prompt, chartTracks, mood);
  const seen = new Set(realTracks.map((track) => normalizeTrackKey(track.title, track.artist)));
  const tracks = dedupeTrackSuggestions([
    ...realTracks,
    ...fallbackTracks.filter((track) => !seen.has(normalizeTrackKey(track.title, track.artist))),
  ]).slice(0, 8);
  const wantsClassic = /classico|antigo|anos|2000|2010/i.test(prompt);
  const wantsViral = /viral|tiktok|reels|bomb/i.test(prompt);
  const wantsCurrent = /atual|novo|2026|moderno|charts/i.test(prompt);
  const hasRealCharts = realTracks.length > 0;

  let spotify = hasRealCharts ? 58 : wantsCurrent ? 50 : 42;
  let tiktok = wantsViral ? 34 : mood === "funk" ? 30 : 22;
  let catalog = Math.max(12, 100 - spotify - tiktok);

  if (wantsClassic) {
    catalog = 34;
    const remaining = 100 - catalog;
    spotify = Math.min(spotify, Math.round(remaining * 0.68));
    tiktok = remaining - spotify;
  }

  return {
    id: newId("plan"),
    title:
      mood === "funk"
        ? "Baile em Alta"
        : mood === "romantica"
          ? "Romanticas com Memoria"
          : mood === "treino"
            ? "Treino Sem Queda"
            : "Trap BR Radar",
    subtitle: prompt,
    targetSize: mood === "romantica" ? 45 : 60,
    confidence: hasRealCharts ? 88 : wantsCurrent || wantsViral ? 84 : 76,
    marketBlend: { spotify, tiktok, catalog },
    strategy: [
      "Abrir com faixas reconheciveis para reduzir skip nos primeiros minutos.",
      hasRealCharts
        ? `Usar Spotify Charts BR${chartDate ? ` de ${chartDate}` : ""} como base real de demanda.`
        : "Intercalar apostas com hits para testar descoberta sem perder retencao.",
      "Organizar a energia em blocos: entrada forte, meio sustentado e final com pico.",
    ],
    tracks,
    nextSteps: [
      hasRealCharts
        ? "Cruzar esta lista com suas playlists para evitar repeticao e achar lacunas."
        : "Importar ou atualizar snapshots para ativar leitura real de charts.",
      "Escolher capa, nome e tamanho final da playlist.",
      "Criar no Spotify apenas depois de revisar a lista.",
    ],
    spotifyResolvedCount: tracks.filter((track) => Boolean(track.spotifyTrackId)).length,
    chartResolvedCount: realTracks.length,
    dataSource: hasRealCharts ? "charts-fallback" : "local-fallback",
  };
}

async function buildSpotifyBackedPlan(
  prompt: string,
  chartTracks: PlaylistsAiChartTrack[],
  chartDate: string | null,
) {
  const mood = inferMood(prompt);
  const basePlan = buildPlaylistPlan(prompt, chartTracks, chartDate);
  const queries = getSpotifySearchQueries(prompt, mood);

  try {
    const settledBatches = await Promise.allSettled(
      queries.map(async (query) => ({
        query,
        tracks: await fetchSpotifySearchTracks(query, 8),
      })),
    );
    const batches = settledBatches.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );

    if (batches.length === 0) {
      const firstError = settledBatches.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      throw new Error(
        firstError?.reason instanceof Error
          ? firstError.reason.message
          : "Falha ao usar a Spotify API.",
      );
    }

    const spotifySuggestions = dedupeTrackSuggestions(
      batches.flatMap((batch) =>
        batch.tracks.map((track) => spotifySearchToSuggestion(track, mood, batch.query)),
      ),
    ).slice(0, 10);

    if (spotifySuggestions.length === 0) {
      return {
        plan: basePlan,
        usedSpotifyApi: false,
        error: "A Spotify API nao retornou faixas para esse pedido.",
      };
    }

    const fallbackTracks = catalogTracks[mood] ?? catalogTracks.trap;
    const realTracks = getRealTrackSuggestions(prompt, chartTracks, mood);
    const tracks = dedupeTrackSuggestions([
      ...spotifySuggestions,
      ...realTracks,
      ...fallbackTracks,
    ]).slice(0, 12);
    const spotifyResolvedCount = tracks.filter((track) => Boolean(track.spotifyTrackId)).length;
    const chartResolvedCount = tracks.filter((track) => Boolean(track.chartPosition)).length;
    const spotifyBlend = Math.min(72, Math.max(basePlan.marketBlend.spotify, 64));
    const catalogBlend = Math.max(8, Math.min(24, basePlan.marketBlend.catalog));
    const tiktokBlend = Math.max(8, 100 - spotifyBlend - catalogBlend);

    return {
      plan: {
        ...basePlan,
        confidence: Math.min(96, Math.max(basePlan.confidence, 90 + Math.min(spotifyResolvedCount, 6))),
        marketBlend: {
          spotify: spotifyBlend,
          tiktok: tiktokBlend,
          catalog: catalogBlend,
        },
        strategy: [
          "Pesquisar faixas oficiais pela Spotify API a partir do pedido do chat.",
          chartTracks.length > 0
            ? `Cruzar com Spotify Charts BR${chartDate ? ` de ${chartDate}` : ""} para priorizar demanda real.`
            : "Usar catalogo e curadoria como fallback se nao houver snapshot importado.",
          "Deduplicar por ID oficial e ordenar por aderencia, popularidade e energia.",
        ],
        tracks,
        nextSteps: [
          `${spotifyResolvedCount} faixas tem ID oficial para criacao direta no Spotify.`,
          "Revisar capa, nome e tamanho antes de publicar.",
          "Criar como playlist privada e depois ajustar no editor do sistema.",
        ],
        spotifyResolvedCount,
        chartResolvedCount,
        dataSource: "spotify-api" as const,
      },
      usedSpotifyApi: true,
      error: null,
    };
  } catch (error) {
    return {
      plan: basePlan,
      usedSpotifyApi: false,
      error: error instanceof Error ? error.message : "Falha ao usar a Spotify API.",
    };
  }
}

async function buildAgentPlan(prompt: string) {
  const response = await fetch("/api/playlists-ia/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const body = (await response.json().catch(() => ({}))) as PlaylistsAiAgentResponse & {
    message?: string;
  };

  if (!response.ok || !body.plan) {
    throw new Error(body.message ?? "Falha ao acionar a Playlists IA.");
  }

  return {
    plan: body.plan,
    message:
      body.message ??
      (body.mode === "openai-agent"
        ? "Pesquisei com ChatGPT e cruzei com os dados reais do sistema."
        : "Montei com ranking interno e dados reais disponiveis."),
  };
}

function getSpotifyTrackUris(plan: PlaylistPlan) {
  return Array.from(
    new Set(
      plan.tracks
        .map((track) => track.spotifyTrackId)
        .filter((id): id is string => Boolean(id))
        .map((id) => `spotify:track:${id}`),
    ),
  );
}

function SourceBadge({ source }: { source: TrackSuggestion["source"] }) {
  const tone = {
    Spotify: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200",
    TikTok: "border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-200",
    Catalogo: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-200",
    Curadoria: "border-violet-400/30 bg-violet-400/10 text-violet-700 dark:text-violet-200",
  }[source];

  return (
    <span className={cn("rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]", tone)}>
      {source}
    </span>
  );
}

function coverStyle(imageUrl: string | null) {
  if (!imageUrl) return undefined;

  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function PlaylistPlanCard({
  plan,
  creation,
  creationError,
  isCreating,
  onCreatePlaylist,
}: {
  plan: PlaylistPlan;
  creation?: PlaylistCreation;
  creationError?: string;
  isCreating: boolean;
  onCreatePlaylist: (plan: PlaylistPlan) => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const spotifyTrackUris = getSpotifyTrackUris(plan);

  return (
    <section className="mt-4 overflow-hidden rounded-[28px] border border-border/80 bg-background/[0.72] shadow-[0_20px_70px_-48px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-white/[0.035]">
      <div className="border-b border-border/70 p-4 dark:border-white/10 tablet:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Blueprint de playlist
            </div>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">
              {plan.title}
            </h3>
            <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
              {plan.subtitle}
            </p>
          </div>
          <div className="rounded-[20px] border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">
              {plan.dataSource === "openai-agent" ? "ChatGPT" : "Confianca"}
            </div>
            <div className="text-2xl font-black tabular-nums text-foreground">{plan.confidence}%</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700/80 dark:text-emerald-200/80">
              {plan.spotifyResolvedCount} ids oficiais
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 tablet:grid-cols-3">
          <div className="rounded-[20px] border border-border/70 bg-muted/40 p-4 dark:border-white/10 dark:bg-black/20">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Spotify</p>
            <p className="mt-2 text-2xl font-black tabular-nums">{plan.marketBlend.spotify}%</p>
          </div>
          <div className="rounded-[20px] border border-border/70 bg-muted/40 p-4 dark:border-white/10 dark:bg-black/20">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">TikTok/Reels</p>
            <p className="mt-2 text-2xl font-black tabular-nums">{plan.marketBlend.tiktok}%</p>
          </div>
          <div className="rounded-[20px] border border-border/70 bg-muted/40 p-4 dark:border-white/10 dark:bg-black/20">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Catalogo</p>
            <p className="mt-2 text-2xl font-black tabular-nums">{plan.marketBlend.catalog}%</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 tablet:p-5 laptop:grid-cols-[1.35fr_0.65fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-black text-foreground">Faixas sugeridas</h4>
            <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              preview
            </span>
          </div>
          <div className="space-y-2">
            {plan.tracks.map((track, index) => (
              <article
                key={track.id}
                className="grid gap-3 rounded-[20px] border border-border/70 bg-background/[0.66] p-3 dark:border-white/10 dark:bg-black/20 tablet:grid-cols-[48px_1fr_auto] tablet:items-center"
              >
                <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-border/70 bg-muted/60 dark:border-white/10">
                  <div className="absolute inset-0" style={coverStyle(track.imageUrl)} />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-sm font-black tabular-nums text-white">
                    {index + 1}
                  </div>
                </div>
                <div className="min-w-0">
                  <h5 className="truncate text-sm font-black text-foreground">{track.title}</h5>
                  <p className="truncate text-xs font-medium text-muted-foreground">{track.artist}</p>
                  <p className="mt-1 line-clamp-1 text-[11px] font-medium text-muted-foreground">{track.reason}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 tablet:justify-end">
                  <SourceBadge source={track.source} />
                  {track.chartPosition ? (
                    <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-1 text-[10px] font-bold tabular-nums text-muted-foreground">
                      chart #{track.chartPosition}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-1 text-[10px] font-bold tabular-nums text-muted-foreground">
                    energia {track.energy}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-3">
          {plan.researchSummary ? (
            <div className="rounded-[22px] border border-sky-400/25 bg-sky-400/10 p-4 dark:border-sky-300/15 dark:bg-sky-300/[0.08]">
              <h4 className="flex items-center gap-2 text-sm font-black text-foreground">
                <Sparkles className="h-4 w-4" />
                Pesquisa
              </h4>
              <p className="mt-3 text-xs font-medium leading-5 text-muted-foreground">
                {plan.researchSummary}
              </p>
              {plan.researchSources && plan.researchSources.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {plan.researchSources.slice(0, 4).map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-2 text-[11px] font-bold text-muted-foreground transition hover:border-sky-400/35 hover:text-foreground dark:border-white/10 dark:bg-black/20"
                    >
                      <span className="line-clamp-1">{source.title}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-[22px] border border-border/70 bg-muted/35 p-4 dark:border-white/10 dark:bg-black/20">
            <h4 className="flex items-center gap-2 text-sm font-black text-foreground">
              <Wand2 className="h-4 w-4" />
              Estrategia
            </h4>
            <div className="mt-3 space-y-2">
              {plan.strategy.map((item) => (
                <p key={item} className="flex gap-2 text-xs font-medium leading-5 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-border/70 bg-muted/35 p-4 dark:border-white/10 dark:bg-black/20">
            <h4 className="flex items-center gap-2 text-sm font-black text-foreground">
              <PlusCircle className="h-4 w-4" />
              Proximos passos
            </h4>
            <div className="mt-3 space-y-2">
              {plan.nextSteps.map((item) => (
                <p key={item} className="text-xs font-medium leading-5 text-muted-foreground">
                  {item}
                </p>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {creation ? (
                <div className="rounded-[18px] border border-emerald-400/30 bg-emerald-400/10 p-3">
                  <p className="text-xs font-black text-emerald-700 dark:text-emerald-200">
                    Playlist criada no Spotify.
                  </p>
                  <div className="mt-3 grid gap-2">
                    <a
                      href={creation.playlistUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-400/15 dark:text-emerald-200"
                    >
                      Abrir no Spotify
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ) : null}

              {creationError ? (
                <p className="rounded-[16px] border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-200">
                  {creationError}
                </p>
              ) : null}

              {!creation && isConfirming ? (
                <div className="grid gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isCreating}
                    onClick={() => onCreatePlaylist(plan)}
                    className="w-full rounded-full"
                  >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                    Confirmar criacao privada
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isCreating}
                    onClick={() => setIsConfirming(false)}
                    className="w-full rounded-full"
                  >
                    Cancelar
                  </Button>
                </div>
              ) : null}

              {!creation && !isConfirming ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={spotifyTrackUris.length === 0 || isCreating}
                  onClick={() => setIsConfirming(true)}
                  className="w-full rounded-full"
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                  Criar no Spotify
                </Button>
              ) : null}

              <p className="text-[11px] font-medium leading-4 text-muted-foreground">
                {spotifyTrackUris.length > 0
                  ? `${spotifyTrackUris.length} faixas prontas para envio. Cria privada por seguranca.`
                  : "Gere com Spotify API para liberar criacao direta."}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function MessageBubble({
  message,
  createdPlaylists,
  creationErrors,
  creatingPlanId,
  onCreatePlaylist,
}: {
  message: ChatMessage;
  createdPlaylists: Record<string, PlaylistCreation>;
  creationErrors: Record<string, string>;
  creatingPlanId: string | null;
  onCreatePlaylist: (plan: PlaylistPlan) => void;
}) {
  const isUser = message.role === "user";

  return (
    <article className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className={cn("max-w-[92%]", isUser ? "tablet:max-w-[74%]" : "tablet:max-w-[92%]")}>
        <div
          className={cn(
            "rounded-[24px] border px-4 py-3 text-sm font-medium leading-6",
            isUser
              ? "border-sky-400/30 bg-sky-400/[0.12] text-foreground dark:bg-sky-400/10"
              : "border-border/80 bg-background/[0.72] text-foreground dark:border-white/10 dark:bg-white/[0.035]",
          )}
        >
          {message.content}
        </div>
        {message.plan ? (
          <PlaylistPlanCard
            plan={message.plan}
            creation={createdPlaylists[message.plan.id]}
            creationError={creationErrors[message.plan.id]}
            isCreating={creatingPlanId === message.plan.id}
            onCreatePlaylist={onCreatePlaylist}
          />
        ) : null}
      </div>
    </article>
  );
}

export default function PlaylistsAiWorkbench({
  chartTracks = [],
  chartDate = null,
}: {
  chartTracks?: PlaylistsAiChartTrack[];
  chartDate?: string | null;
}) {
  const hasChartData = chartTracks.length > 0;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        hasChartData
          ? `Estou pronto para buscar na Spotify API e cruzar com ${chartTracks.length} faixas do Spotify Charts BR${chartDate ? ` (${chartDate})` : ""}. Me fala a vibe, genero, energia e objetivo.`
          : "Estou pronto para buscar na Spotify API. Me fala a vibe, genero, ano, energia e objetivo.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [creatingPlanId, setCreatingPlanId] = useState<string | null>(null);
  const [createdPlaylists, setCreatedPlaylists] = useState<Record<string, PlaylistCreation>>({});
  const [creationErrors, setCreationErrors] = useState<Record<string, string>>({});

  async function submitPrompt(prompt: string) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isThinking) return;

    const userMessage: ChatMessage = {
      id: newId("user"),
      role: "user",
      content: cleanPrompt,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsThinking(true);

    try {
      const result = await buildAgentPlan(cleanPrompt).catch(async () => {
        const fallback = await buildSpotifyBackedPlan(cleanPrompt, chartTracks, chartDate);
        return {
          plan: fallback.plan,
          message:
            fallback.usedSpotifyApi
              ? "O agente nao respondeu agora; montei usando Spotify API e charts internos como fallback."
              : `O agente nao respondeu agora. ${fallback.error ? `Fallback: ${fallback.error}` : "Usei a versao segura local."}`,
        };
      });
      startTransition(() => {
        setMessages((current) => [
          ...current,
          {
            id: newId("assistant"),
            role: "assistant",
            content: result.message,
            plan: result.plan,
          },
        ]);
        setIsThinking(false);
      });
    } catch (error) {
      startTransition(() => {
        setMessages((current) => [
          ...current,
          {
            id: newId("assistant"),
            role: "assistant",
            content:
              error instanceof Error
                ? `Nao consegui montar agora: ${error.message}`
                : "Nao consegui montar agora. Tenta de novo em instantes.",
          },
        ]);
        setIsThinking(false);
      });
    }
  }

  async function createPlaylistFromPlan(plan: PlaylistPlan) {
    const trackUris = getSpotifyTrackUris(plan);
    if (trackUris.length === 0 || creatingPlanId) return;

    setCreatingPlanId(plan.id);
    setCreationErrors((current) => {
      const next = { ...current };
      delete next[plan.id];
      return next;
    });

    try {
      const response = await fetch("/api/spotify/playlists/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: plan.title,
          description: `Criada pela Playlists IA. Pedido: ${plan.subtitle}`.slice(0, 300),
          isPublic: false,
          trackUris,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        playlistId?: string;
        playlistUrl?: string;
        message?: string;
      };

      if (!response.ok || !body.playlistId) {
        throw new Error(body.message ?? "Erro ao criar playlist no Spotify.");
      }

      const playlistId = body.playlistId;
      const playlistUrl = body.playlistUrl ?? `https://open.spotify.com/playlist/${playlistId}`;
      setCreatedPlaylists((current) => ({
        ...current,
        [plan.id]: {
          playlistId,
          playlistUrl,
        },
      }));
    } catch (error) {
      setCreationErrors((current) => ({
        ...current,
        [plan.id]: error instanceof Error ? error.message : "Erro ao criar playlist no Spotify.",
      }));
    } finally {
      setCreatingPlanId(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt(input);
  }

  return (
    <div className="grid gap-5 laptop:grid-cols-[0.72fr_1.28fr]">
      <aside className="space-y-4">
        <section className="relative overflow-hidden rounded-[34px] border border-white/70 bg-white/[0.74] p-5 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_28px_110px_rgba(0,0,0,0.35)]">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-300/[0.25] blur-3xl dark:bg-emerald-400/[0.12]" />
          <div className="absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-sky-300/[0.22] blur-3xl dark:bg-sky-500/[0.12]" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              Playlists IA
            </span>
            <h2 className="mt-5 text-4xl font-black tracking-[-0.06em] text-foreground">
              Um chat para transformar ideia em playlist.
            </h2>
            <p className="mt-4 text-sm font-medium leading-6 text-muted-foreground">
              O builder conversa com o agente, pesquisa com ChatGPT quando configurado, cruza Spotify API, TikTok/Kworb, charts internos e libera criacao privada apos revisao.
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[24px] border border-border/70 bg-background/[0.62] p-4 dark:border-white/10 dark:bg-black/20">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                  <MessageSquareText className="h-4 w-4" />
                  Comando
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  Vibe, genero, ano, publico, tamanho e objetivo.
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/[0.62] p-4 dark:border-white/10 dark:bg-black/20">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                  <Disc3 className="h-4 w-4" />
                  Leitura
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {hasChartData
                    ? `ChatGPT + Spotify API + ${chartTracks.length} faixas do Charts BR${chartDate ? ` (${chartDate})` : ""}.`
                    : "ChatGPT + Spotify API + TikTok/Kworb."}
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/[0.62] p-4 dark:border-white/10 dark:bg-black/20">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                  <ListMusic className="h-4 w-4" />
                  Saida
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  Blueprint revisavel antes de criar no Spotify.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-border/80 bg-card/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <h3 className="text-sm font-black text-foreground">Prompts rapidos</h3>
          <div className="mt-3 space-y-2">
            {promptPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => void submitPrompt(preset)}
                disabled={isThinking}
                className="w-full rounded-[18px] border border-border/70 bg-background/[0.62] px-3 py-3 text-left text-xs font-semibold leading-5 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-foreground disabled:opacity-60 dark:border-white/10 dark:bg-black/20"
              >
                {preset}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="flex min-h-[760px] flex-col overflow-hidden rounded-[34px] border border-border/80 bg-card/[0.72] shadow-[0_24px_90px_-58px_rgba(15,23,42,0.54)] dark:border-white/10 dark:bg-white/[0.035]">
        <div className="border-b border-border/80 p-4 dark:border-white/10 tablet:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Builder
              </div>
              <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-foreground">
                Chat de criacao de playlists
              </h3>
            </div>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
              {hasChartData ? "agente + dados reais" : "agente ia"}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 tablet:p-5">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              createdPlaylists={createdPlaylists}
              creationErrors={creationErrors}
              creatingPlanId={creatingPlanId}
              onCreatePlaylist={createPlaylistFromPlan}
            />
          ))}
          {isThinking && (
            <article className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-[24px] border border-border/80 bg-background/[0.72] px-4 py-3 text-sm font-semibold text-muted-foreground dark:border-white/10 dark:bg-white/[0.035]">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                montando blueprint...
              </div>
            </article>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border/80 p-4 dark:border-white/10 tablet:p-5">
          <div className="rounded-[26px] border border-border/80 bg-background/[0.74] p-2 shadow-inner dark:border-white/10 dark:bg-black/20">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={3}
              placeholder="Ex: cria uma playlist trap/funk atual para noite, 60 faixas, misturando Spotify Charts e TikTok..."
              className="min-h-20 w-full resize-none bg-transparent px-3 py-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-2 py-2 dark:border-white/10">
              <p className="text-xs font-medium text-muted-foreground">
                {hasChartData
                  ? "Agente com ChatGPT quando OPENAI_API_KEY estiver ativa. Fallback interno sempre ligado."
                  : "ChatGPT + Spotify API com fallback local se a conexao falhar."}
              </p>
              <Button type="submit" disabled={!input.trim() || isThinking} className="rounded-full">
                {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Gerar blueprint
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
