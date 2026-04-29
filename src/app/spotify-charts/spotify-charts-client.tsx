"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronRight,
  FileUp,
  Loader2,
  Minus,
  MoreHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ChartSnapshot,
  ChartSnapshotTrackWithMovement,
} from "@/lib/chart-snapshots";

// ── Types ──────────────────────────────────────────────────────────────────────

type SnapshotData = {
  snapshot: ChartSnapshot | null;
  tracks: ChartSnapshotTrackWithMovement[];
  previousDate: string | null;
};

type Props = {
  initialDates: string[];
  initialDate: string | null;
  initialSnapshot: SnapshotData | null;
  country: string;
};

type UserPlaylist = {
  id: string;
  name: string;
  imageUrl: string | null;
  tracksTotal: number;
};

type AddState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; alreadyExists: boolean }
  | { status: "error"; message: string };

// ── Helpers ────────────────────────────────────────────────────────────────────

function coverStyle(coverUrl: string | null): React.CSSProperties | undefined {
  if (!coverUrl) return undefined;
  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ── MovementIcon ───────────────────────────────────────────────────────────────

function MovementIcon({
  status,
  change,
}: {
  status: "new" | "up" | "down" | "stable";
  change: number | null;
}) {
  if (status === "new") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
        <Sparkles size={9} />
        NEW
      </span>
    );
  }
  if (status === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400">
        <ArrowUp size={13} strokeWidth={2.5} />
        <span className="text-xs font-semibold">{Math.abs(change ?? 0)}</span>
      </span>
    );
  }
  if (status === "down") {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-500 dark:text-red-400">
        <ArrowDown size={13} strokeWidth={2.5} />
        <span className="text-xs font-semibold">{Math.abs(change ?? 0)}</span>
      </span>
    );
  }
  return <Minus size={13} className="text-muted-foreground" />;
}

// ── StreamsCell ────────────────────────────────────────────────────────────────

function StreamsCell({ streams, change, growthPct }: {
  streams: number | null;
  change: number | null;
  growthPct: number | null;
}) {
  if (streams === null) return <span className="text-muted-foreground">—</span>;
  const formatted = streams.toLocaleString("pt-BR");
  const showGrowth = growthPct !== null;
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span>{formatted}</span>
      {showGrowth && (
        <span className={`text-[10px] font-medium ${growthPct >= 0 ? "text-green-600" : "text-red-500"}`}>
          {growthPct >= 0 ? "+" : ""}{growthPct.toFixed(1)}%
        </span>
      )}
    </span>
  );
}

// ── PlaylistAddButton ──────────────────────────────────────────────────────────

