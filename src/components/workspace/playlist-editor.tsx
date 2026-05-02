"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import ResizableTableOverlay from "@/components/workspace/resizable-table-overlay";
import type { SpotifyEditablePlaylistTrack } from "@/lib/spotify-user";
import type { KworbTrackData } from "@/app/api/kworb/track/[trackId]/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackWithStreams = SpotifyEditablePlaylistTrack & {
  streams: KworbTrackData | null;
  streamsLoading: boolean;
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
  _dragFromIndex: number,
  dropIndex: number,
): { nextTracks: TrackWithStreams[]; nextSelected: Set<number> } {
  // Índices selecionados em ordem
  const selIndices = [...selectedSet].sort((a, b) => a - b);

  // Faixas selecionadas (bloco a mover)
  const block = selIndices.map((i) => tracks[i]);

  // Lista sem o bloco
  const rest = tracks.filter((_, i) => !selectedSet.has(i));

  // Abordagem mais simples e correta:
  // Conta quantos itens não-selecionados existem antes de dropIndex
  let insertPos = 0;
  let passed = 0;
  for (let i = 0; i < tracks.length; i++) {
    if (passed >= dropIndex) break;
    if (!selectedSet.has(i)) passed++;
    insertPos++;
  }
  // Se o drop foi para depois do último, insere no fim
  if (dropIndex >= tracks.length - selIndices.length + 1) {
    insertPos = rest.length;
  }

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
    initialTracks.map((t) => ({ ...t, streams: null, streamsLoading: true })),
  );
  const [savedTracks, setSavedTracks] = useState<TrackWithStreams[]>(() =>
    initialTracks.map((t) => ({ ...t, streams: null, streamsLoading: true })),
  );
  const [snapshotId, setSnapshotId] = useState(initialSnapshotId);

  // Seleção múltipla
  const [selectedSet, setSelectedSet] = useState<Set<number>>(new Set());
  const lastClickedIndex = useRef<number | null>(null); // âncora do Shift+Click

  // Drag state
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const draggingFrom = useRef<number | null>(null);
  const dragStartY = useRef(0);
  const dragStarted = useRef(false);
  const ignoreNextClick = useRef(false);
  const rowHeight = useRef(60);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);

  // Chart snapshot data
  const [chartMap, setChartMap] = useState<Map<string, ChartData>>(new Map());
  const [chartLoading, setChartLoading] = useState(true);

  // Outros estados
  const [deletingIndices, setDeletingIndices] = useState<Set<number>>(new Set());
  const [pendingReorder, setPendingReorder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  function handlePointerDown(e: React.PointerEvent, index: number) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, textarea")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    // Se Shift segurado: estende range entre âncora e este index AQUI mesmo
    // (o handleRowClick é cancelado pelo ignoreNextClick depois do drag)
    if (e.shiftKey && lastClickedIndex.current !== null) {
      const from = Math.min(lastClickedIndex.current, index);
      const to = Math.max(lastClickedIndex.current, index);
      const range = new Set<number>();
      for (let i = from; i <= to; i++) range.add(i);
      setSelectedSet(range);
      // NÃO atualiza lastClickedIndex — âncora permanece
    } else if (!selectedSet.has(index)) {
      // Click normal numa linha não selecionada: seleciona só ela
      setSelectedSet(new Set([index]));
      lastClickedIndex.current = index;
    }

    draggingFrom.current = index;
    dragStartY.current = e.clientY;
    dragStarted.current = false;

    if (tbodyRef.current) {
      const firstRow = tbodyRef.current.querySelector("tr");
      if (firstRow) rowHeight.current = firstRow.getBoundingClientRect().height;
    }

    setDragFrom(index);
    setDragTo(null);
  }

  function handlePointerMove(e: React.PointerEvent, index: number) {
    if (draggingFrom.current !== index) return;
    e.preventDefault();
    const deltaY = e.clientY - dragStartY.current;
    if (!dragStarted.current && Math.abs(deltaY) < 6) return;
    dragStarted.current = true;
    const deltaRows = Math.round(deltaY / rowHeight.current);
    const newIndex = Math.max(0, Math.min(tracks.length - 1, index + deltaRows));
    setDragTo(newIndex);
  }

  function handlePointerUp(e: React.PointerEvent, index: number) {
    if (draggingFrom.current !== index) return;
    e.preventDefault();

    const deltaY = e.clientY - dragStartY.current;
    if (!dragStarted.current && Math.abs(deltaY) < 6) {
      draggingFrom.current = null;
      dragStarted.current = false;
      setDragFrom(null);
      setDragTo(null);
      return;
    }

    const deltaRows = Math.round(deltaY / rowHeight.current);
    const newIndex = Math.max(0, Math.min(tracks.length - 1, index + deltaRows));

    draggingFrom.current = null;
    dragStarted.current = false;
    ignoreNextClick.current = true;
    setDragFrom(null);
    setDragTo(null);

    if (newIndex !== index || selectedSet.size > 1) {
      if (newIndex !== index) {
        const { nextTracks, nextSelected } = reorderWithBlock(tracks, selectedSet, index, newIndex);
        setTracks(nextTracks);
        setSelectedSet(nextSelected);
        lastClickedIndex.current = null;
        setPendingReorder(true);
      }
    }
  }

  // ── Confirmar reordenação ─────────────────────────────────────────────────
  async function handleConfirmReorder() {
    setSaving(true);
    setError(null);
    try {
      const uris = tracks.map((t) => `spotify:track:${t.id}`);
      const res = await fetch(`/api/spotify/playlists/${playlistId}/tracks/reorder-full`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris, snapshotId }),
      });
      const data = (await res.json()) as { success?: boolean; snapshotId?: string; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message ?? "Erro ao salvar ordem.");
      if (data.snapshotId) setSnapshotId(data.snapshotId);
      setSavedTracks([...tracks]);
      setPendingReorder(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar ordem.");
    } finally {
      setSaving(false);
    }
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

  // ── Cálculo visual do drag ────────────────────────────────────────────────
  // Durante drag, calcula o translateY de cada linha:
  // - Linhas do bloco arrastado: se movem junto com o ponteiro
  // - Linhas fora do bloco: se abrem para dar espaço
  function getTranslateY(index: number): number {
    if (dragFrom === null || dragTo === null || dragFrom === dragTo) return 0;

    const isInBlock = selectedSet.has(index);
    const blockSize = selectedSet.size;
    const delta = dragTo - dragFrom; // quanto moveu em linhas

    if (isInBlock) {
      // O bloco todo se move: translada pelo delta * rowHeight
      return delta * rowHeight.current;
    }

    // Linhas fora do bloco: precisam ceder espaço
    const selSorted = [...selectedSet].sort((a, b) => a - b);
    const blockMin = selSorted[0];
    const blockMax = selSorted[selSorted.length - 1];

    if (delta > 0) {
      // Bloco movendo pra baixo: linhas entre blockMax+1 e blockMax+delta sobem
      if (index > blockMax && index <= blockMax + delta) {
        return -blockSize * rowHeight.current;
      }
    } else {
      // Bloco movendo pra cima: linhas entre blockMin+delta e blockMin-1 descem
      if (index < blockMin && index >= blockMin + delta) {
        return blockSize * rowHeight.current;
      }
    }

    return 0;
  }

  const isActivelyDragging = dragFrom !== null && dragTo !== null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Barra de controles — legendas escondem em mobile */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="hidden flex-wrap gap-2 text-xs text-muted-foreground tablet:flex">
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5">
            <span className="font-mono">Click</span> Selecionar
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5">
            <span className="font-mono">Shift+Click</span> Selecionar range
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5">
            <GripVertical className="h-3.5 w-3.5" /> Arrastar bloco
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5">
            <span className="font-mono">Delete</span> Remover seleção
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedSet.size > 0 && !pendingReorder && (
            <span className="text-xs text-primary font-medium">
              {selectedSet.size} selecionada{selectedSet.size > 1 ? "s" : ""}
            </span>
          )}
          {pendingReorder ? (
            <>
              <span className="text-xs font-medium text-yellow-500">
                {selectedSet.size > 1 ? `${selectedSet.size} faixas movidas` : "Ordem alterada"} — não salvo
              </span>
              <Button size="sm" variant="outline" onClick={handleCancelReorder} disabled={saving}>
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
              <Button size="sm" onClick={() => void handleConfirmReorder()} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
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

      {/*
        Tabela responsiva estilo Spotify
        - Coluna "Música" agora inclui capa + título + artistas (estilo Spotify)
        - Colunas secundárias escondem progressivamente em telas menores
      */}
      <div data-spotify-table-wrapper className="relative overflow-x-auto rounded-2xl border border-border bg-card/60">
        <table ref={tableRef} className="w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="w-[72px] px-2 py-3 text-right sm:px-4">#</th>
              <th className="px-3 py-3 sm:px-4">Música</th>
              <th className="hidden px-4 py-3 tablet:table-cell">Álbum</th>
              <th className="px-3 py-3 sm:px-4">Pop.</th>
              <th className="hidden px-4 py-3 tablet:table-cell">Duração</th>
              <th className="hidden px-4 py-3 laptop:table-cell">
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
              const isInsertTarget = isActivelyDragging && dragTo === index;
              const isDeleting = deletingIndices.has(index);
              const translateY = getTranslateY(index);

              return (
                <tr
                  key={`${track.id}-${index}`}
                  onClick={(e) => handleRowClick(e, index)}
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  onPointerMove={(e) => handlePointerMove(e, index)}
                  onPointerUp={(e) => handlePointerUp(e, index)}
                  style={{
                    transform: `translateY(${translateY}px)`,
                    transition: isActivelyDragging && isSelected ? "none" : "transform 120ms ease",
                    opacity: isDeleting ? 0.3 : isDraggingThis ? 0.5 : 1,
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
                    isInsertTarget ? "shadow-[inset_0_2px_0_hsl(var(--primary))]" : "",
                    isDeleting ? "pointer-events-none" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {/* # */}
                  <td className="h-16 w-[72px] overflow-hidden px-2 py-0 align-middle text-sm tabular-nums text-muted-foreground sm:px-4">
                    {isDeleting
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : (
                        <span
                          className={[
                            "inline-block w-[3ch] text-right",
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
                      </div>
                    </div>
                  </td>

                  {/* Álbum — escondido em mobile */}
                  <td
                    className="hidden h-16 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-4 py-0 align-middle text-sm text-muted-foreground tablet:table-cell"
                    title={track.albumName}
                  >
                    {track.albumName}
                  </td>

                  {/* Popularidade */}
                  <td className="h-16 overflow-hidden px-3 py-0 align-middle sm:px-4">
                    <div className="flex items-center gap-2">
                      <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block sm:w-16">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${track.popularity}%` }} />
                      </div>
                      <span className="text-sm font-medium tabular-nums">{track.popularity}</span>
                    </div>
                  </td>

                  {/* Duração — escondida em mobile */}
                  <td className="hidden h-16 overflow-hidden px-4 py-0 align-middle text-sm tabular-nums text-muted-foreground tablet:table-cell">
                    {track.durationLabel}
                  </td>

                  {/* Streams — escondida em mobile/tablet */}
                  <td className="hidden h-16 overflow-hidden px-4 py-0 align-middle laptop:table-cell">
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
                      className="flex cursor-grab items-center opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
                      title={selectedSet.size > 1 && isSelected ? `Arrastar ${selectedSet.size} faixas` : "Arrastar para reordenar"}>
                      <GripVertical className="h-4 w-4 pointer-events-none text-muted-foreground/50" />
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
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
          - columnWeights: Música ganha 3x mais espaço, Álbum 2x; restantes 1x
          - stickyLeft: # (idx 1) fica fixa à esquerda quando rola horizontal
          - stickyRight: Ações (idx 8) fica fixa à direita
          - Grip (idx 0) tem peso baixo pra ficar pequena
        */}
        <ResizableTableOverlay
          tableRef={tableRef}
          storageKey="playlist-editor-cols-v2"
          fixedColumns={[0, 7, 8]}
          autoFit
          columnWeights={{ 0: 0.65, 1: 3, 2: 2, 3: 0.6, 4: 0.6, 5: 1, 6: 1, 7: 0.6, 8: 0.3 }}
          minWidths={{ 0: 64, 1: 220, 2: 140, 3: 80, 4: 70, 5: 110, 6: 100, 7: 88, 8: 32 }}
          stickyLeft={[0]}
          stickyRight={[7, 8]}
        />
      </div>
    </div>
  );
}
