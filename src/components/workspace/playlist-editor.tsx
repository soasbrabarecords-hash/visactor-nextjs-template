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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SpotifyEditablePlaylistTrack } from "@/lib/spotify-user";
import type { KworbTrackData } from "@/app/api/kworb/track/[trackId]/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackWithStreams = SpotifyEditablePlaylistTrack & {
  streams: KworbTrackData | null;
  streamsLoading: boolean;
};

type DragState = {
  dragIndex: number;
  overIndex: number;
} | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Componente de edição inline de título/desc ───────────────────────────────

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

// ─── Componente principal ─────────────────────────────────────────────────────

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
  const [snapshotId, setSnapshotId] = useState(initialSnapshotId);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const tableRef = useRef<HTMLDivElement>(null);
  const dragOver = useRef<number | null>(null);

  // ── Carrega streams do Kworb em paralelo (batches de 5) ──────────────────
  useEffect(() => {
    const ids = initialTracks.map((t) => t.id);
    const BATCH = 5;

    async function loadBatch(batch: string[]) {
      const results = await Promise.allSettled(
        batch.map((id) =>
          fetch(`/api/kworb/track/${id}`).then((r) => r.json() as Promise<KworbTrackData>),
        ),
      );
      setTracks((prev) =>
        prev.map((t) => {
          const idx = batch.indexOf(t.id);
          if (idx === -1) return t;
          const result = results[idx];
          return {
            ...t,
            streams: result.status === "fulfilled" ? result.value : null,
            streamsLoading: false,
          };
        }),
      );
    }

    async function loadAll() {
      for (let i = 0; i < ids.length; i += BATCH) {
        await loadBatch(ids.slice(i, i + BATCH));
      }
    }

    void loadAll();
  }, [initialTracks]);

  // ── Navegação por teclado ─────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignora se foco está em input/textarea
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) return;

      if (selectedIndex === null) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        void handleDelete(selectedIndex);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min((i ?? 0) + 1, tracks.length - 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max((i ?? 0) - 1, 0));
        return;
      }

      if (e.key === "Escape") {
        setSelectedIndex(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, tracks.length, snapshotId]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (index: number) => {
      const track = tracks[index];
      if (!track || deletingIndex !== null) return;

      setDeletingIndex(index);
      setError(null);

      try {
        const res = await fetch(
          `/api/spotify/playlists/${playlistId}/tracks`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trackUri: `spotify:track:${track.id}`,
              snapshotId,
            }),
          },
        );

        const data = (await res.json()) as { success?: boolean; message?: string };

        if (!res.ok || !data.success) {
          throw new Error(data.message ?? "Erro ao remover faixa.");
        }

        setTracks((prev) => prev.filter((_, i) => i !== index));
        setSelectedIndex((prev) => {
          if (prev === null) return null;
          if (prev >= tracks.length - 1) return Math.max(0, tracks.length - 2);
          return prev;
        });

        // Atualiza snapshot_id
        const snapRes = await fetch(
          `/api/spotify/playlists/${playlistId}/snapshot`,
        ).catch(() => null);
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

  // ── Reorder (drag and drop) ───────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    setDragState({ dragIndex: index, overIndex: index });
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragState && dragState.overIndex !== index) {
      setDragState((prev) => prev ? { ...prev, overIndex: index } : prev);
    }
    dragOver.current = index;
  }

  function handleDragEnd() {
    setDragState(null);
    dragOver.current = null;
  }

  async function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    const fromIndex = dragOver.current ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
    setDragState(null);
    dragOver.current = null;

    if (fromIndex === dropIndex || Number.isNaN(fromIndex)) return;

    // Reordena localmente
    const newTracks = [...tracks];
    const [moved] = newTracks.splice(fromIndex, 1);
    newTracks.splice(dropIndex, 0, moved);
    setTracks(newTracks);
    setSelectedIndex(dropIndex);
    setReordering(true);
    setError(null);

    // insertBefore: se movendo pra baixo, dropIndex+1 (item vai depois da posição)
    const insertBefore = fromIndex < dropIndex ? dropIndex + 1 : dropIndex;

    try {
      const res = await fetch(
        `/api/spotify/playlists/${playlistId}/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rangeStart: fromIndex,
            insertBefore,
            snapshotId,
          }),
        },
      );

      const data = (await res.json()) as { success?: boolean; snapshotId?: string; message?: string };

      if (!res.ok || !data.success) {
        throw new Error(data.message ?? "Erro ao reordenar.");
      }

      if (data.snapshotId) setSnapshotId(data.snapshotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reordenar faixas.");
      // Reverte
      setTracks(tracks);
    } finally {
      setReordering(false);
    }
  }

  // ── Salvar título/descrição ───────────────────────────────────────────────
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

  return (
    <div className="space-y-6">
      {/* Edição de nome e descrição */}
      <div className="grid gap-3 laptop:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/70 p-4">
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Nome da playlist
          </div>
          <EditableField
            value={name}
            onSave={handleSaveName}
            placeholder="Nome da playlist"
          />
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

      {/* Instruções e estado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5">
            <span className="font-mono">↑↓</span> Navegar
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5">
            <span className="font-mono">Delete</span> Remover selecionada
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5">
            <GripVertical className="h-3.5 w-3.5" /> Arrastar para reordenar
          </span>
        </div>
        <div className="flex items-center gap-2">
          {reordering && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando ordem...
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {tracks.length} faixas
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tabela de faixas */}
      <div ref={tableRef} className="overflow-x-auto rounded-2xl border border-border bg-card/60">
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
          <tbody className="divide-y divide-border">
            {tracks.length > 0 ? (
              tracks.map((track, index) => {
                const isSelected = selectedIndex === index;
                const isDragging = dragState?.dragIndex === index;
                const isDragOver = dragState?.overIndex === index && dragState.dragIndex !== index;
                const isDeleting = deletingIndex === index;

                return (
                  <tr
                    key={`${track.id}-${index}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => void handleDrop(e, index)}
                    onClick={() => setSelectedIndex(index === selectedIndex ? null : index)}
                    className={[
                      "cursor-pointer select-none transition-colors",
                      isSelected
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "hover:bg-muted/10",
                      isDragging ? "opacity-40" : "",
                      isDragOver
                        ? "border-t-2 border-primary"
                        : "",
                      isDeleting ? "opacity-50 pointer-events-none" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {/* Grip */}
                    <td className="px-3 py-3">
                      <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/50 active:cursor-grabbing" />
                    </td>

                    {/* Número */}
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

                    {/* Popularidade */}
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
                                track.streams.trend === "up"
                                  ? "text-green-500"
                                  : "text-red-400",
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
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(index);
                          }}
                          disabled={isDeleting || deletingIndex !== null}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                          title="Remover da playlist (Delete)"
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
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
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