function PlaylistAddButton({ spotifyTrackId }: { spotifyTrackId: string }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});
  // track which side to open (left or right) based on viewport
  const [menuSide, setMenuSide] = useState<"left" | "right">("right");

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const fetchPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    setPlaylistsError(null);
    try {
      const res = await fetch("/api/spotify/me/playlists");
      const data = (await res.json()) as {
        connected: boolean;
        playlists?: UserPlaylist[];
        message?: string;
      };
      if (!data.connected) {
        setPlaylistsError(data.message ?? "Spotify não conectado.");
        return;
      }
      setPlaylists(data.playlists ?? []);
    } catch {
      setPlaylistsError("Erro ao carregar playlists.");
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  function handleOpen() {
    // Detect if button is near right edge — open menu to the left
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuSide(rect.right + 260 > window.innerWidth ? "left" : "right");
    }
    setOpen((v) => {
      if (!v && playlists.length === 0) void fetchPlaylists();
      return !v;
    });
  }

  async function handleAdd(playlistId: string, playlistName: string) {
    setAddStates((s) => ({ ...s, [playlistId]: { status: "loading" } }));
    try {
      const res = await fetch(`/api/spotify/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackUri: `spotify:track:${spotifyTrackId}` }),
      });
      const data = (await res.json()) as { success: boolean; alreadyExists?: boolean; message?: string };

      if (!res.ok || !data.success) {
        setAddStates((s) => ({ ...s, [playlistId]: { status: "error", message: data.message ?? "Erro ao adicionar." } }));
        return;
      }

      setAddStates((s) => ({ ...s, [playlistId]: { status: "success", alreadyExists: data.alreadyExists ?? false } }));
      // Auto-close after success
      setTimeout(() => setOpen(false), 1200);
    } catch {
      setAddStates((s) => ({ ...s, [playlistId]: { status: "error", message: "Erro de rede." } }));
    }
  }

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800 transition-colors"
        title="Adicionar a playlist"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div
          ref={menuRef}
          className={`absolute z-50 mt-1 w-60 rounded-lg border border-border bg-popover shadow-lg ${
            menuSide === "left" ? "right-0" : "left-0"
          }`}
          style={{ top: "100%" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Adicionar a playlist
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-72 overflow-y-auto">
            {loadingPlaylists && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            )}

            {!loadingPlaylists && playlistsError && (
              <p className="px-3 py-4 text-center text-xs text-red-500">{playlistsError}</p>
            )}

            {!loadingPlaylists && !playlistsError && playlists.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhuma playlist encontrada.
              </p>
            )}

            {!loadingPlaylists && playlists.map((pl) => {
              const state = addStates[pl.id] ?? { status: "idle" };
              const isLoading = state.status === "loading";
              const isSuccess = state.status === "success";
              const isError = state.status === "error";

              return (
                <button
                  key={pl.id}
                  type="button"
                  disabled={isLoading || isSuccess}
                  onClick={() => void handleAdd(pl.id, pl.name)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors"
                >
                  {/* Cover */}
                  <div
                    className="h-9 w-9 shrink-0 rounded-md border border-border bg-muted"
                    style={coverStyle(pl.imageUrl)}
                  />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{pl.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {pl.tracksTotal} faixas
                    </div>
                  </div>

                  {/* State icon */}
                  <div className="shrink-0">
                    {isLoading && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
                    {isSuccess && (
                      <Check
                        size={13}
                        className={state.alreadyExists ? "text-muted-foreground" : "text-green-500"}
                      />
                    )}
                    {isError && <X size={13} className="text-red-500" />}
                    {state.status === "idle" && <ChevronRight size={13} className="text-muted-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Error detail */}
          {Object.values(addStates).some((s) => s.status === "error") && (
            <div className="border-t border-border px-3 py-2">
              {Object.entries(addStates).map(([id, s]) =>
                s.status === "error" ? (
                  <p key={id} className="text-[10px] text-red-500">{s.message}</p>
                ) : null
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SpotifyChartsClient({
  initialDates,
  initialDate,
  initialSnapshot,
  country,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [dates, setDates] = useState<string[]>(initialDates);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(initialSnapshot);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadingDate, setLoadingDate] = useState(false);
  const [, startTransition] = useTransition();

  // ── Upload CSV ──────────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    setUploading(true);
    setUploadMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("country", country);
      const res = await fetch("/api/import/spotify-charts-csv", {
        method: "POST",
        body: formData,
      });
      const payload = (await res.json()) as {
        success: boolean;
        importedCount: number;
        skippedCount: number;
        errors: string[];
      };
      if (!res.ok || !payload.success) {
        setUploadMsg({ ok: false, text: payload.errors[0] ?? "Erro ao importar CSV." });
        return;
      }
      setUploadMsg({ ok: true, text: `✓ ${payload.importedCount} faixas importadas. ${payload.skippedCount} puladas.` });
      const datesRes = await fetch(`/api/charts/snapshot-dates?country=${country}`);
      const datesData = (await datesRes.json()) as { dates: string[] };
      const newDates = datesData.dates ?? [];
      setDates(newDates);
      if (newDates[0] && newDates[0] !== selectedDate) {
        await loadSnapshot(newDates[0]);
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setUploadMsg({ ok: false, text: "Falha ao importar. Tente novamente." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Load snapshot ───────────────────────────────────────────────────────────
  async function loadSnapshot(date: string) {
    setLoadingDate(true);
    setSelectedDate(date);
    try {
      const res = await fetch(`/api/charts/snapshot?date=${date}&country=${country}`);
      if (!res.ok) { setSnapshot(null); return; }
      const data = (await res.json()) as SnapshotData;
      setSnapshot(data);
    } catch {
      setSnapshot(null);
    } finally {
      setLoadingDate(false);
    }
  }

  const tracks = snapshot?.tracks ?? [];
  const prevDate = snapshot?.previousDate ?? null;
  const hasHistory = dates.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Top bar ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Upload */}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-slate-800"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
            {uploading ? "Importando..." : "Importar CSV"}
          </button>
          {uploadMsg && (
            <p className={`text-xs ${uploadMsg.ok ? "text-emerald-500" : "text-red-500"}`}>{uploadMsg.text}</p>
          )}
          {!uploadMsg && (
            <p className="text-xs text-muted-foreground">
              CSV do Spotify Charts Top 200 BR. O nome deve conter a data (ex: 2025-04-20).
            </p>
          )}
        </div>

        {/* Seletor de datas */}
        {hasHistory && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <CalendarDays size={13} />
              Dias disponíveis ({dates.length})
            </div>
            <div className="flex flex-wrap gap-1.5 max-w-md">
              {dates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => void loadSnapshot(d)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    d === selectedDate
                      ? "border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
                      : "border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {formatDate(d)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Sem dados ── */}
      {!hasHistory && (
        <div className="rounded-lg border border-dashed border-border py-20 text-center">
          <p className="text-sm font-medium text-muted-foreground">Nenhum snapshot salvo ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground">Importe um CSV do Spotify Charts para começar o histórico.</p>
        </div>
      )}

      {/* ── Tabela ── */}
      {hasHistory && selectedDate && (
        <div className="rounded-lg border border-border bg-card">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold">Top 200 — {formatDate(selectedDate)}</h3>
              {prevDate && <p className="text-xs text-muted-foreground">Comparando com {formatDate(prevDate)}</p>}
              {!prevDate && tracks.length > 0 && (
                <p className="text-xs text-muted-foreground">Primeiro snapshot — sem comparação disponível</p>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{tracks.length} faixas</span>
          </div>

          {/* Loading */}
          {loadingDate && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}

          {/* Table */}
          {!loadingDate && tracks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 dark:bg-slate-900">
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-12">#</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-16">Mov.</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Faixa</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Streams</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Gênero</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-12">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((track) => (
                    <tr
                      key={track.id}
                      className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      {/* Posição */}
                      <td className="px-3 py-2 text-center">
                        <span className="font-mono text-sm font-semibold text-muted-foreground">
                          {track.position}
                        </span>
                      </td>

                      {/* Movimento */}
                      <td className="px-3 py-2 text-center">
                        <MovementIcon status={track.status} change={track.position_change} />
                      </td>

                      {/* Faixa */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="h-10 w-10 shrink-0 rounded-lg border border-border bg-muted"
                            style={coverStyle(track.image_url ?? null)}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-sm leading-tight">
                              {track.spotify_track_id ? (
                                <a
                                  href={`https://open.spotify.com/track/${track.spotify_track_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline"
                                >
                                  {track.track_name}
                                </a>
                              ) : (
                                track.track_name
                              )}
                            </div>
                            <div className="truncate text-xs text-muted-foreground mt-0.5">
                              {track.artist_name ?? "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Streams */}
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        <StreamsCell
                          streams={track.streams}
                          change={track.stream_change}
                          growthPct={track.stream_growth_percent}
                        />
                      </td>

                      {/* Gênero */}
                      <td className="px-3 py-2 hidden lg:table-cell">
                        {track.genre ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {track.genre}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="px-3 py-2 text-center">
                        {track.spotify_track_id ? (
                          <PlaylistAddButton spotifyTrackId={track.spotify_track_id} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {!loadingDate && tracks.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhuma faixa encontrada para esta data.
            </p>
          )}
        </div>
      )}

      {/* Legenda */}
      {tracks.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t border-border pt-4">
          <span className="font-medium">Legenda:</span>
          <span className="flex items-center gap-1 text-green-600"><ArrowUp size={12} /> Subiu posição</span>
          <span className="flex items-center gap-1 text-red-500"><ArrowDown size={12} /> Caiu posição</span>
          <span className="flex items-center gap-1"><Minus size={12} /> Estável</span>
          <span className="flex items-center gap-1 text-purple-600"><Sparkles size={12} /> Novo no chart</span>
        </div>
      )}
    </div>
  );
}
