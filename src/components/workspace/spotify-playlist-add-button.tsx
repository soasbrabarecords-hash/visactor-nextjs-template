"use client";

import {
  Check,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useSpotifyAccountPlaylistsCacheKey } from "@/hooks/use-spotify-account-playlists-cache-key";
import {
  type SpotifyAccountPlaylistClient,
  getSpotifyAccountPlaylistsClient,
  invalidateSpotifyAccountPlaylistsClientCache,
} from "@/lib/spotify-account-playlists-client";
import { cn } from "@/lib/utils";

type UserPlaylist = SpotifyAccountPlaylistClient;

type AddState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; alreadyExists: boolean }
  | { status: "error"; message: string };

function coverStyle(coverUrl: string | null): CSSProperties | undefined {
  if (!coverUrl) {
    return undefined;
  }

  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

export default function SpotifyPlaylistAddButton({
  spotifyTrackId,
  suggestedPlaylistName,
  source = "playlist_add_button",
  chartSnapshotTrackId,
  label = "Adicionar agora",
  ariaLabel,
  compact = false,
  className,
  onAddSuccess,
}: {
  spotifyTrackId: string | null;
  suggestedPlaylistName?: string | null;
  source?: string;
  chartSnapshotTrackId?: string | null;
  label?: string;
  ariaLabel?: string;
  compact?: boolean;
  className?: string;
  onAddSuccess?: (result: {
    playlistId: string;
    spotifyTrackId: string;
    alreadyExists: boolean;
  }) => void;
}) {
  const cacheKey = useSpotifyAccountPlaylistsCacheKey();
  const activeCacheKeyRef = useRef(cacheKey);
  const playlistsCacheKeyRef = useRef(cacheKey);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    activeCacheKeyRef.current = cacheKey;
    playlistsCacheKeyRef.current = cacheKey;
    setOpen(false);
    setPlaylists([]);
    setLoadingPlaylists(false);
    setPlaylistsError(null);
    setAddStates({});
  }, [cacheKey]);

  const updateMenuPosition = useCallback(() => {
    if (!btnRef.current) {
      return;
    }

    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 288;
    const viewportPadding = 16;
    const preferLeft =
      rect.right + menuWidth > window.innerWidth - viewportPadding;
    const nextLeft = preferLeft ? rect.right - menuWidth : rect.left;

    setMenuPosition({
      top: rect.bottom + 8,
      left: Math.max(
        viewportPadding,
        Math.min(nextLeft, window.innerWidth - menuWidth - viewportPadding),
      ),
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onDown(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }

    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>("button:not([disabled])")
        ?.focus();
    });

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    updateMenuPosition();

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const fetchPlaylists = useCallback(async () => {
    if (!cacheKey) return;
    const requestCacheKey = cacheKey;

    setLoadingPlaylists(true);
    setPlaylistsError(null);

    try {
      const data = await getSpotifyAccountPlaylistsClient({
        cacheKey: requestCacheKey,
      });
      if (activeCacheKeyRef.current !== requestCacheKey) return;

      if (!data.connected) {
        setPlaylistsError(data.message ?? "Spotify nao conectado.");
        return;
      }

      playlistsCacheKeyRef.current = requestCacheKey;
      setPlaylists(data.playlists ?? []);
    } catch (error) {
      if (activeCacheKeyRef.current !== requestCacheKey) return;
      setPlaylistsError(
        error instanceof Error ? error.message : "Erro ao carregar playlists.",
      );
    } finally {
      if (activeCacheKeyRef.current === requestCacheKey) {
        setLoadingPlaylists(false);
      }
    }
  }, [cacheKey]);

  const scopedPlaylists = useMemo(
    () => (playlistsCacheKeyRef.current === cacheKey ? playlists : []),
    [cacheKey, playlists],
  );
  const orderedPlaylists = useMemo(() => {
    if (!suggestedPlaylistName) {
      return scopedPlaylists;
    }

    const normalizedSuggested = suggestedPlaylistName.trim().toLowerCase();

    return [...scopedPlaylists].sort((left, right) => {
      const leftSuggested =
        left.name.trim().toLowerCase() === normalizedSuggested;
      const rightSuggested =
        right.name.trim().toLowerCase() === normalizedSuggested;

      if (leftSuggested === rightSuggested) {
        return right.tracksTotal - left.tracksTotal;
      }

      return leftSuggested ? -1 : 1;
    });
  }, [scopedPlaylists, suggestedPlaylistName]);

  function handleWarmup() {
    if (!spotifyTrackId || scopedPlaylists.length > 0 || loadingPlaylists) {
      return;
    }

    void fetchPlaylists();
  }

  function handleOpen() {
    if (!spotifyTrackId) {
      return;
    }

    setOpen((current) => {
      if (!current && scopedPlaylists.length === 0) {
        void fetchPlaylists();
      }

      return !current;
    });
    updateMenuPosition();
  }

  async function handleAdd(playlistId: string) {
    if (!spotifyTrackId) {
      return;
    }

    setAddStates((current) => ({
      ...current,
      [playlistId]: { status: "loading" },
    }));

    try {
      const response = await fetch(
        `/api/spotify/playlists/${playlistId}/tracks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackUri: `spotify:track:${spotifyTrackId}`,
            source,
            chartSnapshotTrackId,
          }),
        },
      );
      const data = (await response.json()) as {
        success?: boolean;
        alreadyExists?: boolean;
        message?: string;
      };

      if (!response.ok || !data.success) {
        setAddStates((current) => ({
          ...current,
          [playlistId]: {
            status: "error",
            message: data.message ?? "Erro ao adicionar.",
          },
        }));
        return;
      }

      setAddStates((current) => ({
        ...current,
        [playlistId]: {
          status: "success",
          alreadyExists: data.alreadyExists ?? false,
        },
      }));
      onAddSuccess?.({
        playlistId,
        spotifyTrackId,
        alreadyExists: data.alreadyExists ?? false,
      });
      invalidateSpotifyAccountPlaylistsClientCache(cacheKey);
      setTimeout(() => setOpen(false), 1200);
    } catch {
      setAddStates((current) => ({
        ...current,
        [playlistId]: {
          status: "error",
          message: "Erro de rede.",
        },
      }));
    }
  }

  if (!spotifyTrackId) {
    return (
      <Button
        type="button"
        disabled
        aria-label={ariaLabel ?? (compact ? label : undefined)}
        className={cn(
          compact
            ? "h-9 rounded-full border-white/10 bg-white/5 px-3 text-white/55"
            : "h-11 rounded-full bg-[#1ed760]/60 px-5 font-semibold text-black/70",
          className,
        )}
      >
        <Plus className="h-4 w-4" />
        {!compact ? label : null}
      </Button>
    );
  }

  return (
    <>
      <Button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel ?? (compact ? label : undefined)}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={handleOpen}
        onMouseEnter={handleWarmup}
        onFocus={handleWarmup}
        className={cn(
          compact
            ? "h-9 rounded-full border border-white/10 bg-white/5 px-3 text-white hover:bg-white/10"
            : "h-11 rounded-full bg-[#1ed760] px-5 font-semibold text-black hover:bg-[#35e26c]",
          className,
        )}
      >
        {compact ? (
          <MoreHorizontal className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {!compact ? label : null}
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="dialog"
              aria-label="Adicionar faixa a uma playlist"
              className="fixed z-[120] w-72 overflow-hidden rounded-[20px] border border-white/10 bg-[#0c1013] text-white shadow-[0_24px_64px_rgba(0,0,0,0.42)]"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
              }}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                    Adicionar a playlist
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white/90">
                    {suggestedPlaylistName
                      ? `Sugestao: ${suggestedPlaylistName}`
                      : "Escolha a playlist"}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Fechar seletor de playlists"
                  onClick={() => {
                    setOpen(false);
                    btnRef.current?.focus();
                  }}
                  className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loadingPlaylists ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-4 w-4 animate-spin text-white/55" />
                  </div>
                ) : null}

                {!loadingPlaylists && playlistsError ? (
                  <p className="px-4 py-5 text-center text-xs text-red-400">
                    {playlistsError}
                  </p>
                ) : null}

                {!loadingPlaylists &&
                !playlistsError &&
                orderedPlaylists.length === 0 ? (
                  <p className="px-4 py-5 text-center text-xs text-white/55">
                    Nenhuma playlist encontrada.
                  </p>
                ) : null}

                {!loadingPlaylists &&
                  orderedPlaylists.map((playlist) => {
                    const state = addStates[playlist.id] ?? { status: "idle" };
                    const isLoading = state.status === "loading";
                    const isSuccess = state.status === "success";
                    const isSuggested =
                      suggestedPlaylistName?.trim().toLowerCase() ===
                      playlist.name.trim().toLowerCase();

                    return (
                      <button
                        key={playlist.id}
                        type="button"
                        disabled={isLoading || isSuccess}
                        onClick={() => void handleAdd(playlist.id)}
                        className="hover:bg-white/6 flex w-full items-center gap-3 px-4 py-3 text-left transition disabled:opacity-70"
                      >
                        <div
                          className="h-11 w-11 shrink-0 rounded-xl border border-white/10 bg-muted"
                          style={coverStyle(playlist.imageUrl)}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-white/92 truncate text-sm font-semibold">
                              {playlist.name}
                            </div>
                            {isSuggested ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#1ed760]/20 bg-[#1ed760]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#9df6b8]">
                                <Sparkles className="h-3 w-3" />
                                Sugerida
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-[11px] text-white/60">
                            {playlist.tracksTotal} faixas
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-white/55" />
                          ) : isSuccess ? (
                            <Check
                              className={cn(
                                "h-4 w-4",
                                state.alreadyExists
                                  ? "text-white/45"
                                  : "text-[#1ed760]",
                              )}
                            />
                          ) : state.status === "error" ? (
                            <X className="h-4 w-4 text-red-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-white/35" />
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>

              {Object.values(addStates).some(
                (state) => state.status === "error",
              ) ? (
                <div className="border-t border-white/10 px-4 py-2">
                  {Object.entries(addStates).map(([playlistId, state]) =>
                    state.status === "error" ? (
                      <p key={playlistId} className="text-[10px] text-red-400">
                        {state.message}
                      </p>
                    ) : null,
                  )}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
