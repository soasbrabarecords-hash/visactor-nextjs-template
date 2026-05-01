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
  /**
   * Auto-fit: quando true, calcula widths proporcionalmente ao espaço total
   * disponível (estilo Spotify). User pode arrastar pra customizar e o auto-fit
   * respeita os widths customizados.
   */
  autoFit?: boolean;
  /**
   * Pesos de cada coluna no auto-fit. Ex: { 2: 3, 3: 2 } = coluna idx 2 ganha
   * 3x mais espaço que default. Default: 1 para todas, exceto coluna "Música"
   * que recebe peso maior automaticamente se nenhum peso for passado.
   */
  columnWeights?: Record<number, number>;
  /**
   * Larguras mínimas por coluna. Default: 60px.
   */
  minWidths?: Record<number, number>;
  /**
   * Índices de colunas para fixar com position: sticky no início (esquerda).
   */
  stickyLeft?: number[];
  /**
   * Índices de colunas para fixar com position: sticky no final (direita).
   */
  stickyRight?: number[];
};

type Sizes = Record<number, number>;

export default function ResizableTableOverlay({
  tableRef,
  storageKey,
  fixedColumns = [],
  autoFit = false,
  columnWeights = {},
  minWidths = {},
  stickyLeft = [],
  stickyRight = [],
}: Props) {
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

    // ── Auto-fit: distribuir espaço disponível entre colunas visíveis ─────
    // - Customizadas (no objeto sizes) recebem o width fixo
    // - Restantes dividem o espaço sobrando proporcionalmente aos pesos
    let computedWidths: Record<number, number> = {};
    if (autoFit) {
      const tableContainer = table.parentElement;
      const totalWidth = (tableContainer?.clientWidth ?? table.clientWidth) || 0;
      if (totalWidth > 0) {
        const visibleIdx: number[] = [];
        Array.from(headRow.cells).forEach((th, i) => {
          if ((th as HTMLElement).offsetParent !== null) visibleIdx.push(i);
        });

        // Subtrai larguras já fixas (customizadas pelo user)
        let fixedTotal = 0;
        const flexible: number[] = [];
        for (const i of visibleIdx) {
          if (sizes[i] && sizes[i]! > 0) {
            fixedTotal += sizes[i]!;
            computedWidths[i] = sizes[i]!;
          } else {
            flexible.push(i);
          }
        }

        const remaining = Math.max(0, totalWidth - fixedTotal);
        const weightOf = (i: number) => columnWeights[i] ?? 1;
        const totalWeight = flexible.reduce((a, i) => a + weightOf(i), 0) || 1;

        for (const i of flexible) {
          const minW = minWidths[i] ?? 60;
          const proportional = (remaining * weightOf(i)) / totalWeight;
          computedWidths[i] = Math.max(minW, Math.round(proportional));
        }
      }
    }

    // Aplicar widths
    Array.from(headRow.cells).forEach((th, i) => {
      const col = colgroup!.children[i] as HTMLTableColElement;
      const isVisible = (th as HTMLElement).offsetParent !== null;
      if (!isVisible) {
        col.style.width = "";
        return;
      }
      const w = autoFit ? computedWidths[i] : sizes[i];
      if (w && w > 0) {
        col.style.width = `${w}px`;
      } else {
        col.style.width = "";
      }
    });

    // table-layout: fixed quando temos widths controlados
    if (autoFit || Object.keys(sizes).length > 0) {
      table.style.tableLayout = "fixed";
    }

    // ── Sticky columns: aplica position: sticky em <th> e <td> das colunas ─
    const stickyLeftSet = new Set(stickyLeft);
    const stickyRightSet = new Set(stickyRight);
    if (stickyLeftSet.size > 0 || stickyRightSet.size > 0) {
      // Calcular offsets cumulativos para colunas à esquerda
      const leftOffsets: Record<number, number> = {};
      let acc = 0;
      const visibleIdx: number[] = [];
      Array.from(headRow.cells).forEach((th, i) => {
        if ((th as HTMLElement).offsetParent !== null) visibleIdx.push(i);
      });
      for (const i of visibleIdx) {
        if (stickyLeftSet.has(i)) {
          leftOffsets[i] = acc;
          const th = headRow.cells[i] as HTMLElement;
          acc += th.getBoundingClientRect().width;
        }
      }
      // Para sticky right, calcular do fim para o início
      const rightOffsets: Record<number, number> = {};
      acc = 0;
      for (let k = visibleIdx.length - 1; k >= 0; k--) {
        const i = visibleIdx[k];
        if (stickyRightSet.has(i)) {
          rightOffsets[i] = acc;
          const th = headRow.cells[i] as HTMLElement;
          acc += th.getBoundingClientRect().width;
        }
      }

      // Aplica em todas as <tr> (thead + tbody)
      const allRows = [
        ...Array.from(table.tHead?.rows ?? []),
        ...Array.from(table.tBodies[0]?.rows ?? []),
      ];
      for (const row of allRows) {
        Array.from(row.cells).forEach((cell, i) => {
          const el = cell as HTMLElement;
          if (stickyLeftSet.has(i)) {
            el.style.position = "sticky";
            el.style.left = `${leftOffsets[i] ?? 0}px`;
            el.style.zIndex = row.parentElement?.tagName === "THEAD" ? "30" : "10";
            // Background para sobrepor conteúdo que rola atrás
            if (!el.style.background && !el.style.backgroundColor) {
              el.style.backgroundColor = row.parentElement?.tagName === "THEAD"
                ? "hsl(var(--card))"
                : "hsl(var(--card))";
            }
          } else if (stickyRightSet.has(i)) {
            el.style.position = "sticky";
            el.style.right = `${rightOffsets[i] ?? 0}px`;
            el.style.zIndex = row.parentElement?.tagName === "THEAD" ? "30" : "10";
            if (!el.style.background && !el.style.backgroundColor) {
              el.style.backgroundColor = row.parentElement?.tagName === "THEAD"
                ? "hsl(var(--card))"
                : "hsl(var(--card))";
            }
          }
        });
      }
    }
  }, [sizes, tableRef, autoFit, columnWeights, minWidths, stickyLeft, stickyRight]);

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

  // Observa mudanças no tamanho da tabela / container / window
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const handleResize = () => {
      applySizes();
      recomputeHandles();
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(table);
    if (table.parentElement) ro.observe(table.parentElement);
    window.addEventListener("resize", handleResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [tableRef, recomputeHandles, applySizes]);

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
