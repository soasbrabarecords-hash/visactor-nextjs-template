"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  GripVertical,
  Loader2,
  Music2,
  Trash2,
  Check,
  X,
  Pencil,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SpotifyEditablePlaylistTrack } from "@/lib/spotify-user";
import type { KworbTrackData } from "@/app/api/kworb/track/[trackId]/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackWithStreams = SpotifyEditablePlaylistTrack & {
  streams: KworbTrackData | null;
  streamsLoading: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function coverStyle(coverUrl: string | null) {
  if (!coverUrl) return undefined;
  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function formatStreams(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function formatDelta(n: number | null, trend: KworbTrackData["trend"]): string {
  if (n === null || trend === null) return "";
  if (trend === "same" || n === 0) return "";
  const sign = trend === "up" ? "+" : "";
  return `${sign}${formatStreams(n)}`;
}

// ─── EditableField ────────────────────────────────────────────────────────────

function EditableField({
  value,
  onSave,
  multiline = false,
  placeholder = "",
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    if (draft.trim() === value) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !multiline) { e.preventDefault(); void handleSave(); }
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        className="group flex items-center gap-2 text-left hover:opacity-80"
      >
        <span>{value || <span className="text-muted-foreground italic">{placeholder}</span>}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  const sharedClass =
    "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="flex items-start gap-2">
      {multiline ? (
        <textarea
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={placeholder}
          className={sharedClass}
        />
      ) : (
        <input
          ref={inputRef as React.Ref<HTMLInputElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={sharedClass}
        />
      )}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="mt-0.5 rounded-md p-1.5 text-green-500 hover:bg-green-500/10 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(false); }}
        className="mt-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted/40"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── useDragSort — pointer events drag-and-drop ───────────────────────────────

function useDragSort(
  tracks: TrackWithStreams[],
  onReorder: (from: number, to: number) => void,
) {
  // índice sendo arrastado agora
  const draggingIndex = useRef<number | null>(null);
  // posição Y inicial do pointer
  const startY = useRef(0);
  // altura de cada linha (calculada na hora)
  const rowHeight = useRef(48);
  // ref para o tbody pra calcular offsets
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  // estado visual: qual linha está "ghost" e para onde vai
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      // Só arrasta pelo grip (o target deve ter data-grip)
      const target = e.target as HTMLElement;
      if (!target.closest("[data-grip]")) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      draggingIndex.current = index;
      startY.current = e.clientY;

      // calcula altura real de uma linha
      if (tbodyRef.current) {
        const firstRow = tbodyRef.current.querySelector("tr");
        if (firstRow) rowHeight.current = firstRow.getBoundingClientRect().height;
      }

      setDragFrom(index);
      setDragTo(index);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent, index: number) => {
      if (draggingIndex.current !== index) return;
      e.preventDefault();

      const deltaY = e.clientY - startY.current;
      const deltaRows = Math.round(deltaY / rowHeight.current);
      const newIndex = Math.max(0, Math.min(tracks.length - 1, index + deltaRows));

      setDragTo(newIndex);
    },
    [tracks.length],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent, index: number) => {
      if (draggingIndex.current !== index) return;
      e.preventDefault();

      const deltaY = e.clientY - startY.current;
      const deltaRows = Math.round(deltaY / rowHeight.current);
      const newIndex = Math.max(0, Math.min(tracks.length - 1, index + deltaRows));

      draggingIndex.current = null;
      setDragFrom(null);
      setDragTo(null);

      if (newIndex !== index) {
        onReorder(index, newIndex);
      }
    },
    [tracks.length, onReorder],
  );

  return {
    tbodyRef,
    dragFrom,
    dragTo,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}

// ─── PlaylistEditor ───────────────────────────────────────────────────────────

export default function PlaylistEditor({
  playlistId,
  initialTracks,
  initialSnapshotId,
  initialName,
  initialDescription,
}: {
  playlistId: string;
  initialTracks: SpotifyEditablePlaylistTrack[];
  initialSnapshotId: string;
  initialName: string;
  initialDescription: string;
}) {
  const [tracks, setTracks] = useState<TrackWithStreams[]>(() =>
    initialTracks.map((t) => ({ ...t, streams: null, streamsLoading: true })),
  );
  // ordem salva no Spotify (para poder cancelar)
  const [savedTracks, setSavedTracks] = useState<TrackWithStreams[]>(() =>
    initialTracks.map((t) => ({ ...t, streams: null, streamsLoading: true })),
  );
  const [snapshotId, setSnapshotId] = useState(initialSnapshotId);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [pendingReorder, setPendingReorder] = useState(false); // há mudança não salva
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  // ── Carrega streams Kworb em batches ────────────────────────────────────
  useEffect(() => {
    const ids = initialTracks.map((t) => t.id);
    const BATCH = 5;

    async function loadBatch(batch: string[]) {
      const results = await Promise.allSettled(
        batch.map((id) =>
          fetch(`/api/kworb/track/${id}`).then((r) => r.json() as Promise<KworbTrackData>),
        ),
      );
      const update = (prev: TrackWithStreams[]) =>
        prev.map((t) => {
          const idx = batch.indexOf(t.id);
          if (idx === -1) return t;
          const result = results[idx];
          return {
            ...t,
            streams: result.status === "fulfilled" ? result.value : null,
            streamsLoading: false,
          };
        });
      setTracks(update);
      setSavedTracks(update);
    }

    async function loadAll() {
      for (let i = 0; i < ids.length; i += BATCH) {
        await loadBatch(ids.slice(i, i + BATCH));
      }
    }
    void loadAll();
  }, [initialTracks]);

  // ── Reorder local (chamado pelo drag) ───────────────────────────────────
  const handleLocalReorder = useCallback((from: number, to: number) => {
    setTracks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setPendingReorder(true);
    setSelectedIndex(to);
  }, []);

  // ── Drag hooks ───────────────────────────────────────────────────────────
  const {
    tbodyRef,
    dragFrom,
    dragTo,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useDragSort(tracks, handleLocalReorder);

  // ── Confirmar nova ordem no Spotify ─────────────────────────────────────
  // A Spotify API só move 1 posição por vez, então fazemos as operações em sequência
  async function handleConfirmReorder() {
    setSaving(true);
    setError(null);

    try {
      // Calcula a sequência de movimentos necessários comparando
      // savedTracks (ordem original) com tracks (nova ordem)
      // Estratégia: envia a lista completa de URIs via PUT /playlists/{id}/tracks
      const uris = tracks.map((t) => `spotify:track:${t.id}`);

      const res = await fetch(`/api/spotify/playlists/${playlistId}/tracks/reorder-full`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris, snapshotId }),
      });

      const data = (await res.json()) as { success?: boolean; snapshotId?: string; message?: string };

      if (!res.ok || !data.success) {
        throw new Error(data.message ?? "Erro ao salvar ordem.");
      }

      if (data.snapshotId) setSnapshotId(data.snapshotId);
      setSavedTracks([...tracks]);
      setPendingReorder(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar ordem.");
    } finally {
      setSaving(false);
    }
  }

  // ── Cancelar reordenação ─────────────────────────────────────────────────
  function handleCancelReorder() {
    setTracks([...savedTracks]);
    setPendingReorder(false);
    setSelectedIndex(null);
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (index: number) => {
      const track = tracks[index];
      if (!track || deletingIndex !== null) return;

      setDeletingIndex(index);
      setError(null);

      try {
        const res = await fetch(`/api/spotify/playlists/${playlistId}/tracks`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackUri: `spotify:track:${track.id}`,
            snapshotId,
          }),
        });

        const data = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !data.success) throw new Error(data.message ?? "Erro ao remover faixa.");

        const updated = (prev: TrackWithStreams[]) => prev.filter((_, i) => i !== index);
        setTracks(updated);
        setSavedTracks(updated);
        setSelectedIndex((prev) => {
          if (prev === null) return null;
          if (prev >= tracks.length - 1) return Math.max(0, tracks.length - 2);
          return prev;
        });

        // Atualiza snapshotId
        const snapRes = await fetch(`/api/spotify/playlists/${playlistId}/snapshot`).catch(() => null);
        if (snapRes?.ok) {
          const snapData = (await snapRes.json()) as { snapshotId?: string };
          if (snapData.snapshotId) setSnapshotId(snapData.snapshotId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao remover faixa.");
      } finally {
        setDeletingIndex(null);
      }
    },
    [tracks, deletingIndex, playlistId, snapshotId],
  );

  // ── Teclado ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) return;
      if (selectedIndex === null) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        void handleDelete(selectedIndex);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min((i ?? 0) + 1, tracks.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max((i ?? 0) - 1, 0));
      } else if (e.key === "Escape") {
        setSelectedIndex(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, tracks.length]);

  // ── Salvar nome/desc ─────────────────────────────────────────────────────
  async function handleSaveName(newName: string) {
    const res = await fetch(`/api/spotify/playlists/${playlistId}/details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description }),
    });
    const data = (await res.json()) as { success?: boolean; message?: string };
    if (!data.success) throw new Error(data.message ?? "Erro ao salvar nome.");
    setName(newName);
  }

  async function handleSaveDescription(newDesc: string) {
    const res = await fetch(`/api/spotify/playlists/${playlistId}/details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: newDesc }),
    });
    const data = (await res.json()) as { success?: boolean; message?: string };
    if (!data.success) throw new Error(data.message ?? "Erro ao salvar descrição.");
    setDescription(newDesc);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Nome e descrição */}
      <div className="grid gap-3 laptop:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/70 p-4">
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Nome da playlist
          </div>
          <EditableField value={name} onSave={handleSaveName} placeholder="Nome da playlist" />
        </div>
        <div className="rounded-2xl border border-border bg-card/70 p-4">
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Descrição
          </div>
          <EditableField
            value={description}
            onSave={handleSaveDescription}
            multiline
            placeholder="Adicionar descrição..."
          />
        </div>
      </div>

      {/* Barra de status / confirmar ordem */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5">
            <span className="font-mono">↑↓</span> Navegar
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5">
            <span className="font-mono">Delete</span> Remover
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5">
            <GripVertical className="h-3.5 w-3.5" /> Segurar e arrastar
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pendingReorder ? (
            <>
              <span className="text-xs text-yellow-500 font-medium">
                Ordem alterada — não salva ainda
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelReorder}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => void handleConfirmReorder()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Salvar ordem
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">{tracks.length} faixas</span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
        <table className="min-w-[900px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="w-8 px-3 py-3" />
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Música</th>
              <th className="px-4 py-3">Artistas</th>
              <th className="px-4 py-3">Álbum</th>
              <th className="px-4 py-3">Pop.</th>
              <th className="px-4 py-3">Duração</th>
              <th className="px-4 py-3">
                <span className="flex items-center gap-1">
                  Streams ontem
                  <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] normal-case tracking-normal">
                    kworb
                  </span>
                </span>
              </th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody ref={tbodyRef} className="divide-y divide-border">
            {tracks.length > 0 ? (
              tracks.map((track, index) => {
                const isSelected = selectedIndex === index;
                const isDragging = dragFrom === index;
                const isDeleting = deletingIndex === index;

                // Calcula se esta linha deve aparecer deslocada visualmente
                // durante o drag (igual Spotify — as outras linhas se abrem)
                let translateY = 0;
                if (dragFrom !== null && dragTo !== null && dragFrom !== dragTo) {
                  if (index === dragFrom) {
                    // a linha arrastada: fica no lugar visualmente (o ghost se move)
                    translateY = 0;
                  } else if (dragFrom < dragTo) {
                    // arrastando pra baixo: linhas entre from+1 e to sobem
                    if (index > dragFrom && index <= dragTo) {
                      translateY = -48; // sobe uma posição
                    }
                  } else {
                    // arrastando pra cima: linhas entre to e from-1 descem
                    if (index >= dragTo && index < dragFrom) {
                      translateY = 48; // desce uma posição
                    }
                  }
                }

                return (
                  <tr
                    key={`${track.id}-${index}`}
                    onClick={() =>
                      !isDragging && setSelectedIndex(index === selectedIndex ? null : index)
                    }
                    onPointerDown={(e) => handlePointerDown(e, index)}
                    onPointerMove={(e) => handlePointerMove(e, index)}
                    onPointerUp={(e) => handlePointerUp(e, index)}
                    style={{
                      transform: `translateY(${translateY}px)`,
                      transition: isDragging ? "none" : "transform 150ms ease",
                      opacity: isDeleting ? 0.4 : isDragging ? 0.5 : 1,
                      cursor: isDragging ? "grabbing" : "pointer",
                      position: "relative",
                      zIndex: isDragging ? 10 : "auto",
                    }}
                    className={[
                      "select-none",
                      isSelected && !isDragging
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "hover:bg-muted/10",
                      isDeleting ? "pointer-events-none" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {/* Grip */}
                    <td className="px-3 py-3">
                      <div
                        data-grip="true"
                        className="flex cursor-grab items-center active:cursor-grabbing"
                        title="Arrastar para reordenar"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                      </div>
                    </td>

                    {/* # */}
                    <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        index + 1
                      )}
                    </td>

                    {/* Música */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-11 w-11 shrink-0 rounded-xl border border-border bg-muted"
                          style={coverStyle(track.imageUrl)}
                        />
                        <div className="min-w-0">
                          <div
                            className={[
                              "truncate font-semibold",
                              isSelected ? "text-primary" : "",
                            ].join(" ")}
                          >
                            {track.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Artistas */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {track.artists}
                    </td>

                    {/* Álbum */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {track.albumName}
                    </td>

                    {/* Pop */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${track.popularity}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium tabular-nums">
                          {track.popularity}
                        </span>
                      </div>
                    </td>

                    {/* Duração */}
                    <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                      {track.durationLabel}
                    </td>

                    {/* Streams Kworb */}
                    <td className="px-4 py-3">
                      {track.streamsLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
                      ) : (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatStreams(track.streams?.dailyStreams ?? null)}
                          </span>
                          {track.streams?.trend && track.streams.trend !== "same" && (
                            <span
                              className={[
                                "text-xs tabular-nums",
                                track.streams.trend === "up" ? "text-green-500" : "text-red-400",
                              ].join(" ")}
                            >
                              {formatDelta(track.streams.dailyDelta ?? null, track.streams.trend)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void handleDelete(index); }}
                          disabled={isDeleting || deletingIndex !== null || pendingReorder}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                          title="Remover da playlist"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <a
                          href={track.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-primary"
                          title="Abrir no Spotify"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  <Music2 className="mx-auto mb-3 h-5 w-5" />
                  Nenhuma faixa nesta playlist.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
