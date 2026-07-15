"use client";

import {
  Eye,
  Loader2,
  Music2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PlaylistDecisionSuggestion,
  PlaylistSuggestionResponse,
} from "@/lib/playlist-suggestion-intelligence";
import { invalidateSpotifyAccountPlaylistsClientCache } from "@/lib/spotify-account-playlists-client";

type Track = {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  imageUrl: string | null;
  durationLabel: string;
  spotifyUrl: string;
  popularity: number;
};

type Props = {
  playlistId: string;
  existingTrackIds: string[];
  onAdded?: () => void;
};

const MARKET_COPY = {
  BR: {
    eyebrow: "Radar Brasil",
    title: "Oportunidades no BR",
    description: "Força e movimento no Top 200 brasileiro.",
  },
  GLOBAL: {
    eyebrow: "Radar Global",
    title: "Sinais internacionais",
    description: "Faixas globais compatíveis com este repertório.",
  },
} as const;

function coverStyle(url: string | null) {
  if (!url) return undefined;
  return {
    backgroundImage: `url(${url})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function formatDate(date: string | null) {
  if (!date) return "Aguardando leitura";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export default function PlaylistTrackSearch({
  playlistId,
  existingTrackIds,
  onAdded,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [suggestions, setSuggestions] =
    useState<PlaylistSuggestionResponse | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const response = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(q)}&limit=10`,
        );
        const data = (await response.json()) as {
          tracks?: Track[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(data.message ?? "Erro ao pesquisar.");
        }
        setResults(data.tracks ?? []);
      } catch (error) {
        setSearchError(
          error instanceof Error ? error.message : "Erro ao pesquisar.",
        );
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setSuggestionsError(null);
    try {
      const response = await fetch(
        `/api/spotify/playlists/${playlistId}/recommendations`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as PlaylistSuggestionResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(
          data.message ?? "Não foi possível atualizar a inteligência.",
        );
      }
      setSuggestions(data);
    } catch (error) {
      setSuggestionsError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a inteligência.",
      );
      setSuggestions(null);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [playlistId]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  async function handleAdd(track: Pick<Track, "id">) {
    if (addingId) return;
    setAddingId(track.id);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/spotify/playlists/${playlistId}/tracks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackUri: `spotify:track:${track.id}` }),
        },
      );
      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
      };
      if (!data.success) {
        throw new Error(data.message ?? "Erro ao adicionar faixa.");
      }
      setAddedIds((previous) => new Set(previous).add(track.id));
      invalidateSpotifyAccountPlaylistsClientCache();
      onAdded?.();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Erro ao adicionar faixa.",
      );
    } finally {
      setAddingId(null);
    }
  }

  function isOnPlaylist(trackId: string) {
    return existingTrackIds.includes(trackId) || addedIds.has(trackId);
  }

  function renderSearchRow(track: Track) {
    const onPlaylist = isOnPlaylist(track.id);
    const isAdding = addingId === track.id;

    return (
      <div
        key={track.id}
        className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/30"
      >
        <div
          className="h-10 w-10 shrink-0 rounded-md border border-border bg-muted"
          style={coverStyle(track.imageUrl)}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-tight">
            {track.name}
          </div>
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">
            {track.artists}
            {track.albumName ? ` • ${track.albumName}` : ""}
          </div>
        </div>
        <div className="hidden text-xs tabular-nums text-muted-foreground tablet:block">
          {track.durationLabel}
        </div>
        <button
          type="button"
          onClick={() => void handleAdd(track)}
          disabled={onPlaylist || isAdding}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            onPlaylist
              ? "border-green-500/30 bg-green-500/10 text-green-500"
              : "border-border bg-card hover:border-primary/50 hover:text-primary disabled:opacity-50"
          }`}
        >
          {isAdding ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adicionando…
            </>
          ) : onPlaylist ? (
            <>✓ Adicionada</>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </>
          )}
        </button>
      </div>
    );
  }

  function renderDecisionCard(track: PlaylistDecisionSuggestion) {
    const onPlaylist = isOnPlaylist(track.id);
    const isAdding = addingId === track.id;
    const addNow = track.recommendation === "add_now";

    return (
      <article
        key={`${track.market}-${track.id}`}
        className="rounded-2xl border border-white/[0.08] bg-black/15 p-3 shadow-[0_18px_50px_-38px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/25 ring-1 ring-inset ring-white/10"
            style={coverStyle(track.imageUrl)}
          >
            {track.imageUrl ? null : <Music2 className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-white">
                  {track.name}
                </h4>
                <p className="mt-0.5 truncate text-[11px] text-white/50">
                  {track.artists}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[9px] uppercase tracking-[0.12em] text-white/40">
                  decisão
                </div>
                <div className="mt-0.5 text-lg font-semibold leading-none text-white">
                  {track.playlistFitScore}
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ring-1 ring-inset ${
                  addNow
                    ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                    : "bg-sky-400/10 text-sky-300 ring-sky-400/20"
                }`}
              >
                {track.recommendationLabel}
              </span>
              {track.signals.map((signal) => (
                <span
                  key={signal}
                  className="rounded-full bg-white/[0.045] px-2 py-1 text-[9px] text-white/55 ring-1 ring-inset ring-white/[0.07]"
                >
                  {signal}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 min-h-10 text-[11px] leading-5 text-white/55">
          {track.explanation}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
          <div className="text-[10px] text-white/40">
            Oportunidade {track.opportunityScore} · risco {track.saturationRisk}
          </div>
          <button
            type="button"
            onClick={() => void handleAdd(track)}
            disabled={onPlaylist || isAdding}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition disabled:opacity-60 ${
              onPlaylist
                ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20"
                : "bg-primary text-primary-foreground hover:brightness-110"
            }`}
          >
            {isAdding ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : onPlaylist ? (
              "Adicionada"
            ) : (
              <>
                <Plus className="h-3 w-3" /> Adicionar
              </>
            )}
          </button>
        </div>
      </article>
    );
  }

  return (
    <div data-spotify-search className="space-y-7 pt-2">
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Vamos achar algo para sua playlist
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquise por músicas ou artistas"
            className="w-full rounded-full border border-border bg-card/70 py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {searching ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {searchError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {searchError}
          </div>
        ) : null}

        {results !== null ? (
          <div className="rounded-2xl border border-border bg-card/60 p-2">
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <Music2 className="mx-auto mb-2 h-5 w-5" />
                Nenhum resultado encontrado.
              </div>
            ) : (
              <div className="space-y-1">{results.map(renderSearchRow)}</div>
            )}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(15,23,42,0.78),rgba(8,12,20,0.94))] shadow-[0_28px_90px_-56px_rgba(37,99,235,0.55)]">
        <header className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-4 tablet:flex-row tablet:items-center tablet:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-sky-300/80">
              <Sparkles className="h-3.5 w-3.5" />
              Curadoria assistida
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-white">
              Decisões para esta playlist
            </h2>
            <p className="mt-1 text-xs leading-5 text-white/50">
              Apenas faixas fora da playlist, ordenadas por aderência e sinais
              reais de mercado.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {suggestions ? (
              <>
                {suggestions.summary.playlistGenre !== "unknown" ? (
                  <span className="rounded-full bg-violet-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-violet-200 ring-1 ring-inset ring-violet-400/20">
                    Perfil {suggestions.summary.playlistGenreLabel}
                  </span>
                ) : null}
                <span className="rounded-full bg-white/[0.045] px-2.5 py-1.5 text-[10px] text-white/55 ring-1 ring-inset ring-white/[0.07]">
                  {formatDate(suggestions.summary.latestChartDate)} ·{" "}
                  {suggestions.summary.maxWindow}d
                </span>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void loadSuggestions()}
              disabled={loadingSuggestions}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.055] px-3 text-[10px] font-semibold text-white/60 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${loadingSuggestions ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </header>

        {actionError || suggestionsError ? (
          <div className="mx-5 mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {actionError ?? suggestionsError}
          </div>
        ) : null}

        {loadingSuggestions && !suggestions ? (
          <div className="flex items-center justify-center px-5 py-12 text-sm text-white/45">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cruzando o perfil da playlist com os charts…
          </div>
        ) : suggestions ? (
          <div className="grid gap-px bg-white/[0.07] xl:grid-cols-2">
            {(["BR", "GLOBAL"] as const).map((market) => {
              const queue = suggestions.markets[market];
              const copy = MARKET_COPY[market];
              const MarketIcon = market === "BR" ? TrendingUp : Eye;

              return (
                <div key={market} className="bg-[#0b1019] p-4 tablet:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/40">
                        <MarketIcon className="h-3 w-3" /> {copy.eyebrow}
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-white">
                        {copy.title}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-white/45">
                        {copy.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] tabular-nums text-white/50 ring-1 ring-inset ring-white/[0.07]">
                      {queue.items.length}
                    </span>
                  </div>

                  {queue.items.length > 0 ? (
                    <div className="mt-4 grid gap-2.5">
                      {queue.items.map(renderDecisionCard)}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs leading-5 text-white/45">
                      Nenhuma faixa com aderência forte e risco controlado neste
                      mercado agora.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : !loadingSuggestions ? (
          <div className="px-5 py-10 text-center text-sm text-white/45">
            <Music2 className="mx-auto mb-2 h-5 w-5" />A inteligência ainda não
            pôde montar sugestões para esta playlist.
          </div>
        ) : null}

        {suggestions ? (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-3 text-[10px] text-white/40">
            <span>
              {suggestions.summary.compatibleCandidates} compatíveis entre{" "}
              {suggestions.summary.candidatesEvaluated} candidatas avaliadas
            </span>
            <span>Score = oportunidade de mercado + aderência à playlist</span>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
