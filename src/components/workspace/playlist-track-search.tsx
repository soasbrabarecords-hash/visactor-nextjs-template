"use client";

import {
  Check,
  Loader2,
  Music2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPlaylistRecommendationsClient } from "@/lib/playlist-recommendations-client";
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
    description: "Afinidade da conta + força no mercado brasileiro.",
  },
  GLOBAL: {
    description: "Afinidade da conta + faixas globais compatíveis.",
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
  const [activeMarket, setActiveMarket] = useState<"BR" | "GLOBAL">("BR");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
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

  const loadSuggestions = useCallback(
    async ({ force = false } = {}) => {
      setLoadingSuggestions(true);
      setSuggestionsError(null);
      try {
        const data = await getPlaylistRecommendationsClient(playlistId, {
          force,
        });
        setSuggestions(data);
        setSelectedIds(new Set());
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
    },
    [playlistId],
  );

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  async function addTrackToPlaylist(trackId: string) {
    const response = await fetch(
      `/api/spotify/playlists/${playlistId}/tracks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackUri: `spotify:track:${trackId}` }),
      },
    );
    const data = (await response.json()) as {
      success?: boolean;
      message?: string;
    };
    if (!data.success) {
      throw new Error(data.message ?? "Erro ao adicionar faixa.");
    }
  }

  async function handleAdd(track: Pick<Track, "id">) {
    if (addingId || bulkAdding) return;
    setAddingId(track.id);
    setActionError(null);
    try {
      await addTrackToPlaylist(track.id);
      setAddedIds((previous) => new Set(previous).add(track.id));
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(track.id);
        return next;
      });
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

  async function handleAddSelected() {
    if (!suggestions || addingId || bulkAdding) return;
    const tracks = suggestions.markets[activeMarket].items.filter(
      (track) => selectedIds.has(track.id) && !isOnPlaylist(track.id),
    );

    if (tracks.length === 0) return;
    setBulkAdding(true);
    setActionError(null);
    const completed: string[] = [];

    try {
      for (const track of tracks) {
        await addTrackToPlaylist(track.id);
        completed.push(track.id);
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Erro ao adicionar faixas.",
      );
    } finally {
      if (completed.length > 0) {
        setAddedIds((previous) => new Set([...previous, ...completed]));
        setSelectedIds((previous) => {
          const next = new Set(previous);
          completed.forEach((trackId) => next.delete(trackId));
          return next;
        });
        invalidateSpotifyAccountPlaylistsClientCache();
        onAdded?.();
      }
      setBulkAdding(false);
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

  function toggleSelected(trackId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }

  function renderDecisionRow(track: PlaylistDecisionSuggestion, index: number) {
    const onPlaylist = isOnPlaylist(track.id);
    const isAdding = addingId === track.id || bulkAdding;
    const addNow = track.recommendation === "add_now";
    const selected = selectedIds.has(track.id);
    const marketLabel = track.market === "BR" ? "BR" : "Global";

    return (
      <div
        key={`${track.market}-${track.id}`}
        className={`group grid min-h-16 grid-cols-[28px_40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-3 py-2.5 transition last:border-b-0 hover:bg-muted/25 tablet:grid-cols-[28px_28px_40px_minmax(180px,1.2fr)_minmax(150px,1fr)_80px_48px_auto] ${
          selected ? "bg-primary/[0.06]" : ""
        }`}
      >
        <button
          type="button"
          aria-label={
            selected ? `Desmarcar ${track.name}` : `Selecionar ${track.name}`
          }
          aria-pressed={selected}
          onClick={() => toggleSelected(track.id)}
          disabled={onPlaylist || isAdding}
          className={`flex h-5 w-5 items-center justify-center rounded border transition ${
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-transparent hover:border-primary/60"
          } disabled:opacity-30`}
        >
          <Check className="h-3 w-3" />
        </button>
        <span className="hidden text-center text-xs tabular-nums text-muted-foreground tablet:block">
          {index + 1}
        </span>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-inset ring-border"
          style={coverStyle(track.imageUrl)}
        >
          {track.imageUrl ? null : <Music2 className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{track.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {track.artists}
          </div>
        </div>
        <div className="hidden min-w-0 tablet:block">
          <div
            className="truncate text-xs text-muted-foreground"
            title={track.explanation}
          >
            {track.explanation}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={addNow ? "text-emerald-500" : "text-sky-500"}>
              {track.recommendationLabel}
            </span>
            <span>·</span>
            <span>{track.sourceLabel}</span>
            {track.signals[0] ? (
              <>
                <span>·</span>
                <span className="truncate">{track.signals[0]}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="hidden text-right tablet:block">
          {track.currentPosition === null ? (
            <>
              <div className="text-xs font-semibold">Fora do chart</div>
              <div className="mt-0.5 text-[10px] text-violet-400">
                sinal da conta
              </div>
            </>
          ) : (
            <>
              <div className="text-xs font-semibold tabular-nums">
                #{track.currentPosition} {marketLabel}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {track.movement7d === null
                  ? "7d sem leitura"
                  : `${track.movement7d > 0 ? "+" : ""}${track.movement7d} em 7d`}
              </div>
            </>
          )}
        </div>
        <div className="hidden text-center tablet:block">
          <div className="text-sm font-semibold tabular-nums">
            {track.playlistFitScore}
          </div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            fit
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleAdd(track)}
          disabled={onPlaylist || isAdding}
          className={`inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-3 text-[11px] font-semibold transition disabled:opacity-60 ${
            onPlaylist
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-primary text-primary-foreground hover:brightness-110"
          }`}
        >
          {addingId === track.id ? (
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
    );
  }

  const activeQueue = suggestions?.markets[activeMarket];
  const selectableItems =
    activeQueue?.items.filter((track) => !isOnPlaylist(track.id)) ?? [];
  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every((track) => selectedIds.has(track.id));
  const selectedCount = selectableItems.filter((track) =>
    selectedIds.has(track.id),
  ).length;

  function toggleAllVisible() {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      selectableItems.forEach((track) => {
        if (allSelected) next.delete(track.id);
        else next.add(track.id);
      });
      return next;
    });
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

      <section className="overflow-hidden rounded-2xl border border-border bg-card/35">
        <header className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 tablet:flex-row tablet:items-center tablet:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Curadoria assistida
            </div>
            <h2 className="mt-1 text-base font-semibold tracking-tight">
              Próximas oportunidades
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              DNA da playlist, comportamento da conta e força nos charts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {suggestions ? (
              <>
                {suggestions.summary.playlistGenre !== "unknown" ? (
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-violet-400 ring-1 ring-inset ring-violet-500/20">
                    Perfil {suggestions.summary.playlistGenreLabel}
                  </span>
                ) : null}
                {suggestions.summary.listeningSignalsAvailable ? (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                    Conta ativa · {suggestions.summary.personalizedCandidates}
                  </span>
                ) : null}
                <span className="rounded-full bg-muted px-2.5 py-1.5 text-[10px] text-muted-foreground">
                  {formatDate(suggestions.summary.latestChartDate)} ·{" "}
                  {suggestions.summary.maxWindow}d
                </span>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void loadSuggestions({ force: true })}
              disabled={loadingSuggestions}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background/50 px-3 text-[10px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${loadingSuggestions ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </header>

        {actionError || suggestionsError ? (
          <div className="mx-4 mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {actionError ?? suggestionsError}
          </div>
        ) : null}

        {loadingSuggestions && !suggestions ? (
          <div className="flex items-center justify-center px-5 py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cruzando DNA, histórico da conta e charts…
          </div>
        ) : suggestions && activeQueue ? (
          <div>
            <div className="flex flex-col gap-3 border-b border-border/60 px-3 py-3 tablet:flex-row tablet:items-center tablet:justify-between">
              <div className="flex w-fit rounded-full border border-border bg-background/40 p-1">
                {(["BR", "GLOBAL"] as const).map((market) => (
                  <button
                    key={market}
                    type="button"
                    onClick={() => setActiveMarket(market)}
                    aria-pressed={activeMarket === market}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeMarket === market
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {market === "BR" ? "Brasil" : "Global"}{" "}
                    <span className="ml-1 tabular-nums opacity-60">
                      {suggestions.markets[market].items.length}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden text-xs text-muted-foreground tablet:inline">
                  {MARKET_COPY[activeMarket].description}
                </span>
                {selectableItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={toggleAllVisible}
                    className="h-8 rounded-full px-3 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {allSelected ? "Limpar seleção" : "Selecionar todas"}
                  </button>
                ) : null}
                {selectedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleAddSelected()}
                    disabled={bulkAdding || Boolean(addingId)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                  >
                    {bulkAdding ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Adicionar {selectedCount}
                  </button>
                ) : null}
              </div>
            </div>

            {activeQueue.items.length > 0 ? (
              <div>
                <div className="hidden grid-cols-[28px_28px_40px_minmax(180px,1.2fr)_minmax(150px,1fr)_80px_48px_auto] items-center gap-3 border-b border-border/60 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground tablet:grid">
                  <span />
                  <span className="text-center">#</span>
                  <span />
                  <span>Faixa</span>
                  <span>Motivo</span>
                  <span className="text-right">Sinal</span>
                  <span className="text-center">Fit</span>
                  <span className="text-right">Ação</span>
                </div>
                {activeQueue.items.map(renderDecisionRow)}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-xs leading-5 text-muted-foreground">
                Nenhuma faixa com aderência forte e risco controlado neste
                mercado agora.
              </div>
            )}
          </div>
        ) : !loadingSuggestions ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            <Music2 className="mx-auto mb-2 h-5 w-5" />A inteligência ainda não
            pôde montar sugestões para esta playlist.
          </div>
        ) : null}

        {suggestions ? (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5 text-[10px] text-muted-foreground">
            <span>
              {suggestions.summary.compatibleCandidates} compatíveis entre{" "}
              {suggestions.summary.candidatesEvaluated} candidatas avaliadas
            </span>
            <span>Score = 55% gênero/vibe + 30% conta + 15% charts</span>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
