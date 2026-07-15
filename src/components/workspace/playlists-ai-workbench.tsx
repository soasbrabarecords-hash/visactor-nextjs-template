"use client";

import {
  ArrowUpDown,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Bot,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Globe2,
  History,
  ListMusic,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageSquarePlus,
  Music2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tags,
  TrendingDown,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type {
  PlaylistsAiChatApiResponse,
  PlaylistsAiChatResponse,
  PlaylistsAiConversationDetail,
  PlaylistsAiConversationSummary,
  PlaylistsAiCurationBrief,
  PlaylistsAiPreparedActionType,
  PlaylistsAiTrackCard,
} from "@/types/playlists-ai";
import {
  TRACK_PROFILE_GENRES,
  TRACK_PROFILE_GENRE_LABELS,
  type TrackGenreCardProfile,
  type TrackProfileGenre,
} from "@/types/track-profile";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  result?: PlaylistsAiChatResponse;
};

type DecisionMarketFilter = "ALL" | "BR" | "GLOBAL";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Vamos pensar essa curadoria juntos. Conte o que você quer construir, revisar ou descobrir. Eu posso primeiro entender o objetivo e, quando fizer sentido, cruzar charts, playlists, histórico e gênero sem executar nenhuma alteração.",
};

function createEmptyBrief(): PlaylistsAiCurationBrief {
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

function goalLabel(value: PlaylistsAiCurationBrief["goal"]) {
  if (value === "growth") return "Crescimento";
  if (value === "editorial") return "Editorial";
  if (value === "discovery") return "Descoberta";
  if (value === "hits") return "Hits";
  if (value === "retention") return "Retenção";
  if (value === "balanced") return "Equilíbrio";
  return null;
}

function marketLabel(value: PlaylistsAiCurationBrief["market"]) {
  if (value === "BR") return "Brasil";
  if (value === "GLOBAL") return "Global";
  if (value === "BOTH") return "BR + Global";
  return null;
}

function strategyLabel(value: PlaylistsAiCurationBrief["strategy"]) {
  if (value === "retention") return "Retenção";
  if (value === "discovery") return "Descoberta";
  if (value === "renewal") return "Renovação";
  if (value === "hits") return "Hits";
  if (value === "balanced") return "Equilíbrio";
  return null;
}

function briefChips(brief: PlaylistsAiCurationBrief) {
  const chips = [
    brief.playlistName ? `Playlist · ${brief.playlistName}` : null,
    brief.genre ? `Gênero · ${brief.genre}` : null,
    goalLabel(brief.goal) ? `Objetivo · ${goalLabel(brief.goal)}` : null,
    marketLabel(brief.market) ? `Mercado · ${marketLabel(brief.market)}` : null,
    strategyLabel(brief.strategy)
      ? `Estratégia · ${strategyLabel(brief.strategy)}`
      : null,
    brief.audience ? `Público · ${brief.audience}` : null,
    brief.targetSize ? `${brief.targetSize} faixas` : null,
  ].filter((item): item is string => Boolean(item));

  return chips.length > 0 ? chips.slice(0, 6) : ["Objetivo em construção"];
}

const QUICK_QUESTIONS = [
  "Quero melhorar uma playlist existente.",
  "Quero criar uma nova playlist.",
  "Quais músicas estão mais quentes no BR hoje?",
  "Quais oportunidades globais ainda não estão nas minhas playlists?",
  "Quero revisar faixas que perderam tração.",
];

const ACTION_ICONS: Record<PlaylistsAiPreparedActionType, typeof Plus> = {
  add_to_playlist: Plus,
  watch_7_days: Eye,
  create_playlist: ListMusic,
  update_description: FileText,
  reorder_top_20: ArrowUpDown,
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatPosition(position: number | undefined) {
  return typeof position === "number" ? `#${position}` : "—";
}

function movementLabel(value: number | null) {
  if (value === null) return "7d indisponível";
  if (value > 0) return `+${value} em 7d`;
  if (value < 0) return `${value} em 7d`;
  return "estável em 7d";
}

function conversationActivityLabel(value: string | null) {
  if (!value) return "Conversa salva";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Conversa salva";
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? `Hoje, ${date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });
}

function MovementIcon({ value }: { value: number | null }) {
  if (value === null || value === 0)
    return <ShieldCheck className="h-3.5 w-3.5" />;
  return value > 0 ? (
    <TrendingUp className="h-3.5 w-3.5" />
  ) : (
    <TrendingDown className="h-3.5 w-3.5" />
  );
}

function TrackCard({
  card,
  isPinned,
  isSaved,
  onTogglePin,
  onToggleSaved,
  onIgnore,
}: {
  card: PlaylistsAiTrackCard;
  isPinned: boolean;
  isSaved: boolean;
  onTogglePin: () => void;
  onToggleSaved: () => void;
  onIgnore: () => void;
}) {
  const [genreProfile, setGenreProfile] =
    useState<TrackGenreCardProfile | null>(card.genreProfile ?? null);
  const [genreEditorOpen, setGenreEditorOpen] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<TrackProfileGenre>(
    card.genreProfile?.primaryGenre ?? "desconhecido",
  );
  const [genreBusy, setGenreBusy] = useState(false);
  const [genreError, setGenreError] = useState<string | null>(null);
  const [signalsOpen, setSignalsOpen] = useState(false);

  const updateGenreProfile = async (mode: "enrich" | "override") => {
    if (!card.spotifyTrackId || genreBusy) return;
    setGenreBusy(true);
    setGenreError(null);
    try {
      const endpoint =
        mode === "enrich"
          ? "/api/playlist-os/track-profiles/enrich"
          : `/api/playlist-os/track-profiles/${encodeURIComponent(card.spotifyTrackId)}`;
      const response = await fetch(endpoint, {
        method: mode === "enrich" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "enrich"
            ? {
                spotifyTrackId: card.spotifyTrackId,
                name: card.name,
                artists: card.artists,
                chartCountry: card.positions.BR ? "BR" : "GLOBAL",
              }
            : {
                entityType: "track",
                primaryGenre: selectedGenre,
                note: "Correção feita no card do Playlists IA.",
              },
        ),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        profile?: TrackGenreCardProfile & {
          primaryGenre: TrackProfileGenre;
        };
      };
      if (!response.ok || !payload.success || !payload.profile) {
        throw new Error(
          payload.message || "Não foi possível atualizar o gênero.",
        );
      }
      setGenreProfile({
        primaryGenre: payload.profile.primaryGenre,
        label:
          TRACK_PROFILE_GENRE_LABELS[payload.profile.primaryGenre] ??
          payload.profile.label,
        genreConfidence: payload.profile.genreConfidence,
        confidenceLabel: payload.profile.confidenceLabel,
        manualOverride: payload.profile.manualOverride,
      });
      setSelectedGenre(payload.profile.primaryGenre);
      setGenreEditorOpen(false);
    } catch (error) {
      setGenreError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o gênero.",
      );
    } finally {
      setGenreBusy(false);
    }
  };

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-[20px] border bg-background/45 p-3.5 transition duration-200 hover:border-primary/25 hover:bg-background/70 dark:bg-white/[0.025] dark:hover:bg-white/[0.045]",
        isPinned
          ? "border-emerald-400/35 ring-1 ring-emerald-400/10"
          : "border-border/65 dark:border-white/10",
      )}
    >
      <div className="flex gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-muted">
          {card.coverUrl ? (
            <Image
              src={card.coverUrl}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-400/25 to-sky-400/20 text-muted-foreground">
              <Music2 className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-black tracking-[-0.02em] text-foreground">
                {card.name}
              </h4>
              <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                {card.artists}
              </p>
            </div>
            {card.opportunityScore !== null ? (
              <div className="shrink-0 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-center">
                <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                  {card.opportunityScore}
                </div>
                <div className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700/70 dark:text-emerald-300/70">
                  score
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black">
            {genreProfile ? (
              <span
                title={`Confiança ${genreProfile.confidenceLabel}: ${genreProfile.genreConfidence}%${genreProfile.manualOverride ? " · correção manual" : ""}`}
                className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-violet-700 dark:text-violet-300"
              >
                <Tags className="h-3 w-3" /> {genreProfile.label}
                <span className="opacity-65">
                  {genreProfile.genreConfidence}%
                </span>
              </span>
            ) : null}
            {card.spotifyTrackId ? (
              <button
                type="button"
                disabled={genreBusy}
                onClick={() => setGenreEditorOpen((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/45 px-2 py-1 text-muted-foreground transition hover:text-foreground disabled:opacity-50 dark:border-white/10"
                title="Atualizar ou corrigir o gênero desta faixa"
              >
                {genreBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Pencil className="h-3 w-3" />
                )}
                Gênero
              </button>
            ) : null}
            {card.playlistFit ? (
              <span
                title={card.playlistFit.reason}
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-1",
                  card.playlistFit.label === "alto"
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300"
                    : card.playlistFit.label === "baixo"
                      ? "border-rose-400/20 bg-rose-400/10 text-rose-700 dark:text-rose-300"
                      : "border-amber-400/20 bg-amber-400/10 text-amber-700 dark:text-amber-300",
                )}
              >
                Fit {card.playlistFit.score}%
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/45 px-2 py-1 text-muted-foreground dark:border-white/10">
              <MapPin className="h-3 w-3" /> BR{" "}
              {formatPosition(card.positions.BR)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/45 px-2 py-1 text-muted-foreground dark:border-white/10">
              <Globe2 className="h-3 w-3" /> Global{" "}
              {formatPosition(card.positions.GLOBAL)}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1",
                (card.movement7d ?? 0) > 0
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300"
                  : (card.movement7d ?? 0) < 0
                    ? "border-rose-400/25 bg-rose-400/10 text-rose-700 dark:text-rose-300"
                    : "border-border/70 bg-muted/45 text-muted-foreground dark:border-white/10",
              )}
            >
              <MovementIcon value={card.movement7d} />
              {movementLabel(card.movement7d)}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs font-medium leading-5 text-muted-foreground">
        {card.reason}
      </p>

      {genreEditorOpen ? (
        <div className="mt-3 rounded-2xl border border-violet-400/20 bg-violet-400/[0.055] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedGenre}
              onChange={(event) =>
                setSelectedGenre(event.target.value as TrackProfileGenre)
              }
              disabled={genreBusy}
              className="h-9 min-w-[170px] flex-1 rounded-xl border border-border/70 bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-violet-400/50 dark:border-white/10"
            >
              {TRACK_PROFILE_GENRES.map((genre) => (
                <option key={genre} value={genre}>
                  {TRACK_PROFILE_GENRE_LABELS[genre]}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={genreBusy}
              onClick={() => void updateGenreProfile("override")}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-500 px-3 text-[10px] font-black uppercase tracking-[0.09em] text-white disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Corrigir
            </button>
            <button
              type="button"
              disabled={genreBusy}
              onClick={() => void updateGenreProfile("enrich")}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 text-[10px] font-black uppercase tracking-[0.09em] text-foreground disabled:opacity-50 dark:border-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Consultar fontes
            </button>
            <button
              type="button"
              onClick={() => setGenreEditorOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
              aria-label="Fechar editor de gênero"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {genreError ? (
            <p className="mt-2 text-[10px] font-bold text-rose-600 dark:text-rose-300">
              {genreError}
            </p>
          ) : (
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              “Consultar fontes” usa metadados, MusicBrainz e Last.fm quando
              configurado. “Corrigir” prevalece somente neste workspace.
            </p>
          )}
        </div>
      ) : null}

      {signalsOpen ? (
        <div className="mt-3 rounded-2xl border border-border/60 bg-muted/[0.24] p-3 dark:border-white/10 dark:bg-white/[0.025]">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-background/65 px-2.5 py-2 dark:bg-black/15">
              <div className="text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Oportunidade
              </div>
              <div className="mt-1 text-sm font-black text-foreground">
                {card.opportunityScore ?? "—"}
              </div>
            </div>
            <div className="rounded-xl bg-background/65 px-2.5 py-2 dark:bg-black/15">
              <div className="text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Movimento 7d
              </div>
              <div
                className={cn(
                  "mt-1 text-sm font-black",
                  (card.movement7d ?? 0) > 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : (card.movement7d ?? 0) < 0
                      ? "text-rose-700 dark:text-rose-300"
                      : "text-foreground",
                )}
              >
                {card.movement7d === null
                  ? "—"
                  : `${card.movement7d > 0 ? "+" : ""}${card.movement7d}`}
              </div>
            </div>
            <div className="rounded-xl bg-background/65 px-2.5 py-2 dark:bg-black/15">
              <div className="text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Fit playlist
              </div>
              <div className="mt-1 text-sm font-black text-foreground">
                {card.playlistFit ? `${card.playlistFit.score}%` : "—"}
              </div>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10px] font-semibold text-muted-foreground">
            <div className="rounded-xl border border-border/45 px-2.5 py-2 dark:border-white/10">
              Chart BR <strong className="text-foreground">{formatPosition(card.positions.BR)}</strong>
            </div>
            <div className="rounded-xl border border-border/45 px-2.5 py-2 dark:border-white/10">
              Chart Global <strong className="text-foreground">{formatPosition(card.positions.GLOBAL)}</strong>
            </div>
          </div>
          <p className="mt-2.5 text-[10px] font-medium leading-4 text-muted-foreground">
            {card.playlistFit?.reason ?? card.reason}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3 dark:border-white/10">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em]",
            card.status === "already_in_playlist"
              ? "bg-sky-400/10 text-sky-700 dark:text-sky-300"
              : card.status === "watch"
                ? "bg-amber-400/10 text-amber-700 dark:text-amber-300"
                : "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
          )}
        >
          <CheckCircle2 className="h-3 w-3" />
          {card.statusLabel}
        </span>
        <span className="text-right text-[10px] font-bold text-muted-foreground">
          {card.suggestedAction}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onTogglePin}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[9px] font-black transition",
            isPinned
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300"
              : "border-border/60 text-muted-foreground hover:text-foreground dark:border-white/10",
          )}
        >
          {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          {isPinned ? "Desafixar" : "Fixar"}
        </button>
        <button
          type="button"
          onClick={onToggleSaved}
          title="Pré-seleção visual desta resposta; não altera o Spotify."
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[9px] font-black transition",
            isSaved
              ? "border-sky-400/25 bg-sky-400/10 text-sky-700 dark:text-sky-300"
              : "border-border/60 text-muted-foreground hover:text-foreground dark:border-white/10",
          )}
        >
          {isSaved ? (
            <BookmarkCheck className="h-3 w-3" />
          ) : (
            <Bookmark className="h-3 w-3" />
          )}
          {isSaved ? "Pré-selecionada" : "Pré-selecionar"}
        </button>
        <button
          type="button"
          onClick={() => setSignalsOpen((current) => !current)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[9px] font-black transition",
            signalsOpen
              ? "border-violet-400/25 bg-violet-400/10 text-violet-700 dark:text-violet-300"
              : "border-border/60 text-muted-foreground hover:text-foreground dark:border-white/10",
          )}
        >
          <BarChart3 className="h-3 w-3" />
          Sinais
        </button>
        <Link
          href="/spotify-charts"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/60 px-2.5 text-[9px] font-black text-muted-foreground transition hover:text-foreground dark:border-white/10"
        >
          <TrendingUp className="h-3 w-3" /> Charts
        </Link>
        {card.spotifyUrl ? (
          <a
            href={card.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:text-foreground dark:border-white/10"
            aria-label={`Abrir ${card.name} no Spotify`}
            title="Abrir no Spotify"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
        <button
          type="button"
          disabled
          title="Ação preparada; nenhuma alteração no Spotify nesta versão."
          className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-full bg-foreground px-2.5 text-[9px] font-black text-background opacity-45"
        >
          <Plus className="h-3 w-3" />
          {card.status === "already_in_playlist" ? "Remover" : "Adicionar"}
        </button>
        <button
          type="button"
          onClick={onIgnore}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-[9px] font-black text-muted-foreground transition hover:bg-rose-400/10 hover:text-rose-700 dark:hover:text-rose-300"
        >
          <EyeOff className="h-3 w-3" /> Ignorar
        </button>
      </div>
    </article>
  );
}

function ConversationRail({
  conversations,
  activeConversationId,
  isBusy,
  isLoading,
  notice,
  onNewConversation,
  onSelectConversation,
}: {
  conversations: PlaylistsAiConversationSummary[];
  activeConversationId: string | null;
  isBusy: boolean;
  isLoading: boolean;
  notice: string | null;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
}) {
  return (
    <aside className="hidden min-h-[780px] flex-col rounded-[28px] border border-border/60 bg-card/45 p-3 dark:border-white/10 dark:bg-white/[0.018] desktop:flex">
      <button
        type="button"
        onClick={onNewConversation}
        disabled={isBusy}
        className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-background/65 px-3 text-xs font-black text-foreground transition hover:border-primary/30 hover:bg-background disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.035]"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Nova conversa
      </button>

      <div className="mt-6 px-2 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        Conversas
      </div>

      <div className="mt-2 max-h-[600px] space-y-1 overflow-y-auto pr-0.5">
        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-[10px] font-semibold text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando histórico...
          </div>
        ) : conversations.length > 0 ? (
          conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelectConversation(conversation.id)}
                disabled={isBusy}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-2xl px-3 py-3 text-left transition disabled:opacity-55",
                  active
                    ? "bg-foreground/[0.075] dark:bg-white/[0.07]"
                    : "hover:bg-foreground/[0.04] dark:hover:bg-white/[0.035]",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl",
                    active
                      ? "bg-foreground text-background"
                      : "border border-border/60 text-muted-foreground dark:border-white/10",
                  )}
                >
                  <Bot className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-foreground">
                    {conversation.title}
                  </span>
                  <span className="mt-0.5 block text-[9px] font-semibold text-muted-foreground">
                    {conversationActivityLabel(conversation.lastMessageAt)}
                  </span>
                </span>
                {active ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                ) : null}
              </button>
            );
          })
        ) : (
          <p className="px-3 py-4 text-[10px] font-medium leading-4 text-muted-foreground">
            {notice ?? "Nenhuma conversa salva ainda."}
          </p>
        )}
      </div>

      <div className="mt-auto rounded-2xl border border-border/55 px-3 py-3 dark:border-white/10">
        <div className="flex items-center gap-2 text-[10px] font-black text-foreground">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          Memória privada
        </div>
        <p className="mt-1.5 text-[9px] font-medium leading-4 text-muted-foreground">
          {notice ??
            "Cada conversa fica salva somente para sua conta neste workspace."}
        </p>
      </div>
    </aside>
  );
}

function DecisionBoard({
  result,
  brief,
  marketFilter,
  onMarketFilterChange,
}: {
  result: PlaylistsAiChatResponse | null;
  brief: PlaylistsAiCurationBrief;
  marketFilter: DecisionMarketFilter;
  onMarketFilterChange: (filter: DecisionMarketFilter) => void;
}) {
  const [pinnedTrackIds, setPinnedTrackIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [savedTrackIds, setSavedTrackIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [ignoredTrackIds, setIgnoredTrackIds] = useState<Set<string>>(
    () => new Set(),
  );
  const resultKey = result?.meta.generatedAt ?? "empty";

  useEffect(() => {
    setPinnedTrackIds(new Set());
    setSavedTrackIds(new Set());
    setIgnoredTrackIds(new Set());
  }, [resultKey]);

  const cards = result?.cards ?? [];
  const cardKey = (card: PlaylistsAiTrackCard) =>
    card.spotifyTrackId ?? card.id;
  const toggleSetValue = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };
  const visibleCards = cards
    .filter((card) => !ignoredTrackIds.has(cardKey(card)))
    .filter((card) => {
      if (marketFilter === "ALL") return true;
      return typeof card.positions[marketFilter] === "number";
    })
    .sort((left, right) => {
      const leftPinned = pinnedTrackIds.has(cardKey(left));
      const rightPinned = pinnedTrackIds.has(cardKey(right));
      return leftPinned === rightPinned ? 0 : leftPinned ? -1 : 1;
    });
  const filters: Array<{ id: DecisionMarketFilter; label: string }> = [
    { id: "ALL", label: "Todos" },
    { id: "BR", label: "Brasil" },
    { id: "GLOBAL", label: "Global" },
  ];

  return (
    <aside className="flex min-h-[680px] flex-col overflow-hidden rounded-[30px] border border-border/65 bg-card/50 dark:border-white/10 dark:bg-white/[0.022] laptop:max-h-[calc(100vh-150px)] laptop:min-h-[780px]">
      <header className="border-b border-border/60 px-5 py-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Decisões vivas
            </div>
            <h2 className="mt-1.5 text-lg font-black tracking-[-0.035em] text-foreground">
              Painel de músicas
            </h2>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
              A seleção acompanha o raciocínio da conversa.
            </p>
            <p className="mt-1 text-[9px] font-semibold text-muted-foreground/75">
              Fixar, ignorar e pré-selecionar afetam somente esta visualização.
            </p>
          </div>
          <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-foreground px-2.5 py-1.5 text-[10px] font-black text-background">
            {cards.length - ignoredTrackIds.size}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/45 p-1 dark:border-white/10 dark:bg-black/10">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => onMarketFilterChange(filter.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[9px] font-black transition",
                  marketFilter === filter.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {result
              ? `Confiança ${result.confidence}%`
              : brief.completeness > 0
                ? `Contexto ${brief.completeness}%`
                : "Aguardando contexto"}
          </div>
        </div>
        {ignoredTrackIds.size > 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-border/50 bg-background/35 px-3 py-2 text-[9px] font-bold text-muted-foreground dark:border-white/10">
            <span>
              {ignoredTrackIds.size} {ignoredTrackIds.size === 1 ? "faixa ignorada" : "faixas ignoradas"} nesta seleção
            </span>
            <button
              type="button"
              onClick={() => setIgnoredTrackIds(new Set())}
              className="font-black text-foreground hover:underline"
            >
              Desfazer
            </button>
          </div>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto p-3.5 tablet:p-4">
        {!result ? (
          <div className="flex min-h-[520px] flex-col items-center justify-center px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-border/60 bg-background/55 text-muted-foreground dark:border-white/10 dark:bg-white/[0.025]">
              <ListMusic className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-base font-black tracking-[-0.03em] text-foreground">
              Primeiro, defina a direção.
            </h3>
            <p className="mt-2 max-w-[300px] text-xs font-medium leading-5 text-muted-foreground">
              {brief.missingFields.length > 0
                ? "A IA está alinhando objetivo e mercado antes de consultar as faixas."
                : "Conforme a conversa evoluir, oportunidades, riscos e faixas para observar aparecerão aqui."}
            </p>
          </div>
        ) : visibleCards.length > 0 ? (
          <div className="space-y-2.5">
            {visibleCards.map((card) => (
              <TrackCard
                key={`${card.id}-${card.statusLabel}`}
                card={card}
                isPinned={pinnedTrackIds.has(cardKey(card))}
                isSaved={savedTrackIds.has(cardKey(card))}
                onTogglePin={() =>
                  toggleSetValue(setPinnedTrackIds, cardKey(card))
                }
                onToggleSaved={() =>
                  toggleSetValue(setSavedTrackIds, cardKey(card))
                }
                onIgnore={() =>
                  setIgnoredTrackIds((current) =>
                    new Set(current).add(cardKey(card)),
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[440px] flex-col items-center justify-center px-8 text-center">
            <Globe2 className="h-6 w-6 text-muted-foreground" />
            <h3 className="mt-4 text-sm font-black text-foreground">
              Nenhuma faixa neste filtro.
            </h3>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Troque o mercado ou refine a conversa.
            </p>
          </div>
        )}
      </div>

      {result ? (
        <footer className="border-t border-border/60 px-4 py-3 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <Database className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            {result.dataSources.slice(0, 4).map((dataSource) => (
              <span
                key={`${dataSource.id}-${dataSource.detail}`}
                title={dataSource.detail}
                className={cn(
                  "rounded-full px-2 py-1 text-[8px] font-black",
                  dataSource.status === "used"
                    ? "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted/60 text-muted-foreground",
                )}
              >
                {dataSource.label}
              </span>
            ))}
          </div>
        </footer>
      ) : null}
    </aside>
  );
}

function ResponseDetails({ result }: { result: PlaylistsAiChatResponse }) {
  return (
    <div className="mt-3 space-y-2.5 border-t border-border/55 pt-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2 text-[9px] font-black text-muted-foreground">
        {result.meta.mode === "question" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-400/10 px-2.5 py-1.5 text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3 w-3" /> Alinhando contexto
          </span>
        ) : null}
        {result.cards.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1.5 text-emerald-700 dark:text-emerald-300">
            <ListMusic className="h-3 w-3" />
            {result.cards.length}{" "}
            {result.cards.length === 1 ? "faixa" : "faixas"} no painel
          </span>
        ) : null}
        <span className="rounded-full bg-muted/55 px-2.5 py-1.5">
          Confiança {result.confidence}%
        </span>
        {result.dataSources
          .filter((dataSource) => dataSource.status === "used")
          .slice(0, 2)
          .map((dataSource) => (
            <span
              key={`${dataSource.id}-${dataSource.detail}`}
              title={dataSource.detail}
              className="rounded-full bg-muted/55 px-2.5 py-1.5"
            >
              {dataSource.label}
            </span>
          ))}
      </div>

      {result.actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {result.actions.map((preparedAction) => {
            const Icon = ACTION_ICONS[preparedAction.type];
            return (
              <button
                key={preparedAction.id}
                type="button"
                disabled
                title={preparedAction.description}
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1.5 text-[9px] font-black text-muted-foreground opacity-75 dark:border-white/10"
              >
                <Icon className="h-3 w-3" />
                {preparedAction.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const assistant = message.role === "assistant";
  return (
    <article
      className={cn(
        "flex gap-3",
        assistant ? "items-start" : "items-start justify-end",
      )}
    >
      {assistant ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-700 shadow-sm dark:text-emerald-300">
          <Bot className="h-4 w-4" />
        </div>
      ) : null}

      <div
        className={cn(
          "max-w-[min(100%,920px)] rounded-[24px] px-4 py-3.5",
          assistant
            ? "border border-border/70 bg-background/70 text-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.035]"
            : "bg-foreground text-background",
        )}
      >
        <p className="whitespace-pre-wrap text-sm font-medium leading-6">
          {message.content}
        </p>
        {message.result ? <ResponseDetails result={message.result} /> : null}
      </div>

      {!assistant ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background">
          <UserRound className="h-4 w-4" />
        </div>
      ) : null}
    </article>
  );
}

export default function PlaylistsAiWorkbench() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [savedConversations, setSavedConversations] = useState<
    PlaylistsAiConversationSummary[]
  >([]);
  const [conversationNotice, setConversationNotice] = useState<string | null>(
    null,
  );
  const [conversationTitle, setConversationTitle] = useState("Nova curadoria");
  const [decisionResult, setDecisionResult] =
    useState<PlaylistsAiChatResponse | null>(null);
  const [curationBrief, setCurationBrief] =
    useState<PlaylistsAiCurationBrief>(createEmptyBrief);
  const [marketFilter, setMarketFilter] = useState<DecisionMarketFilter>("ALL");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/playlists-ia/conversations", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | {
              success?: boolean;
              conversations?: PlaylistsAiConversationSummary[];
              message?: string;
            }
          | null;
        if (!response.ok || !payload?.success) {
          throw new Error(
            payload?.message ?? "Histórico temporariamente indisponível.",
          );
        }
        if (mounted) {
          setSavedConversations(payload.conversations ?? []);
          setConversationNotice(null);
        }
      })
      .catch((error) => {
        if (mounted) {
          setConversationNotice(
            error instanceof Error
              ? error.message
              : "Histórico temporariamente indisponível.",
          );
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingConversations(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  function upsertConversation(conversation: PlaylistsAiConversationSummary) {
    setSavedConversations((current) => [
      conversation,
      ...current.filter((item) => item.id !== conversation.id),
    ]);
  }

  async function selectConversation(conversationId: string) {
    if (
      isThinking ||
      isLoadingConversation ||
      conversationId === activeConversationId
    )
      return;

    setIsLoadingConversation(true);
    setConversationNotice(null);
    try {
      const response = await fetch(
        `/api/playlists-ia/conversations/${encodeURIComponent(conversationId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            conversation?: PlaylistsAiConversationDetail;
            message?: string;
          }
        | null;
      if (!response.ok || !payload?.success || !payload.conversation) {
        throw new Error(payload?.message ?? "Não foi possível abrir a conversa.");
      }

      const conversation = payload.conversation;
      setActiveConversationId(conversation.id);
      setConversationTitle(conversation.title);
      setMessages(
        conversation.messages.length > 0
          ? conversation.messages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              result: message.result ?? undefined,
            }))
          : [WELCOME_MESSAGE],
      );
      setCurationBrief(conversation.brief);
      setDecisionResult(conversation.latestResponse);
      setMarketFilter("ALL");
      upsertConversation(conversation);
    } catch (error) {
      setConversationNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a conversa.",
      );
    } finally {
      setIsLoadingConversation(false);
    }
  }

  async function submitMessage(value: string) {
    const cleanMessage = value.trim();
    if (!cleanMessage || isThinking || isLoadingConversation) return;

    const userMessage: ChatMessage = {
      id: newId("user"),
      role: "user",
      content: cleanMessage,
    };
    const history = messages
      .filter((message) => message.id !== WELCOME_MESSAGE.id)
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));

    setMessages((current) => [...current, userMessage]);
    if (messages.length === 1) {
      setConversationTitle(
        cleanMessage.length > 34
          ? `${cleanMessage.slice(0, 34).trim()}…`
          : cleanMessage,
      );
    }
    setInput("");
    setIsThinking(true);

    try {
      const response = await fetch("/api/playlists-ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: cleanMessage,
          messages: history,
          brief: curationBrief,
          conversationId: activeConversationId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (PlaylistsAiChatApiResponse & { success?: true })
        | { success?: false; message?: string }
        | null;

      if (!response.ok || !payload || !("text" in payload)) {
        throw new Error(
          payload && "message" in payload && payload.message
            ? payload.message
            : "Não foi possível consultar a inteligência agora.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          id: newId("assistant"),
          role: "assistant",
          content: payload.text,
          result: payload,
        },
      ]);
      setActiveConversationId(payload.conversation.id);
      setConversationTitle(payload.conversation.title);
      upsertConversation(payload.conversation);
      setCurationBrief(payload.brief);
      if (payload.cards.length > 0) {
        setDecisionResult(payload);
        setMarketFilter("ALL");
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: newId("assistant"),
          role: "assistant",
          content:
            error instanceof Error
              ? `${error.message} Nenhuma alteração foi executada.`
              : "Não consegui consultar os dados agora. Nenhuma alteração foi executada.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function startNewConversation() {
    if (isThinking || isLoadingConversation) return;
    setActiveConversationId(null);
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setConversationTitle("Nova curadoria");
    setDecisionResult(null);
    setCurationBrief(createEmptyBrief());
    setMarketFilter("ALL");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(input);
    }
  }

  return (
    <div className="mx-auto grid max-w-[1760px] gap-3 laptop:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] desktop:grid-cols-[210px_minmax(0,0.92fr)_minmax(430px,1.08fr)]">
      <ConversationRail
        conversations={savedConversations}
        activeConversationId={activeConversationId}
        isBusy={isThinking || isLoadingConversation}
        isLoading={isLoadingConversations}
        notice={conversationNotice}
        onNewConversation={startNewConversation}
        onSelectConversation={(conversationId) =>
          void selectConversation(conversationId)
        }
      />

      <section className="flex min-h-[720px] flex-col overflow-hidden rounded-[30px] border border-border/65 bg-card/50 dark:border-white/10 dark:bg-white/[0.022] laptop:max-h-[calc(100vh-150px)] laptop:min-h-[780px]">
        <header className="border-b border-border/60 px-5 py-4 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[15px] bg-foreground text-background">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-black tracking-[-0.025em] text-foreground">
                  {conversationTitle}
                </h1>
                <p className="text-[10px] font-medium text-muted-foreground">
                  Copiloto de curadoria musical
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300 tablet:inline-flex">
                <LockKeyhole className="h-3 w-3" /> Planejamento seguro
              </span>
              <button
                type="button"
                onClick={startNewConversation}
                disabled={isThinking || isLoadingConversation}
                aria-label="Iniciar nova conversa"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/65 text-muted-foreground transition hover:text-foreground disabled:opacity-50 dark:border-white/10 desktop:hidden"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {briefChips(curationBrief).map((item) => (
              <span
                key={item}
                className="rounded-full bg-muted/45 px-2.5 py-1 text-[8px] font-black text-muted-foreground"
              >
                {item}
              </span>
            ))}
            <span className="rounded-full border border-border/55 px-2.5 py-1 text-[8px] font-black text-muted-foreground dark:border-white/10">
              Contexto {curationBrief.completeness}%
            </span>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {activeConversationId === null && messages.length === 1 ? (
            <div className="ml-12 space-y-2">
              <div className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                Comece por uma decisão
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.slice(0, 4).map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void submitMessage(question)}
                    disabled={isThinking || isLoadingConversation}
                    className="rounded-full border border-border/60 bg-background/35 px-3 py-2 text-left text-[9px] font-bold text-muted-foreground transition hover:border-primary/25 hover:text-foreground disabled:opacity-50 dark:border-white/10"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {isThinking ? (
            <article className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-700 dark:text-emerald-300">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-[20px] border border-border/60 bg-background/45 px-4 py-3 text-xs font-semibold text-muted-foreground dark:border-white/10 dark:bg-white/[0.025]">
                <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
                entendendo o contexto e cruzando os sinais...
              </div>
            </article>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-border/60 p-3.5 dark:border-white/10 tablet:p-4"
        >
          <div className="rounded-[22px] border border-border/75 bg-background/65 p-2 transition focus-within:border-primary/35 dark:border-white/10 dark:bg-black/15">
            <textarea
              value={input}
              disabled={isLoadingConversation}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={1600}
              rows={2}
              placeholder="Converse sobre o objetivo, a estratégia ou uma decisão de curadoria..."
              className="min-h-[62px] w-full resize-none bg-transparent px-3 py-2 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <div className="flex items-center justify-between gap-3 px-2 pt-1">
              <p className="text-[9px] font-semibold text-muted-foreground">
                Enter envia · Shift + Enter quebra linha
              </p>
              <button
                type="submit"
                disabled={
                  !input.trim() || isThinking || isLoadingConversation
                }
                className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-[10px] font-black text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isThinking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Enviar
              </button>
            </div>
          </div>
        </form>
      </section>

      <DecisionBoard
        result={decisionResult}
        brief={curationBrief}
        marketFilter={marketFilter}
        onMarketFilterChange={setMarketFilter}
      />
    </div>
  );
}
