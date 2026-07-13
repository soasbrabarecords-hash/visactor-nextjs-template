"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GripVertical,
  Loader2,
  Minus,
  Music2,
  Sparkles,
  Trash2,
  Check,
  X,
  Pencil,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PlaylistIntelligencePanel from "@/components/workspace/playlist-intelligence-panel";
import ResizableTableOverlay from "@/components/workspace/resizable-table-overlay";
import type { SpotifyEditablePlaylistTrack } from "@/lib/spotify-user";
import { buildPlaylistIntelligence } from "@/lib/playlist-intelligence";
import type { KworbTrackData } from "@/app/api/kworb/track/[trackId]/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackWithStreams = SpotifyEditablePlaylistTrack & {
  instanceKey: string;
  streams: KworbTrackData | null;
  streamsLoading: boolean;
};

type DropIndicator = {
  slot: number;
  top: number;
};

type ChartData = {
  position: number;
  positionChange: number | null;
  movement: "up" | "down" | "stable" | "new";
  streams: number | null;
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

function ChartMovement({ movement, positionChange }: { movement: ChartData["movement"]; positionChange: number | null }) {
  if (movement === "new") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
        <Sparkles className="h-2.5 w-2.5" />
        NEW
      </span>
    );
  }
  if (movement === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400">
        <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
        <span className="text-[10px] font-semibold">{Math.abs(positionChange ?? 0)}</span>
      </span>
    );
  }
  if (movement === "down") {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-500 dark:text-red-400">
        <ArrowDown className="h-3 w-3" strokeWidth={2.5} />
        <span className="text-[10px] font-semibold">{Math.abs(positionChange ?? 0)}</span>
      </span>
    );
  }
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function formatDelta(n: number | null, trend: KworbTrackData["trend"]): string {
  if (n === null || trend === null) return "";
  if (trend === "same" || n === 0) return "";
  return `${trend === "up" ? "+" : ""}${formatStreams(n)}`;
}

function withEditorState(
  track: SpotifyEditablePlaylistTrack,
  index: number,
): TrackWithStreams {
  return {
    ...track,
    instanceKey: `${track.id}:${index}`,
    streams: null,
    streamsLoading: true,
  };
}

