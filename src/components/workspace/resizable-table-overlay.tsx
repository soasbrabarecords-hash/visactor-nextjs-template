"use client";

/**
 * ResizableTableOverlay
 * ─────────────────────
 * Adiciona "handles" de redimensionamento (divisores arrastáveis) entre as
 * colunas de uma <table> existente, SEM precisar reescrever a tabela.
 *
 * Uso:
 *   const tableRef = useRef<HTMLTableElement>(null);
 *   <table ref={tableRef}>...</table>
 *   <ResizableTableOverlay tableRef={tableRef} storageKey="meu-id" />
 *
 * Como funciona:
 *   1. Mede a posição dos <th> da primeira <tr> do <thead>
 *   2. Renderiza divs absolutos no divisor direito de cada <th> (exceto último)
 *   3. Ao arrastar, aplica width="..." direto no <th> + cria <colgroup> dinamicamente
 *      se a tabela não tiver. Persiste em localStorage.
 *   4. Ouvinte de ResizeObserver re-mede sempre que a tabela muda de tamanho.
 *
 * Não toca em nada do conteúdo da tabela — só anexa um overlay irmão.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const MIN_WIDTH = 48;
const HANDLE_WIDTH = 6; // largura visível/clicável do divisor

type Props = {
  tableRef: React.RefObject<HTMLTableElement | null>;
  /** Chave de persistência. Se omitida, não persiste. */
  storageKey?: string;
  /** Índices de colunas que NÃO podem ser redimensionadas (ex: grip, ações). */
  fixedColumns?: number[];
};

type Sizes = Record<number, number>;

export default function ResizableTableOverlay({ tableRef, storageKey, fixedColumns = [] }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [handles, setHandles] = useState<Array<{ index: number; left: number; height: number }>>([]);
  const [sizes, setSizes] = useState<Sizes>(() => {
    if (typeof window === "undefined" || !storageKey) return {};
    try {
      const raw = localStorage.getItem(`rt-overlay:${storageKey}`);
      return raw ? (JSON.parse(raw) as Sizes) : {};
    } catch {
      return {};
    }
  });

  const fixedSet = useMemo(() => new Set(fixedColumns), [fixedColumns]);
  const draggingRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  // Cria colgroup dentro da tabela se não existir, e sincroniza widths
  const applySizes = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;
    const headRow = table.tHead?.rows[0];
    if (!headRow) return;

    // Garantir colgroup
    let colgroup = table.querySelector(":scope > colgroup") as HTMLTableColElement | null;
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      table.insertBefore(colgroup, table.firstChild);
    }
    const desiredCols = headRow.cells.length;
    while (colgroup.children.length < desiredCols) {
      colgroup.appendChild(document.createElement("col"));
    }
    while (colgroup.children.length > desiredCols) {
      colgroup.removeChild(colgroup.lastChild!);
    }

    // Aplicar widths salvos
    Array.from(headRow.cells).forEach((th, i) => {
      const col = colgroup!.children[i] as HTMLTableColElement;
      const isVisible = (th as HTMLElement).offsetParent !== null;
      if (!isVisible) {
        col.style.width = "";
        return;
      }
      const w = sizes[i];
      if (w && w > 0) {
        col.style.width = `${w}px`;
      } else {
        col.style.width = "";
      }
    });

    // Forçar table-layout: fixed (necessário para widths fixos funcionarem)
    if (Object.keys(sizes).length > 0) {
      table.style.tableLayout = "fixed";
    }
  }, [sizes, tableRef]);

  // Recalcula posições dos handles
  const recomputeHandles = useCallback(() => {
    const table = tableRef.current;
    const overlay = overlayRef.current;
    if (!table || !overlay) return;
    const headRow = table.tHead?.rows[0];
    if (!headRow) return;

    const overlayRect = overlay.getBoundingClientRect();
    const next: typeof handles = [];

    Array.from(headRow.cells).forEach((th, i) => {
      // Só permite arrastar entre colunas visíveis e que não sejam fixas
      // E só renderiza handle no divisor DIREITO (não no último th visível)
      if (fixedSet.has(i)) return;
      const isVisible = (th as HTMLElement).offsetParent !== null;
      if (!isVisible) return;

      // Verifica se há algum th visível depois (precisa ter "próxima coluna")
      let hasNextVisible = false;
      for (let j = i + 1; j < headRow.cells.length; j++) {
        const next = headRow.cells[j] as HTMLElement;
        if (next.offsetParent !== null) {
          hasNextVisible = true;
          break;
        }
      }
      if (!hasNextVisible) return;

      const rect = (th as HTMLElement).getBoundingClientRect();
      const left = rect.right - overlayRect.left - HANDLE_WIDTH / 2;
      next.push({ index: i, left, height: rect.height });
    });

    setHandles(next);
  }, [tableRef, fixedSet]);

  // Aplicar sizes sempre que mudarem
  useLayoutEffect(() => {
    applySizes();
    recomputeHandles();
  }, [applySizes, recomputeHandles]);

  // Persistir
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      localStorage.setItem(`rt-overlay:${storageKey}`, JSON.stringify(sizes));
    } catch {
      // ignore quota / private mode
    }
  }, [sizes, storageKey]);

  // Observa mudanças no tamanho da tabela / window
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const ro = new ResizeObserver(() => recomputeHandles());
    ro.observe(table);
    const onWin = () => recomputeHandles();
    window.addEventListener("resize", onWin);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
    };
  }, [tableRef, recomputeHandles]);

  // Drag handlers
  function onPointerDown(e: React.PointerEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    const table = tableRef.current;
    if (!table) return;
    const th = table.tHead?.rows[0]?.cells[index] as HTMLElement | undefined;
    if (!th) return;
    const startWidth = th.getBoundingClientRect().width;
    draggingRef.current = { index, startX: e.clientX, startWidth };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = draggingRef.current;
    if (!drag) return;
    e.preventDefault();
    const delta = e.clientX - drag.startX;
    const newWidth = Math.max(MIN_WIDTH, Math.round(drag.startWidth + delta));
    setSizes((prev) => ({ ...prev, [drag.index]: newWidth }));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    e.preventDefault();
    draggingRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    // Re-medir caso layout tenha shiftado
    requestAnimationFrame(recomputeHandles);
  }

  function onDoubleClick(_e: React.MouseEvent, index: number) {
    // Reset da coluna ao tamanho automático
    setSizes((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  return (
    <div
      ref={overlayRef}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {handles.map((h) => (
        <div
          key={h.index}
          role="separator"
          title="Arraste para redimensionar (duplo-clique para resetar)"
          onPointerDown={(e) => onPointerDown(e, h.index)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={(e) => onDoubleClick(e, h.index)}
          className="group"
          style={{
            position: "absolute",
            left: h.left,
            top: 0,
            width: HANDLE_WIDTH,
            height: h.height,
            cursor: "col-resize",
            pointerEvents: "auto",
            touchAction: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: HANDLE_WIDTH / 2 - 1,
              top: 4,
              width: 2,
              bottom: 4,
              borderRadius: 2,
              background: "transparent",
              transition: "background 120ms ease",
            }}
            className="group-hover:!bg-primary/60 group-active:!bg-primary"
          />
        </div>
      ))}
    </div>
  );
}
