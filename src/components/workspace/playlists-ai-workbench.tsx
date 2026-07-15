"use client";

import {
  ArrowUpDown,
  Bot,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  Globe2,
  ListMusic,
  Loader2,
  LockKeyhole,
  MapPin,
  Music2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  TrendingDown,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type {
  PlaylistsAiChatResponse,
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

const QUICK_QUESTIONS = [
  "Quais músicas estão mais quentes no BR hoje?",
  "Quais oportunidades globais ainda não estão nas minhas playlists?",
  "Essa música já está em alguma playlist?",
  "Me sugere 10 músicas para FUNK 2026.",
  "Cria uma ideia de playlist baseada nas maiores subidas da semana.",
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

function MovementIcon({ value }: { value: number | null }) {
  if (value === null || value === 0)
    return <ShieldCheck className="h-3.5 w-3.5" />;
  return value > 0 ? (
    <TrendingUp className="h-3.5 w-3.5" />
  ) : (
    <TrendingDown className="h-3.5 w-3.5" />
  );
}

function TrackCard({ card }: { card: PlaylistsAiTrackCard }) {
  const [genreProfile, setGenreProfile] =
    useState<TrackGenreCardProfile | null>(card.genreProfile ?? null);
  const [genreEditorOpen, setGenreEditorOpen] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<TrackProfileGenre>(
    card.genreProfile?.primaryGenre ?? "desconhecido",
  );
  const [genreBusy, setGenreBusy] = useState(false);
  const [genreError, setGenreError] = useState<string | null>(null);

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
    <article className="group overflow-hidden rounded-[22px] border border-border/70 bg-background/75 p-3.5 shadow-sm transition hover:border-primary/25 dark:border-white/10 dark:bg-black/20">
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
    </article>
  );
}

function ResponseDetails({ result }: { result: PlaylistsAiChatResponse }) {
  return (
    <div className="mt-4 space-y-4">
      {result.cards.length > 0 ? (
        <div className="grid gap-2.5 desktop:grid-cols-2">
          {result.cards.map((card) => (
            <TrackCard key={`${card.id}-${card.statusLabel}`} card={card} />
          ))}
        </div>
      ) : null}

      {result.actions.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5" />
            Ações preparadas · V1 read-only
          </div>
          <div className="flex flex-wrap gap-2">
            {result.actions.map((preparedAction) => {
              const Icon = ACTION_ICONS[preparedAction.type];
              return (
                <button
                  key={preparedAction.id}
                  type="button"
                  disabled
                  title={preparedAction.description}
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-border/70 bg-muted/45 px-3 py-2 text-xs font-black text-muted-foreground opacity-80 dark:border-white/10"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {preparedAction.label}
                  <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em]">
                    em breve
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-[18px] border border-border/60 bg-muted/25 p-3 dark:border-white/10 dark:bg-white/[0.025]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            <Database className="h-3.5 w-3.5" /> Fontes consultadas
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground">
            Confiança {result.confidence}%
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${result.confidence}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {result.dataSources.map((dataSource) => (
            <span
              key={`${dataSource.id}-${dataSource.detail}`}
              title={dataSource.detail}
              className={cn(
                "rounded-full border px-2 py-1 text-[9px] font-bold",
                dataSource.status === "used"
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300"
                  : dataSource.status === "partial"
                    ? "border-amber-400/20 bg-amber-400/10 text-amber-700 dark:text-amber-300"
                    : "border-border/70 bg-muted/50 text-muted-foreground dark:border-white/10",
              )}
            >
              {dataSource.label}
            </span>
          ))}
        </div>
      </div>
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Sou o cérebro de decisões do Playlist OS. Posso cruzar Spotify Charts BR/Global, suas playlists conectadas e a Spotify API para responder com dados reais. Nesta V1 eu apenas analiso e preparo ações — nada será alterado sem uma etapa futura de confirmação.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  async function submitMessage(value: string) {
    const cleanMessage = value.trim();
    if (!cleanMessage || isThinking) return;

    const userMessage: ChatMessage = {
      id: newId("user"),
      role: "user",
      content: cleanMessage,
    };
    const history = [...messages, userMessage]
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsThinking(true);

    try {
      const response = await fetch("/api/playlists-ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cleanMessage, messages: history }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (PlaylistsAiChatResponse & { success?: true })
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
    <div className="mx-auto grid max-w-[1540px] gap-4 laptop:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <section className="relative overflow-hidden rounded-[30px] border border-border/70 bg-card/75 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-[-0.05em] text-foreground">
              Decisões, não prompts.
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
              Pergunte livremente. O agente escolhe as leituras necessárias e
              explica cada recomendação.
            </p>

            <div className="mt-5 space-y-2">
              {[
                "Spotify Charts BR + Global",
                "Playlists reais do workspace",
                "Busca oficial Spotify",
                "Scores e motivos explicáveis",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-xs font-bold text-muted-foreground"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-border/70 bg-card/65 p-4 dark:border-white/10 dark:bg-white/[0.025]">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            Perguntas para começar
          </div>
          <div className="mt-3 space-y-2">
            {QUICK_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void submitMessage(question)}
                disabled={isThinking}
                className="w-full rounded-[17px] border border-border/60 bg-background/55 px-3 py-2.5 text-left text-[11px] font-bold leading-4 text-muted-foreground transition hover:border-primary/25 hover:text-foreground disabled:opacity-50 dark:border-white/10 dark:bg-black/15"
              >
                {question}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="bg-card/72 flex max-h-[calc(100vh-150px)] min-h-[780px] flex-col overflow-hidden rounded-[32px] border border-border/70 shadow-[0_28px_100px_-65px_rgba(15,23,42,0.6)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-[-0.03em] text-foreground">
                Playlists IA
              </h1>
              <p className="text-[11px] font-medium text-muted-foreground">
                Agente de curadoria conectado aos seus dados
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
            <LockKeyhole className="h-3 w-3" /> V1 read-only
          </span>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 tablet:px-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isThinking ? (
            <article className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-[22px] border border-border/70 bg-background/70 px-4 py-3 text-sm font-semibold text-muted-foreground dark:border-white/10 dark:bg-white/[0.035]">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                cruzando charts, playlists e Spotify...
              </div>
            </article>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-border/70 p-4 dark:border-white/10 tablet:p-5"
        >
          <div className="rounded-[24px] border border-border/80 bg-background/80 p-2 shadow-inner focus-within:border-primary/30 dark:border-white/10 dark:bg-black/20">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={1600}
              rows={2}
              placeholder="Pergunte sobre oportunidades, uma faixa, uma playlist ou uma decisão de curadoria..."
              className="min-h-[66px] w-full resize-none bg-transparent px-3 py-2.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/65"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-2 pt-2 dark:border-white/10">
              <p className="text-[10px] font-semibold text-muted-foreground">
                Enter envia · Shift + Enter quebra linha · nenhuma ação é
                executada
              </p>
              <button
                type="submit"
                disabled={!input.trim() || isThinking}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-black text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
    </div>
  );
}