function findVerticalScrollContainer(element: HTMLElement) {
  let parent = element.parentElement;

  while (parent) {
    const styles = window.getComputedStyle(parent);
    const canScroll = /(auto|scroll)/.test(styles.overflowY);

    if (canScroll && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return window;
}

// ─── EditableField ────────────────────────────────────────────────────────────

export function EditableField({
  value, onSave, multiline = false, placeholder = "",
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

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

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
      <button type="button" onClick={() => { setDraft(value); setEditing(true); }}
        className="group flex items-center gap-2 text-left hover:opacity-80">
        <span>{value || <span className="italic text-muted-foreground">{placeholder}</span>}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  const cls = "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
  return (
    <div className="flex items-start gap-2">
      {multiline
        ? <textarea ref={inputRef as React.Ref<HTMLTextAreaElement>} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={handleKeyDown} rows={2} placeholder={placeholder} className={cls} />
        : <input ref={inputRef as React.Ref<HTMLInputElement>} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className={cls} />
      }
      <button type="button" onClick={() => void handleSave()} disabled={saving}
        className="mt-0.5 rounded-md p-1.5 text-green-500 hover:bg-green-500/10 disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button type="button" onClick={() => { setDraft(value); setEditing(false); }}
        className="mt-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted/40">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── reorderWithBlock — move um Set de índices para uma posição alvo ──────────
//
// Algoritmo igual Spotify:
//   1. Extrai as faixas selecionadas (em ordem)
//   2. Remove elas da lista
//   3. Calcula onde inserir baseado em quantas selecionadas estavam ANTES do alvo
//   4. Insere o bloco na posição correta
//
function reorderWithBlock(
  tracks: TrackWithStreams[],
  selectedSet: Set<number>,
  dropSlot: number,
): { nextTracks: TrackWithStreams[]; nextSelected: Set<number> } {
  const selIndices = [...selectedSet].sort((a, b) => a - b);
  const block = selIndices.map((i) => tracks[i]);
  const rest = tracks.filter((_, i) => !selectedSet.has(i));
  const clampedSlot = Math.max(0, Math.min(tracks.length, dropSlot));
  const insertPos = tracks.reduce(
    (count, _track, index) =>
      index < clampedSlot && !selectedSet.has(index) ? count + 1 : count,
    0,
  );

  const nextTracks = [
    ...rest.slice(0, insertPos),
    ...block,
    ...rest.slice(insertPos),
  ];

  // Recalcula os índices selecionados na nova lista
  const nextSelected = new Set<number>();
  for (let i = insertPos; i < insertPos + block.length; i++) {
    nextSelected.add(i);
  }

  return { nextTracks, nextSelected };
}

// ─── PlaylistEditor ───────────────────────────────────────────────────────────

export default function PlaylistEditor({
  playlistId,
  initialTracks,
  initialSnapshotId,
}: {
  playlistId: string;
  initialTracks: SpotifyEditablePlaylistTrack[];
  initialSnapshotId: string;
}) {
  const [tracks, setTracks] = useState<TrackWithStreams[]>(() =>
    initialTracks.map(withEditorState),
  );
  const [savedTracks, setSavedTracks] = useState<TrackWithStreams[]>(() =>
    initialTracks.map(withEditorState),
  );
  const [snapshotId, setSnapshotId] = useState(initialSnapshotId);

  // Seleção múltipla
  const [selectedSet, setSelectedSet] = useState<Set<number>>(new Set());
  const lastClickedIndex = useRef<number | null>(null); // âncora do Shift+Click

  // Drag state
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const draggingFrom = useRef<number | null>(null);
  const dragSelection = useRef<Set<number>>(new Set());
  const dragStartY = useRef(0);
  const dragStarted = useRef(false);
  const lastPointerY = useRef(0);
  const autoScrollFrame = useRef<number | null>(null);
  const scrollContainer = useRef<HTMLElement | Window | null>(null);
  const ignoreNextClick = useRef(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  // Chart snapshot data
  const [chartMap, setChartMap] = useState<Map<string, ChartData>>(new Map());
  const [chartLoading, setChartLoading] = useState(true);

  // Outros estados
  const [deletingIndices, setDeletingIndices] = useState<Set<number>>(new Set());
  const [pendingReorder, setPendingReorder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (autoScrollFrame.current !== null) {
      window.cancelAnimationFrame(autoScrollFrame.current);
    }
  }, []);

  // ── Kworb ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ids = initialTracks.map((t) => t.id);
    const BATCH = 5;
    async function loadBatch(batch: string[]) {
      const results = await Promise.allSettled(
        batch.map((id) => fetch(`/api/kworb/track/${id}`).then((r) => r.json() as Promise<KworbTrackData>)),
      );
      const update = (prev: TrackWithStreams[]) =>
        prev.map((t) => {
          const idx = batch.indexOf(t.id);
          if (idx === -1) return t;
          const result = results[idx];
          return { ...t, streams: result.status === "fulfilled" ? result.value : null, streamsLoading: false };
        });
      setTracks(update);
      setSavedTracks(update);
    }
    async function loadAll() {
      for (let i = 0; i < ids.length; i += BATCH) await loadBatch(ids.slice(i, i + BATCH));
    }
    void loadAll();
  }, [initialTracks]);

  // ── Chart snapshot BR ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadChart() {
      setChartLoading(true);
      try {
        const datesRes = await fetch("/api/charts/snapshot-dates?country=BR");
        if (!datesRes.ok) return;
        const datesData = (await datesRes.json()) as { dates: string[] };
        const latestDate = datesData.dates?.[0];
        if (!latestDate) return;

        const snapRes = await fetch(`/api/charts/snapshot?date=${latestDate}&country=BR`);
        if (!snapRes.ok) return;
        const snapData = (await snapRes.json()) as {
          tracks: Array<{
            spotify_track_id: string | null;
            position: number;
            position_change: number | null;
            status: "new" | "up" | "down" | "stable";
            streams: number | null;
          }>;
        };

        const map = new Map<string, ChartData>();
        for (const t of snapData.tracks ?? []) {
          if (!t.spotify_track_id) continue;
          map.set(t.spotify_track_id, {
            position: t.position,
            positionChange: t.position_change,
            movement: t.status,
            streams: t.streams,
          });
        }
        setChartMap(map);
      } catch {
        // silently fail — chart data is optional enrichment
      } finally {
        setChartLoading(false);
      }
    }
    void loadChart();
  }, []);

  // ── Seleção ───────────────────────────────────────────────────────────────
  function handleRowClick(e: React.MouseEvent, index: number) {
    // Não seleciona se clicou num botão/link de ação
    if ((e.target as HTMLElement).closest("a, button")) return;
    if (ignoreNextClick.current) {
      ignoreNextClick.current = false;
      return;
    }

    if (e.shiftKey && lastClickedIndex.current !== null) {
      // Range selection: do último clicado até aqui
      const from = Math.min(lastClickedIndex.current, index);
      const to = Math.max(lastClickedIndex.current, index);
      const next = new Set<number>();
      for (let i = from; i <= to; i++) next.add(i);
      setSelectedSet(next);
      // NÃO atualiza lastClickedIndex no shift — âncora permanece
    } else {
      // Click normal: toggle individual
      setSelectedSet((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
          if (next.size === 0) lastClickedIndex.current = null;
        } else {
          next.add(index);
          lastClickedIndex.current = index;
        }
        return next;
      });
      lastClickedIndex.current = index;
    }
  }

  // ── Drag (pointer events) ─────────────────────────────────────────────────
  function resolveDropIndicator(clientY: number): DropIndicator | null {
    const tbody = tbodyRef.current;
    const wrapper = tableWrapperRef.current;

    if (!tbody || !wrapper) {
      return null;
    }

    const rows = tbody.rows;
    if (rows.length === 0) {
      return null;
    }

    let low = 0;
    let high = rows.length;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const rect = rows[middle].getBoundingClientRect();

      if (clientY < rect.top + rect.height / 2) {
        high = middle;
      } else {
        low = middle + 1;
      }
    }

    const slot = low;

    const lineY =
      slot < rows.length
        ? rows[slot].getBoundingClientRect().top
        : rows[rows.length - 1].getBoundingClientRect().bottom;
    const wrapperRect = wrapper.getBoundingClientRect();

    return {
      slot,
      top: lineY - wrapperRect.top + wrapper.scrollTop,
    };
  }

  function updateDropIndicator(clientY: number) {
    const indicator = resolveDropIndicator(clientY);
    if (indicator) {
      setDropIndicator((current) =>
        current?.slot === indicator.slot && Math.abs(current.top - indicator.top) < 0.5
          ? current
          : indicator,
      );
    }
    return indicator;
  }

  function stopAutoScroll() {
    if (autoScrollFrame.current !== null) {
      window.cancelAnimationFrame(autoScrollFrame.current);
      autoScrollFrame.current = null;
    }
  }

  function startAutoScroll() {
    stopAutoScroll();

    const tick = () => {
      if (draggingFrom.current === null) {
        autoScrollFrame.current = null;
        return;
      }

      if (!dragStarted.current) {
        autoScrollFrame.current = window.requestAnimationFrame(tick);
        return;
      }

      const container = scrollContainer.current;
      const pointerY = lastPointerY.current;
      const viewportTop = container instanceof HTMLElement
        ? container.getBoundingClientRect().top
        : 0;
      const viewportBottom = container instanceof HTMLElement
        ? container.getBoundingClientRect().bottom
        : window.innerHeight;
      const edge = Math.min(112, (viewportBottom - viewportTop) * 0.18);
      let speed = 0;

      if (pointerY < viewportTop + edge) {
        speed = -Math.ceil(((viewportTop + edge - pointerY) / edge) * 18);
      } else if (pointerY > viewportBottom - edge) {
        speed = Math.ceil(((pointerY - (viewportBottom - edge)) / edge) * 18);
      }

      if (speed !== 0) {
        if (container instanceof HTMLElement) {
          container.scrollTop += speed;
        } else {
          window.scrollBy({ top: speed });
        }
        updateDropIndicator(pointerY);
      }

      autoScrollFrame.current = window.requestAnimationFrame(tick);
    };

    autoScrollFrame.current = window.requestAnimationFrame(tick);
  }

  function clearDragState() {
    stopAutoScroll();
    draggingFrom.current = null;
    dragSelection.current = new Set();
    dragStarted.current = false;
    scrollContainer.current = null;
    setDragFrom(null);
    setDropIndicator(null);
  }

  function handlePointerDown(e: React.PointerEvent, index: number) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, textarea")) return;
    if (e.pointerType === "touch" && !target.closest("[data-grip]")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    let activeSelection: Set<number>;

    if (e.shiftKey && lastClickedIndex.current !== null) {
      const from = Math.min(lastClickedIndex.current, index);
      const to = Math.max(lastClickedIndex.current, index);
      activeSelection = new Set<number>();
      for (let i = from; i <= to; i++) activeSelection.add(i);
      setSelectedSet(activeSelection);
    } else if (!selectedSet.has(index)) {
      activeSelection = new Set([index]);
      setSelectedSet(activeSelection);
      lastClickedIndex.current = index;
    } else {
      activeSelection = new Set(selectedSet);
    }

    draggingFrom.current = index;
    dragSelection.current = activeSelection;
    dragStartY.current = e.clientY;
    lastPointerY.current = e.clientY;
    dragStarted.current = false;
    scrollContainer.current = findVerticalScrollContainer(e.currentTarget as HTMLElement);
    setDragFrom(index);
    setDropIndicator(null);
    startAutoScroll();
  }

  function handlePointerMove(e: React.PointerEvent, index: number) {
    if (draggingFrom.current !== index) return;
    e.preventDefault();
    lastPointerY.current = e.clientY;
    const deltaY = e.clientY - dragStartY.current;
    if (!dragStarted.current && Math.abs(deltaY) < 6) return;
    dragStarted.current = true;
    updateDropIndicator(e.clientY);
  }

  function handlePointerUp(e: React.PointerEvent, index: number) {
    if (draggingFrom.current !== index) return;
    e.preventDefault();

    const deltaY = e.clientY - dragStartY.current;
    if (!dragStarted.current && Math.abs(deltaY) < 6) {
      clearDragState();
      return;
    }

    const indicator = updateDropIndicator(e.clientY);
    const activeSelection = new Set(dragSelection.current);
    ignoreNextClick.current = true;

    if (indicator && activeSelection.size > 0) {
      const { nextTracks, nextSelected } = reorderWithBlock(
        tracks,
        activeSelection,
        indicator.slot,
      );
      const orderChanged = nextTracks.some(
        (track, trackIndex) => track.instanceKey !== tracks[trackIndex]?.instanceKey,
      );

      if (orderChanged) {
        setTracks(nextTracks);
        setSelectedSet(nextSelected);
        lastClickedIndex.current = null;
        setPendingReorder(true);
      }
    }

    clearDragState();
  }

  function handlePointerCancel(index: number) {
    if (draggingFrom.current === index) {
      clearDragState();
    }
  }

  async function savePlaylistOrder(nextTracks: TrackWithStreams[]) {
    setSaving(true);
    setError(null);
    try {
      const uris = nextTracks.map((t) => `spotify:track:${t.id}`);
      const res = await fetch(`/api/spotify/playlists/${playlistId}/tracks/reorder-full`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris, snapshotId }),
      });
      const data = (await res.json()) as { success?: boolean; snapshotId?: string; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message ?? "Erro ao salvar ordem.");
      if (data.snapshotId) setSnapshotId(data.snapshotId);
      setTracks([...nextTracks]);
      setSavedTracks([...nextTracks]);
      setPendingReorder(false);
      setSelectedSet(new Set());
      lastClickedIndex.current = null;
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar ordem.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // ── Confirmar reordenação ─────────────────────────────────────────────────
  async function handleConfirmReorder() {
    await savePlaylistOrder(tracks);
  }

  function handleCancelReorder() {
    setTracks([...savedTracks]);
    setPendingReorder(false);
    setSelectedSet(new Set());
    lastClickedIndex.current = null;
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (indicesToDelete: Set<number>) => {
      if (indicesToDelete.size === 0 || deletingIndices.size > 0) return;
      setDeletingIndices(new Set(indicesToDelete));
      setError(null);

      try {
        // Remove uma a uma em sequência (snapshot_id atualiza a cada remoção)
        let currentSnapshot = snapshotId;
        const sortedIndices = [...indicesToDelete].sort((a, b) => b - a); // de trás pra frente

        for (const idx of sortedIndices) {
          const track = tracks[idx];
          if (!track) continue;
          const res = await fetch(`/api/spotify/playlists/${playlistId}/tracks`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trackUri: `spotify:track:${track.id}`, snapshotId: currentSnapshot }),
          });
          const data = (await res.json()) as { success?: boolean; message?: string };
          if (!res.ok || !data.success) throw new Error(data.message ?? "Erro ao remover faixa.");

          // Atualiza snapshot
          const snapRes = await fetch(`/api/spotify/playlists/${playlistId}/snapshot`).catch(() => null);
          if (snapRes?.ok) {
            const snapData = (await snapRes.json()) as { snapshotId?: string };
            if (snapData.snapshotId) currentSnapshot = snapData.snapshotId;
          }
        }

        setSnapshotId(currentSnapshot);
        const indicesSet = new Set(indicesToDelete);
        const updated = (prev: TrackWithStreams[]) => prev.filter((_, i) => !indicesSet.has(i));
        setTracks(updated);
        setSavedTracks(updated);
        setSelectedSet(new Set());
        lastClickedIndex.current = null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao remover faixas.");
      } finally {
        setDeletingIndices(new Set());
      }
    },
    [tracks, deletingIndices, playlistId, snapshotId],
  );

  // ── Teclado ───────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement) return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedSet.size > 0) {
        e.preventDefault();
        void handleDelete(selectedSet);
        return;
      }

      // Navegar com setas (sem shift = move seleção única)
      if (e.key === "ArrowDown" && !e.shiftKey) {
        e.preventDefault();
        const max = tracks.length - 1;
        if (lastClickedIndex.current === null) {
          setSelectedSet(new Set([0]));
          lastClickedIndex.current = 0;
        } else {
          const next = Math.min(lastClickedIndex.current + 1, max);
          setSelectedSet(new Set([next]));
          lastClickedIndex.current = next;
        }
      } else if (e.key === "ArrowUp" && !e.shiftKey) {
        e.preventDefault();
        if (lastClickedIndex.current === null) {
          setSelectedSet(new Set([0]));
          lastClickedIndex.current = 0;
        } else {
          const next = Math.max(lastClickedIndex.current - 1, 0);
          setSelectedSet(new Set([next]));
          lastClickedIndex.current = next;
        }
      } else if (e.key === "ArrowDown" && e.shiftKey) {
        // Shift+Arrow: expande range
        e.preventDefault();
        if (lastClickedIndex.current !== null) {
          const anchor = lastClickedIndex.current;
          const currentMax = selectedSet.size > 0 ? Math.max(...selectedSet) : anchor;
          const next = Math.min(currentMax + 1, tracks.length - 1);
          const from = Math.min(anchor, next);
          const to = Math.max(anchor, next);
          const range = new Set<number>();
          for (let i = from; i <= to; i++) range.add(i);
          setSelectedSet(range);
        }
      } else if (e.key === "ArrowUp" && e.shiftKey) {
        e.preventDefault();
        if (lastClickedIndex.current !== null) {
          const anchor = lastClickedIndex.current;
          const currentMin = selectedSet.size > 0 ? Math.min(...selectedSet) : anchor;
          const next = Math.max(currentMin - 1, 0);
          const from = Math.min(anchor, next);
          const to = Math.max(anchor, next);
          const range = new Set<number>();
          for (let i = from; i <= to; i++) range.add(i);
          setSelectedSet(range);
        }
      } else if (e.key === "Escape") {
        setSelectedSet(new Set());
        lastClickedIndex.current = null;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSet, tracks.length]);

  const isActivelyDragging = dragFrom !== null && dropIndicator !== null;
  const dropPosition = dropIndicator
    ? tracks.reduce(
        (position, _track, index) =>
          index < dropIndicator.slot && !dragSelection.current.has(index)
            ? position + 1
            : position,
        1,
      )
    : null;
  const intelligence = useMemo(
    () => buildPlaylistIntelligence(
      tracks.map((track, index) => {
        const chartData = chartMap.get(track.id) ?? null;

        return {
          id: track.id,
          name: track.name,
          artists: track.artists,
          imageUrl: track.imageUrl,
          currentIndex: index,
          popularity: track.popularity,
          chartPosition: chartData?.position ?? null,
          chartMovement: chartData?.movement ?? null,
          chartPositionChange: chartData?.positionChange ?? null,
          chartStreams: chartData?.streams ?? null,
          dailyStreams: track.streams?.dailyStreams ?? null,
          dailyDelta: track.streams?.dailyDelta ?? null,
          streamTrend: track.streams?.trend ?? null,
          streamsLoading: track.streamsLoading,
          signalsLoading: chartLoading || track.streamsLoading,
        };
      }),
    ),
    [chartLoading, chartMap, tracks],
  );
  const decisionByTrackKey = useMemo(
    () => new Map(intelligence.decisions.map((decision) => [decision.trackKey, decision])),
    [intelligence.decisions],
  );
  const isIntelligenceEnriching = chartLoading || tracks.some((track) => track.streamsLoading);
  async function handleApplySuggestedOrder() {
    if (pendingReorder) {
      setError("Salve ou cancele a ordem manual antes de aplicar a sugestao da IA.");
      return false;
    }

    const trackByKey = new Map(
      tracks.map((track, index) => [`${track.id}:${index}`, track]),
    );
    const suggestedTracks = [...intelligence.decisions]
      .sort((a, b) => a.suggestedIndex - b.suggestedIndex)
      .map((decision) => trackByKey.get(decision.trackKey))
      .filter((track): track is TrackWithStreams => Boolean(track));

    if (suggestedTracks.length !== tracks.length) {
      setError("Nao foi possivel montar a ordem sugerida. Recarregue a playlist e tente de novo.");
      return false;
    }

    return savePlaylistOrder(suggestedTracks);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PlaylistIntelligencePanel
        intelligence={intelligence}
        isEnriching={isIntelligenceEnriching}
        isApplyingOrder={saving}
        applyDisabledReason={
          pendingReorder
            ? "Salve ou cancele a ordem manual antes."
            : isIntelligenceEnriching
              ? "Aguarde os sinais terminarem de carregar."
              : undefined
        }
        onApplySuggestedOrder={handleApplySuggestedOrder}
      />

      {/* Guia curto de seleção e estado atual */}
      <div className="grid gap-2 border-y border-border/70 py-2.5 text-xs text-muted-foreground tablet:grid-cols-[1fr_auto] tablet:items-center">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span><strong className="font-semibold text-foreground">Click</strong> seleciona</span>
          <span><strong className="font-semibold text-foreground">Shift + click</strong> cria um bloco</span>
          <span className="inline-flex items-center gap-1"><GripVertical className="h-3.5 w-3.5" /> arraste até a linha azul</span>
        </div>
        <div className="font-medium tabular-nums text-foreground">
          {selectedSet.size > 0
            ? `${selectedSet.size} selecionada${selectedSet.size > 1 ? "s" : ""}`
            : `${tracks.length} faixas`}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/*
        Tabela responsiva estilo Spotify
        - Coluna "Música" agora inclui capa + título + artistas (estilo Spotify)
        - Colunas secundárias escondem progressivamente em telas menores
      */}
      <div
        ref={tableWrapperRef}
        data-spotify-table-wrapper
        className="relative overflow-x-auto rounded-2xl border border-border bg-card/60"
      >
        {isActivelyDragging && dropIndicator ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 z-50 h-[3px] -translate-y-1/2 bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.75)]"
            style={{ top: dropIndicator.top }}
          >
            <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground shadow-lg">
              Soltar {dragSelection.current.size} faixa{dragSelection.current.size > 1 ? "s" : ""} · posição {dropPosition}
            </span>
          </div>
        ) : null}
        <table ref={tableRef} className="w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="w-[72px] px-2 py-3 text-center sm:px-4">#</th>
              <th className="px-3 py-3 sm:px-4">Música</th>
              <th className="hidden px-3 py-3 sm:px-4 tablet:table-cell">Pop.</th>
              <th className="hidden px-4 py-3 desktop:table-cell">Duração</th>
              <th className="px-3 py-3 sm:px-4">
                <span className="flex items-center gap-1">
                  Streams
                  <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] normal-case tracking-normal">kworb</span>
                </span>
              </th>
              <th className="hidden px-4 py-3 laptop:table-cell">
                <span className="flex items-center gap-1">
                  Chart BR
                  <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] normal-case tracking-normal">top 200</span>
                </span>
              </th>
              <th className="px-3 py-3 sm:px-4">Ações</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody ref={tbodyRef} className="divide-y divide-border">
            {tracks.length > 0 ? tracks.map((track, index) => {
              const isSelected = selectedSet.has(index);
              const isDraggingThis = dragFrom === index;
              const isDeleting = deletingIndices.has(index);
              const decision = decisionByTrackKey.get(`${track.id}:${index}`);

              return (
                <tr
                  key={track.instanceKey}
                  onClick={(e) => handleRowClick(e, index)}
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  onPointerMove={(e) => handlePointerMove(e, index)}
                  onPointerUp={(e) => handlePointerUp(e, index)}
                  onPointerCancel={() => handlePointerCancel(index)}
                  style={{
                    opacity: isDeleting ? 0.3 : isActivelyDragging && isSelected ? 0.58 : 1,
                    cursor: isDraggingThis && isActivelyDragging ? "grabbing" : "grab",
                    position: "relative",
                    zIndex: isSelected && isActivelyDragging ? 20 : isActivelyDragging ? 1 : "auto",
                  }}
                  className={[
                    "group h-16 select-none overflow-hidden",
                    isSelected
                      ? isActivelyDragging
                        ? "bg-primary/15"
                        : "bg-primary/10 hover:bg-muted/15"
                      : "hover:bg-muted/15",
                    isDeleting ? "pointer-events-none" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {/* # */}
                  <td className="h-16 w-[72px] overflow-hidden px-2 py-0 align-middle text-center text-sm tabular-nums text-muted-foreground sm:px-4">
                    {isDeleting
                      ? <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      : (
                        <span
                          className={[
                            "inline-block w-[3ch] text-center",
                            isSelected ? "font-semibold text-primary" : "",
                          ].join(" ")}
                        >
                          {index + 1}
                        </span>
                      )
                    }
                  </td>

                  {/* Música — capa + título + artistas (estilo Spotify) */}
                  <td className="h-16 min-w-0 overflow-hidden px-3 py-0 align-middle sm:px-4">
                    <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                      <div
                        className={["flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-muted sm:rounded-xl",
                          isSelected ? "border-primary/40" : "border-border"].join(" ")}
                        style={coverStyle(track.imageUrl)}
                      />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div
                          className={[
                            "overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-tight sm:text-[15px]",
                            isSelected ? "text-primary" : "",
                          ].join(" ")}
                          title={track.name}
                        >
                          {track.name}
                        </div>
                        <div
                          className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground sm:text-[13px]"
                          title={track.artists}
                        >
                          {track.artists}
                        </div>
                        {decision && (
                          <div className="mt-1 flex min-w-0 items-center gap-1.5">
                            <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                              {decision.label}
                            </span>
                            <span className="hidden truncate text-[10px] font-medium text-muted-foreground laptop:inline">
                              sugerida #{decision.suggestedIndex + 1} | {decision.score}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Popularidade */}
                  <td className="hidden h-16 overflow-hidden px-3 py-0 align-middle sm:px-4 tablet:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted laptop:block laptop:w-20">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${track.popularity}%` }} />
                      </div>
                      <span className="text-sm font-medium tabular-nums">{track.popularity}</span>
                    </div>
                  </td>

                  {/* Duração — escondida em mobile */}
                  <td className="hidden h-16 overflow-hidden px-4 py-0 align-middle text-sm tabular-nums text-muted-foreground desktop:table-cell">
                    {track.durationLabel}
                  </td>

                  {/* Streams — permanece visível */}
                  <td className="h-16 overflow-hidden px-3 py-0 align-middle sm:px-4">
                    {track.streamsLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
                      : (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatStreams(track.streams?.dailyStreams ?? null)}
                          </span>
                          {track.streams?.trend && track.streams.trend !== "same" && (
                            <span className={["text-xs tabular-nums",
                              track.streams.trend === "up" ? "text-green-500" : "text-red-400"].join(" ")}>
                              {formatDelta(track.streams.dailyDelta ?? null, track.streams.trend)}
                            </span>
                          )}
                        </div>
                      )
                    }
                  </td>

                  {/* Chart BR — escondida em mobile/tablet */}
                  <td className="hidden h-16 overflow-hidden px-4 py-0 align-middle laptop:table-cell">
                    {chartLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/40" />
                    ) : (() => {
                      const cd = chartMap.get(track.id) ?? null;
                      if (!cd) {
                        return <span className="text-sm text-muted-foreground">—</span>;
                      }
                      return (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold tabular-nums">#{cd.position}</span>
                            <ChartMovement movement={cd.movement} positionChange={cd.positionChange} />
                          </div>
                          {cd.streams !== null && (
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              {formatStreams(cd.streams)}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  {/* Ações */}
                  <td className="h-16 overflow-hidden px-3 py-0 align-middle sm:px-4">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); void handleDelete(isSelected ? selectedSet : new Set([index])); }}
                        disabled={isDeleting || deletingIndices.size > 0 || pendingReorder}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                        title={isSelected && selectedSet.size > 1 ? `Remover ${selectedSet.size} faixas` : "Remover da playlist"}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <a href={track.spotifyUrl} target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-primary sm:inline-flex">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </td>

                  {/* Grip (movido pro final) */}
                  <td className="h-16 overflow-hidden px-3 py-0 align-middle">
                    <div data-grip="true"
                      className={`flex cursor-grab touch-none items-center transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-active:opacity-100"}`}
                      title={selectedSet.size > 1 && isSelected ? `Arrastar ${selectedSet.size} faixas` : "Arrastar para reordenar"}>
                      <GripVertical className="h-4 w-4 pointer-events-none text-muted-foreground/50" />
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <Music2 className="mx-auto mb-3 h-5 w-5" />
                  Nenhuma faixa nesta playlist.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {/*
          Handles de redimensionamento + auto-fit + sticky columns
          ────────────────────────────────────────────────────────
          - autoFit: distribui o espaço disponível proporcionalmente (estilo Spotify)
          - columnWeights: Música ganha mais espaço; Streams continua visível
          - stickyLeft: # (idx 0) fica fixa à esquerda quando rola horizontal
          - stickyRight: Ações (idx 6) fica fixa à direita
          - Grip (idx 0) tem peso baixo pra ficar pequena
        */}
        <ResizableTableOverlay
          tableRef={tableRef}
          storageKey="playlist-editor-cols-v2"
          fixedColumns={[0, 6, 7]}
          autoFit
          columnWeights={{ 0: 0.65, 1: 3.4, 2: 0.95, 3: 0.7, 4: 1.2, 5: 1, 6: 0.6, 7: 0.3 }}
          minWidths={{ 0: 64, 1: 240, 2: 96, 3: 74, 4: 126, 5: 100, 6: 88, 7: 32 }}
          stickyLeft={[0]}
          stickyRight={[6, 7]}
        />
      </div>

      {pendingReorder ? (
        <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[70] flex justify-center tablet:left-[248px] tablet:justify-end tablet:right-6">
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex w-full max-w-[560px] items-center justify-between gap-3 rounded-2xl border border-white/15 bg-slate-950/92 p-2.5 pl-4 text-white shadow-[0_20px_70px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Nova ordem pronta</p>
              <p className="truncate text-[11px] text-white/60">Revise a lista e confirme para atualizar o Spotify.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handleCancelReorder} disabled={saving} className="rounded-xl text-white/72 hover:bg-white/10 hover:text-white">
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
              <Button size="sm" onClick={() => void handleConfirmReorder()} disabled={saving} className="rounded-xl bg-white text-slate-950 hover:bg-white/90">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Confirmar ordem
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
