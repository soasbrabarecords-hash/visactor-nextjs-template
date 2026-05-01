"use client";

/**
 * PlaylistTrackSearch
 * ───────────────────
 * Componente self-contained que adiciona um campo de busca + lista de sugestões
 * abaixo da tabela de tracks (estilo Spotify "Vamos achar algo para sua playlist").
 *
 * Uso:
 *   <PlaylistTrackSearch
 *     playlistId={...}
 *     existingTrackIds={tracks.map(t => t.id)}
 *     onAdded={() => router.refresh()}
 *   />
 *
 * Não toca em nada do PlaylistEditor — apenas chama a API que já existe
 * (POST /api/spotify/playlists/[id]/tracks).
 */

import { Loader2, Music2, Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

function coverStyle(url: string | null) {
  if (!url) return undefined;
  return {
    backgroundImage: `url(${url})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

export default function PlaylistTrackSearch({ playlistId, existingTrackIds, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<Track[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Busca com debounce ─────────────────────────────────────────────────
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
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=10`);
        const data = (await res.json()) as { tracks?: Track[]; message?: string };
        if (!res.ok) throw new Error(data.message ?? "Erro ao pesquisar.");
        setResults(data.tracks ?? []);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Erro ao pesquisar.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ── Sugestões (carregamento sob demanda na 1ª vez) ─────────────────────
  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setSuggestionsError(null);
    try {
      const res = await fetch(`/api/spotify/playlists/${playlistId}/recommendations?limit=10`);
      const data = (await res.json()) as { tracks?: Track[]; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Erro ao buscar sugestões.");
      setSuggestions(data.tracks ?? []);
    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : "Erro ao buscar sugestões.");
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [playlistId]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  // ── Adicionar à playlist ───────────────────────────────────────────────
  async function handleAdd(track: Track) {
    if (addingId) return;
    setAddingId(track.id);
    try {
      const res = await fetch(`/api/spotify/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackUri: `spotify:track:${track.id}` }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string; alreadyExists?: boolean };
      if (!data.success) throw new Error(data.message ?? "Erro ao adicionar faixa.");
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.add(track.id);
        return next;
      });
      onAdded?.();
    } catch (err) {
      // Falhou — exibe erro inline na linha (simples)
      setSearchError(err instanceof Error ? err.message : "Erro ao adicionar.");
    } finally {
      setAddingId(null);
    }
  }

  function isOnPlaylist(trackId: string) {
    return existingTrackIds.includes(trackId) || addedIds.has(trackId);
  }

  // ── Render helpers ─────────────────────────────────────────────────────
  function renderRow(track: Track) {
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
          className={[
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            onPlaylist
              ? "border-green-500/30 bg-green-500/10 text-green-500"
              : "border-border bg-card hover:border-primary/50 hover:text-primary disabled:opacity-50",
          ].join(" ")}
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

  return (
    <div data-spotify-search className="space-y-6 pt-2">
      {/* Search bar */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Vamos achar algo para sua playlist
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquise por músicas ou artistas"
            className="w-full rounded-full border border-border bg-card/70 pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {searchError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {searchError}
          </div>
        )}

        {/* Resultados da busca */}
        {results !== null && (
          <div className="rounded-2xl border border-border bg-card/60 p-2">
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <Music2 className="mx-auto mb-2 h-5 w-5" />
                {query.trim() ? "Nenhum resultado encontrado." : "Digite para pesquisar."}
              </div>
            ) : (
              <div className="space-y-1">
                {results.map(renderRow)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sugestões */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sugestões para você
          </div>
          <button
            type="button"
            onClick={() => void loadSuggestions()}
            disabled={loadingSuggestions}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={["h-3 w-3", loadingSuggestions ? "animate-spin" : ""].join(" ")} />
            Atualizar
          </button>
        </div>

        {suggestionsError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {suggestionsError}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card/60 p-2">
          {loadingSuggestions && suggestions === null ? (
            <div className="flex items-center justify-center px-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando sugestões…
            </div>
          ) : suggestions && suggestions.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              <Music2 className="mx-auto mb-2 h-5 w-5" />
              Sem sugestões disponíveis.
            </div>
          ) : (
            <div className="space-y-1">
              {(suggestions ?? []).map(renderRow)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
