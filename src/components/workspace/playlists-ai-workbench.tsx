"use client";

import {
  ArrowUpDown,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Bot,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Globe2,
  History,
  ListMusic,
  Loader2,
  MapPin,
  Menu,
  MessageSquarePlus,
  Music2,
  PanelLeftClose,
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
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import SpotifyPlaylistAddButton from "@/components/workspace/spotify-playlist-add-button";
import {
  type PlaylistsAiFeedbackDeliveryState,
  sendPlaylistsAiFeedback,
} from "@/lib/playlists-ai-feedback-client";
import {
  appendVoiceTranscript,
  speechInputErrorMessage,
} from "@/lib/playlists-ai-voice";
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

const SUGGESTED_PROMPTS = [
  "Descubra 15 faixas novas de trap pouco saturadas no Brasil",
  "Quais músicas de funk estão crescendo e ainda não estão nas minhas playlists?",
  "Sugira 10 faixas para renovar uma playlist minha",
  "Quais oportunidades globais apareceram nos charts?",
] as const;

const MessageResponse = dynamic(
  () =>
    import("@/components/ai-elements/message").then(
      (module) => module.MessageResponse,
    ),
  {
    loading: () => (
      <span className="text-sm text-muted-foreground">
        Formatando resposta…
      </span>
    ),
  },
);

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

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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

function TrackRow({
  card,
  rank,
  isPinned,
  isSaved,
  onTogglePin,
  onToggleSaved,
  onIgnore,
  onAdded,
}: {
  card: PlaylistsAiTrackCard;
  rank: number;
  isPinned: boolean;
  isSaved: boolean;
  onTogglePin: () => void;
  onToggleSaved: () => void;
  onIgnore: () => void;
  onAdded: (targetPlaylistId: string, alreadyExists: boolean) => void;
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
        "group border-b border-border/45 transition last:border-b-0 hover:bg-muted/25 dark:border-white/[0.07] dark:hover:bg-white/[0.025]",
        isPinned ? "bg-emerald-400/[0.045] dark:bg-emerald-400/[0.035]" : "",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5 px-2 py-3">
        <span className="w-5 shrink-0 text-right text-[10px] font-semibold tabular-nums text-muted-foreground/70">
          {rank}
        </span>

        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
          {card.coverUrl ? (
            <Image
              src={card.coverUrl}
              alt=""
              fill
              sizes="44px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-400/25 to-sky-400/20 text-muted-foreground">
              <Music2 className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[13px] font-semibold tracking-[-0.015em] text-foreground">
            {card.name}
          </h4>
          <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
            {card.artists}
          </p>

          <div className="mt-1.5 flex min-w-0 items-center gap-2 overflow-hidden text-[9px] font-semibold text-muted-foreground">
            {genreProfile ? (
              <span
                title={`Confiança ${genreProfile.confidenceLabel}: ${genreProfile.genreConfidence}%${genreProfile.manualOverride ? " · correção manual" : ""}`}
                className="shrink-0 text-violet-700 dark:text-violet-300"
              >
                {genreProfile.label}
              </span>
            ) : null}
            {typeof card.positions.BR === "number" ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <MapPin className="h-2.5 w-2.5" /> BR{" "}
                {formatPosition(card.positions.BR)}
              </span>
            ) : null}
            {typeof card.positions.GLOBAL === "number" ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <Globe2 className="h-2.5 w-2.5" /> Global{" "}
                {formatPosition(card.positions.GLOBAL)}
              </span>
            ) : null}
            {card.historicalMetrics ? (
              <span className="inline-flex min-w-0 items-center gap-1 truncate text-sky-700 dark:text-sky-300">
                <History className="h-2.5 w-2.5 shrink-0" />
                {card.historicalMetrics.chartDays}/
                {card.historicalMetrics.windowDays}d ·{" "}
                {formatCompactNumber(card.historicalMetrics.totalStreams)}
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1",
                  (card.movement7d ?? 0) > 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : (card.movement7d ?? 0) < 0
                      ? "text-rose-700 dark:text-rose-300"
                      : "text-muted-foreground",
                )}
              >
                <MovementIcon value={card.movement7d} />
                {movementLabel(card.movement7d)}
              </span>
            )}
          </div>
        </div>

        {card.opportunityScore !== null ? (
          <div className="w-8 shrink-0 text-center">
            <div className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {card.opportunityScore}
            </div>
            <div className="text-[7px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              score
            </div>
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setSignalsOpen((current) => !current)}
            title="Ver sinais e ações"
            aria-label="Ver sinais e ações"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground",
              signalsOpen && "bg-muted text-foreground",
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
          <SpotifyPlaylistAddButton
            spotifyTrackId={card.spotifyTrackId}
            suggestedPlaylistName={card.playlistNames[0] ?? null}
            source="playlists_ai_selection"
            label="Adicionar"
            ariaLabel={`Adicionar ${card.name} a uma playlist`}
            className="h-8 rounded-full bg-foreground px-3 text-[10px] font-semibold text-background shadow-none hover:bg-foreground/85"
            onAddSuccess={({ playlistId, alreadyExists }) => {
              onAdded(playlistId, alreadyExists);
            }}
          />
        </div>
      </div>

      {genreEditorOpen ? (
        <div className="mx-9 mb-3 rounded-xl border border-violet-400/20 bg-violet-400/[0.055] p-3">
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
        <div className="mx-9 mb-3 rounded-xl border border-border/55 bg-muted/[0.18] p-3 dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-[11px] font-medium leading-5 text-muted-foreground">
            {card.playlistFit?.reason ?? card.reason}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.07em]",
                card.status === "already_in_playlist"
                  ? "bg-sky-400/10 text-sky-700 dark:text-sky-300"
                  : card.status === "watch"
                    ? "bg-amber-400/10 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {card.statusLabel}
            </span>
            <button
              type="button"
              onClick={onTogglePin}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[9px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {isPinned ? (
                <PinOff className="h-3 w-3" />
              ) : (
                <Pin className="h-3 w-3" />
              )}
              {isPinned ? "Desafixar" : "Fixar"}
            </button>
            <button
              type="button"
              onClick={onToggleSaved}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[9px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {isSaved ? (
                <BookmarkCheck className="h-3 w-3" />
              ) : (
                <Bookmark className="h-3 w-3" />
              )}
              {isSaved ? "Salva" : "Salvar"}
            </button>
            {card.spotifyTrackId ? (
              <button
                type="button"
                disabled={genreBusy}
                onClick={() => setGenreEditorOpen((current) => !current)}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[9px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {genreBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Tags className="h-3 w-3" />
                )}
                Gênero
              </button>
            ) : null}
            <Link
              href="/spotify-charts"
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[9px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <TrendingUp className="h-3 w-3" /> Charts
            </Link>
            {card.spotifyUrl ? (
              <a
                href={card.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[9px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" /> Spotify
              </a>
            ) : null}
            <button
              type="button"
              onClick={onIgnore}
              className="ml-auto inline-flex h-7 items-center gap-1 rounded-full px-2 text-[9px] font-semibold text-muted-foreground hover:bg-rose-400/10 hover:text-rose-600"
            >
              <EyeOff className="h-3 w-3" /> Ignorar
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function conversationProjectLabel(
  conversation: PlaylistsAiConversationSummary,
) {
  if (conversation.brief.playlistName) return conversation.brief.playlistName;
  if (conversation.brief.genre) return conversation.brief.genre;
  return "Geral";
}

function ConversationRail({
  conversations,
  activeConversationId,
  deletingConversationId,
  isBusy,
  isLoading,
  notice,
  onClose,
  onDeleteConversation,
  onNewConversation,
  onSelectConversation,
}: {
  conversations: PlaylistsAiConversationSummary[];
  activeConversationId: string | null;
  deletingConversationId: string | null;
  isBusy: boolean;
  isLoading: boolean;
  notice: string | null;
  onClose: () => void;
  onDeleteConversation: (conversation: PlaylistsAiConversationSummary) => void;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
}) {
  const projects = conversations.reduce<
    Array<{ label: string; conversations: PlaylistsAiConversationSummary[] }>
  >((groups, conversation) => {
    const label = conversationProjectLabel(conversation);
    const project = groups.find((group) => group.label === label);
    if (project) project.conversations.push(conversation);
    else groups.push({ label, conversations: [conversation] });
    return groups;
  }, []);

  return (
    <aside className="flex h-full min-h-0 w-[272px] shrink-0 flex-col border-r border-border/45 bg-background/80 px-2.5 py-2 backdrop-blur-xl dark:border-white/[0.07]">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onNewConversation}
          disabled={isBusy}
          className="flex h-10 flex-1 items-center gap-2 rounded-xl px-2.5 text-xs font-bold text-foreground transition hover:bg-muted/55 disabled:opacity-50"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Nova conversa
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/55 hover:text-foreground"
          aria-label="Ocultar conversas"
          title="Ocultar conversas"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-1 pb-4">
        {isLoading ? (
          <div className="flex items-center gap-2 px-2 py-4 text-[11px] font-medium text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando...
          </div>
        ) : projects.length > 0 ? (
          <div className="space-y-5">
            {projects.map((project) => (
              <section key={project.label}>
                <div className="flex items-center gap-2 px-2 text-[10px] font-semibold text-muted-foreground">
                  <Folder className="h-3.5 w-3.5" />
                  <span className="truncate">{project.label}</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {project.conversations.map((conversation) => {
                    const active = conversation.id === activeConversationId;
                    const deleting = conversation.id === deletingConversationId;
                    return (
                      <div
                        key={conversation.id}
                        className={cn(
                          "group flex items-center rounded-xl transition",
                          active
                            ? "bg-muted/70 dark:bg-white/[0.065]"
                            : "hover:bg-muted/45 dark:hover:bg-white/[0.035]",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectConversation(conversation.id)}
                          disabled={isBusy}
                          className="min-w-0 flex-1 px-2.5 py-2 text-left disabled:opacity-55"
                        >
                          <span className="block truncate text-[12px] font-medium text-foreground">
                            {conversation.title}
                          </span>
                          <span className="mt-0.5 block text-[9px] text-muted-foreground">
                            {conversationActivityLabel(
                              conversation.lastMessageAt,
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteConversation(conversation)}
                          disabled={isBusy || deleting}
                          className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-rose-500/10 hover:text-rose-600 focus:opacity-100 disabled:opacity-50 group-hover:opacity-100 dark:hover:text-rose-300"
                          aria-label={`Apagar ${conversation.title}`}
                          title="Apagar conversa"
                        >
                          {deleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="px-2 py-4 text-[11px] font-medium leading-5 text-muted-foreground">
            {notice ?? "As conversas aparecerão aqui por projeto."}
          </p>
        )}
      </div>

      <p className="px-3 pb-2 text-[9px] leading-4 text-muted-foreground/70">
        Histórico privado deste workspace.
      </p>
    </aside>
  );
}

function DecisionBoard({
  result,
  marketFilter,
  onClose,
  onMarketFilterChange,
}: {
  result: PlaylistsAiChatResponse;
  marketFilter: DecisionMarketFilter;
  onClose: () => void;
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
  const feedbackDeliveryStatesRef = useRef(
    new Map<string, PlaylistsAiFeedbackDeliveryState>(),
  );
  const resultKey = result.meta.generatedAt;

  useEffect(() => {
    setPinnedTrackIds(new Set());
    setSavedTrackIds(new Set());
    setIgnoredTrackIds(new Set());
    feedbackDeliveryStatesRef.current.clear();
  }, [resultKey]);

  const cards = result.cards;
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
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-background/95 desktop:border-l desktop:border-border/45 desktop:bg-background/45 desktop:dark:border-white/[0.07]">
      <header className="border-b border-border/45 px-4 py-3 dark:border-white/[0.07]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">
              Seleção
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-foreground px-2.5 py-1.5 text-[10px] font-black text-background">
              {cards.length - ignoredTrackIds.size}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Fechar seleção"
              title="Fechar seleção"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
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
            Confiança {result.confidence}%
          </div>
        </div>
        {ignoredTrackIds.size > 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-border/50 bg-background/35 px-3 py-2 text-[9px] font-bold text-muted-foreground dark:border-white/10">
            <span>
              {ignoredTrackIds.size}{" "}
              {ignoredTrackIds.size === 1
                ? "faixa ignorada"
                : "faixas ignoradas"}{" "}
              nesta seleção
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

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {visibleCards.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border/45 dark:border-white/[0.07]">
            {visibleCards.map((card, index) => (
              <TrackRow
                key={`${card.id}-${card.statusLabel}`}
                card={card}
                rank={index + 1}
                isPinned={pinnedTrackIds.has(cardKey(card))}
                isSaved={savedTrackIds.has(cardKey(card))}
                onTogglePin={() => {
                  const key = cardKey(card);
                  const willPin = !pinnedTrackIds.has(key);
                  toggleSetValue(setPinnedTrackIds, key);
                  if (willPin)
                    void sendPlaylistsAiFeedback(
                      card,
                      "pin",
                      feedbackDeliveryStatesRef.current,
                    );
                }}
                onToggleSaved={() => {
                  const key = cardKey(card);
                  const willSave = !savedTrackIds.has(key);
                  toggleSetValue(setSavedTrackIds, key);
                  if (willSave)
                    void sendPlaylistsAiFeedback(
                      card,
                      "save",
                      feedbackDeliveryStatesRef.current,
                    );
                }}
                onIgnore={() => {
                  void sendPlaylistsAiFeedback(
                    card,
                    "ignore",
                    feedbackDeliveryStatesRef.current,
                  );
                  setIgnoredTrackIds((current) =>
                    new Set(current).add(cardKey(card)),
                  );
                }}
                onAdded={(targetPlaylistId, alreadyExists) =>
                  void sendPlaylistsAiFeedback(
                    card,
                    "add",
                    feedbackDeliveryStatesRef.current,
                    targetPlaylistId,
                    alreadyExists,
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

      <footer className="border-t border-border/50 px-4 py-2.5 dark:border-white/[0.07]">
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
    </aside>
  );
}

function rankingDisplay(result: PlaylistsAiChatResponse) {
  const ranking = result.meta.ranking;
  if (!ranking) return null;

  if (
    ranking.provider === "python" &&
    ranking.status === "ranked" &&
    ranking.personalized
  ) {
    return {
      label: "Ranking personalizado",
      detail: `Aprendeu com os feedbacks deste workspace${ranking.modelVersion ? ` · ${ranking.modelVersion}` : ""}.`,
      className: "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (
    ranking.provider === "python" &&
    ranking.status === "ranked" &&
    ranking.coldStart
  ) {
    return {
      label: "Aprendendo preferências",
      detail: "Ainda há pouco feedback para personalização completa.",
      className: "bg-amber-400/10 text-amber-700 dark:text-amber-300",
    };
  }
  if (ranking.provider === "python" && ranking.status === "ranked") {
    return {
      label: "Ranking inteligente",
      detail: "Ordenação produzida pelo agente Python.",
      className: "bg-violet-400/10 text-violet-700 dark:text-violet-300",
    };
  }
  return {
    label: "Ranking base",
    detail: "Seleção segura baseada nos sinais disponíveis.",
    className: "bg-muted/55 text-muted-foreground",
  };
}

function ResponseDetails({
  result,
  onOpenDecisionPanel,
}: {
  result: PlaylistsAiChatResponse;
  onOpenDecisionPanel: (result: PlaylistsAiChatResponse) => void;
}) {
  const ranking = rankingDisplay(result);
  return (
    <div className="mt-3 space-y-2.5 border-t border-border/55 pt-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2 text-[9px] font-black text-muted-foreground">
        {result.meta.mode === "question" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-400/10 px-2.5 py-1.5 text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3 w-3" /> Alinhando contexto
          </span>
        ) : null}
        {result.cards.length > 0 ? (
          <button
            type="button"
            onClick={() => onOpenDecisionPanel(result)}
            aria-label={`Abrir seleção com ${result.cards.length} ${result.cards.length === 1 ? "faixa" : "faixas"}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1.5 text-emerald-700 transition hover:bg-emerald-400/20 dark:text-emerald-300"
          >
            <ListMusic className="h-3 w-3" />
            Ver {result.cards.length}{" "}
            {result.cards.length === 1 ? "faixa" : "faixas"}
          </button>
        ) : null}
        <span className="rounded-full bg-muted/55 px-2.5 py-1.5">
          Confiança dos sinais {result.confidence}%
        </span>
        {ranking ? (
          <span
            title={ranking.detail}
            className={cn("rounded-full px-2.5 py-1.5", ranking.className)}
          >
            {ranking.label}
          </span>
        ) : null}
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

function MessageBubble({
  message,
  onOpenDecisionPanel,
}: {
  message: ChatMessage;
  onOpenDecisionPanel: (result: PlaylistsAiChatResponse) => void;
}) {
  const assistant = message.role === "assistant";
  return (
    <article
      className={cn(
        "flex gap-3",
        assistant ? "items-start" : "items-start justify-end",
      )}
    >
      {assistant ? (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-700 dark:text-emerald-300">
          <Bot className="h-3.5 w-3.5" />
        </div>
      ) : null}

      <div
        className={cn(
          "max-w-[min(100%,760px)] px-1 py-1.5",
          assistant
            ? "text-foreground"
            : "rounded-[20px] bg-muted/80 px-4 text-foreground dark:bg-white/[0.075]",
        )}
      >
        {assistant ? (
          <MessageResponse className="text-sm font-medium leading-6">
            {message.content}
          </MessageResponse>
        ) : (
          <p className="whitespace-pre-wrap text-sm font-medium leading-6">
            {message.content}
          </p>
        )}
        {message.result ? (
          <ResponseDetails
            result={message.result}
            onOpenDecisionPanel={onOpenDecisionPanel}
          />
        ) : null}
      </div>
    </article>
  );
}

function ChatComposer({
  input,
  isBusy,
  onChange,
  onKeyDown,
  onSubmit,
}: {
  input: string;
  isBusy: boolean;
  onChange: Dispatch<SetStateAction<string>>;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceStartedRef = useRef(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [input]);

  useEffect(() => {
    if (!isBusy) textareaRef.current?.focus();
  }, [isBusy]);

  function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    if (voiceListening) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  }

  return (
    <form onSubmit={handleComposerSubmit} className="w-full">
      <div className="flex items-end gap-2 rounded-[26px] border border-border/70 bg-background px-3 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.08)] transition focus-within:border-foreground/25 dark:border-white/10 dark:bg-[#202123]">
        <textarea
          id="playlists-ai-message"
          ref={textareaRef}
          value={input}
          disabled={isBusy}
          readOnly={voiceListening}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (voiceListening && event.key === "Enter") {
              event.preventDefault();
              return;
            }
            onKeyDown(event);
          }}
          maxLength={1600}
          rows={1}
          aria-label="Mensagem para o Playlists IA"
          placeholder="Pergunte sobre músicas, playlists ou uma decisão..."
          className="max-h-36 min-h-11 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/65"
        />
        <SpeechInput
          lang="pt-BR"
          size="icon"
          disabled={isBusy}
          aria-label="Ditar mensagem em português"
          title="Ditar mensagem em português"
          className="mb-1 shrink-0"
          onListeningChange={(listening) => {
            const wasListening = voiceStartedRef.current;
            voiceStartedRef.current = listening;
            setVoiceListening(listening);
            if (listening) {
              setVoiceStatus(
                "Ouvindo em português… clique novamente para parar.",
              );
            } else if (wasListening) {
              setVoiceStatus(
                "Ditado finalizado. Revise o texto antes de enviar.",
              );
            }
          }}
          onTranscriptionChange={(transcript) => {
            onChange((current) => appendVoiceTranscript(current, transcript));
            setVoiceStatus("Trecho de voz adicionado. Revise antes de enviar.");
            requestAnimationFrame(() => textareaRef.current?.focus());
          }}
          onError={(errorCode) => {
            voiceStartedRef.current = false;
            setVoiceListening(false);
            setVoiceStatus(speechInputErrorMessage(errorCode));
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isBusy || voiceListening}
          className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-25"
          aria-label="Enviar"
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      <p
        className="mt-2 min-h-4 text-center text-[9px] text-muted-foreground/65"
        role="status"
        aria-live="polite"
      >
        {voiceStatus ??
          "A IA cruza dados reais e não altera o Spotify sem sua confirmação."}
      </p>
    </form>
  );
}

export default function PlaylistsAiWorkbench() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [conversationRailOpen, setConversationRailOpen] = useState(false);
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
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);
  const [decisionResult, setDecisionResult] =
    useState<PlaylistsAiChatResponse | null>(null);
  const [decisionPanelOpen, setDecisionPanelOpen] = useState(false);
  const [curationBrief, setCurationBrief] =
    useState<PlaylistsAiCurationBrief>(createEmptyBrief);
  const [marketFilter, setMarketFilter] = useState<DecisionMarketFilter>("ALL");

  useEffect(() => {
    setConversationRailOpen(
      window.localStorage.getItem("playlists-ai-history") === "open",
    );
  }, []);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/playlists-ia/conversations", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          conversations?: PlaylistsAiConversationSummary[];
          message?: string;
        } | null;
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

  function upsertConversation(conversation: PlaylistsAiConversationSummary) {
    setSavedConversations((current) => [
      conversation,
      ...current.filter((item) => item.id !== conversation.id),
    ]);
  }

  function setHistoryOpen(open: boolean) {
    setConversationRailOpen(open);
    window.localStorage.setItem(
      "playlists-ai-history",
      open ? "open" : "closed",
    );
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
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        conversation?: PlaylistsAiConversationDetail;
        message?: string;
      } | null;
      if (!response.ok || !payload?.success || !payload.conversation) {
        throw new Error(
          payload?.message ?? "Não foi possível abrir a conversa.",
        );
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
      setDecisionPanelOpen(Boolean(conversation.latestResponse?.cards.length));
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

  async function deleteConversation(
    conversation: PlaylistsAiConversationSummary,
  ) {
    if (isThinking || isLoadingConversation || deletingConversationId) return;
    const confirmed = window.confirm(
      `Apagar a conversa “${conversation.title}”? Ela sairá do seu histórico.`,
    );
    if (!confirmed) return;

    setDeletingConversationId(conversation.id);
    setConversationNotice(null);
    try {
      const response = await fetch(
        `/api/playlists-ia/conversations/${encodeURIComponent(conversation.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.message ?? "Não foi possível apagar a conversa.",
        );
      }

      setSavedConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );
      if (conversation.id === activeConversationId) startNewConversation();
    } catch (error) {
      setConversationNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível apagar a conversa.",
      );
    } finally {
      setDeletingConversationId(null);
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
        setDecisionPanelOpen(true);
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
    setDecisionPanelOpen(false);
    setCurationBrief(createEmptyBrief());
    setMarketFilter("ALL");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void submitMessage(input);
    }
  }

  function openDecisionPanel(result?: PlaylistsAiChatResponse) {
    const nextResult = result ?? decisionResult;
    if (!nextResult?.cards.length) return;

    if (nextResult.meta.generatedAt !== decisionResult?.meta.generatedAt) {
      setDecisionResult(nextResult);
      setMarketFilter("ALL");
    }
    setDecisionPanelOpen(true);
  }

  const isBusy = isThinking || isLoadingConversation;
  const freshConversation =
    activeConversationId === null &&
    messages.length === 1 &&
    messages[0]?.id === WELCOME_MESSAGE.id;
  const visibleMessages = messages.filter(
    (message) => message.id !== WELCOME_MESSAGE.id,
  );
  const hasDecisionResult = Boolean(decisionResult?.cards.length);
  const showDecisionPanel = hasDecisionResult && decisionPanelOpen;

  return (
    <div className="relative mx-auto flex h-full min-h-0 max-w-[1760px] overflow-hidden bg-background">
      {conversationRailOpen ? (
        <>
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            className="absolute inset-0 z-30 bg-black/35 backdrop-blur-[2px] desktop:hidden"
            aria-label="Fechar histórico"
          />
          <div className="absolute inset-y-0 left-0 z-40 desktop:static desktop:z-auto">
            <ConversationRail
              conversations={savedConversations}
              activeConversationId={activeConversationId}
              deletingConversationId={deletingConversationId}
              isBusy={isBusy}
              isLoading={isLoadingConversations}
              notice={conversationNotice}
              onClose={() => setHistoryOpen(false)}
              onDeleteConversation={(conversation) =>
                void deleteConversation(conversation)
              }
              onNewConversation={startNewConversation}
              onSelectConversation={(conversationId) =>
                void selectConversation(conversationId)
              }
            />
          </div>
        </>
      ) : null}

      <section className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between px-3 tablet:px-5">
          <div className="flex min-w-0 items-center gap-1.5">
            {!conversationRailOpen ? (
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/55 hover:text-foreground"
                aria-label="Mostrar conversas"
                title="Mostrar conversas"
              >
                <Menu className="h-[18px] w-[18px]" />
              </button>
            ) : null}
            {!freshConversation ? (
              <h1 className="truncate px-2 text-xs font-semibold text-foreground">
                {conversationTitle}
              </h1>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {hasDecisionResult && !decisionPanelOpen ? (
              <button
                type="button"
                onClick={() => openDecisionPanel()}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/55 hover:text-foreground"
                aria-label="Reabrir seleção de músicas"
                title="Reabrir seleção"
              >
                <ListMusic className="h-[18px] w-[18px]" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={startNewConversation}
              disabled={isBusy}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/55 hover:text-foreground disabled:opacity-40"
              aria-label="Nova conversa"
              title="Nova conversa"
            >
              <MessageSquarePlus className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        {freshConversation ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 pb-16">
            <div className="w-full max-w-[760px]">
              <div className="mb-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
                  <Bot className="h-[18px] w-[18px]" />
                </div>
                <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-foreground tablet:text-[30px]">
                  O que vamos decidir hoje?
                </h1>
                <p className="mx-auto mt-2 max-w-[520px] text-sm text-muted-foreground">
                  Converse naturalmente. As músicas e ações só aparecem quando
                  forem relevantes para a decisão.
                </p>
              </div>
              <ChatComposer
                key="new-conversation"
                input={input}
                isBusy={isBusy}
                onChange={setInput}
                onKeyDown={handleKeyDown}
                onSubmit={handleSubmit}
              />
              <Suggestions className="mt-4 pb-1">
                {SUGGESTED_PROMPTS.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={(value) => {
                      setInput(value);
                      requestAnimationFrame(() =>
                        document
                          .getElementById("playlists-ai-message")
                          ?.focus(),
                      );
                    }}
                    className="border-border/60 bg-background/65 text-[11px] text-muted-foreground hover:text-foreground"
                  />
                ))}
              </Suggestions>
            </div>
          </div>
        ) : (
          <>
            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="mx-auto w-full max-w-[844px] gap-7 px-4 py-6 tablet:px-8">
                {visibleMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onOpenDecisionPanel={openDecisionPanel}
                  />
                ))}

                {isThinking ? (
                  <article
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-700 dark:text-emerald-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                    </div>
                    Cruzando contexto, histórico e sinais...
                  </article>
                ) : null}
              </ConversationContent>
              <ConversationScrollButton
                className="bottom-3"
                aria-label="Ir para a mensagem mais recente"
              />
            </Conversation>

            <div className="shrink-0 bg-gradient-to-t from-background via-background to-transparent px-4 pb-3 pt-2 tablet:px-8">
              <div className="mx-auto max-w-[780px]">
                <ChatComposer
                  key={activeConversationId ?? "conversation-draft"}
                  input={input}
                  isBusy={isBusy}
                  onChange={setInput}
                  onKeyDown={handleKeyDown}
                  onSubmit={handleSubmit}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {hasDecisionResult && decisionResult ? (
        <>
          {showDecisionPanel ? (
            <button
              type="button"
              onClick={() => setDecisionPanelOpen(false)}
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] desktop:hidden"
              aria-label="Fechar seleção"
            />
          ) : null}
          <div
            className={cn(
              showDecisionPanel
                ? "fixed inset-x-0 bottom-0 z-50 h-[min(88dvh,760px)] overflow-hidden rounded-t-[28px] bg-background pb-[env(safe-area-inset-bottom)] shadow-2xl desktop:static desktop:z-auto desktop:h-full desktop:w-[420px] desktop:min-w-[360px] desktop:shrink-0 desktop:rounded-none desktop:pb-0 desktop:shadow-none"
                : "hidden",
            )}
            role="region"
            aria-label="Seleção de músicas"
          >
            <DecisionBoard
              result={decisionResult}
              marketFilter={marketFilter}
              onClose={() => setDecisionPanelOpen(false)}
              onMarketFilterChange={setMarketFilter}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
