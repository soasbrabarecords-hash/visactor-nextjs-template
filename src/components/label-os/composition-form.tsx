"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Equal, Plus, Trash2 } from "lucide-react";
import EntityCombobox from "./entity-combobox";
import type { LabelEntity } from "@/lib/label-entities-types";
import type { TrackComposition } from "@/lib/label-splits-types";
import { ENTITY_TYPE_LABELS } from "@/lib/label-os-taxonomy";

const CATEGORY_COLOR: Record<string, string> = {
  artist: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200",
  producer: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200",
  composer: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-200",
  label: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  imprint: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
  publisher: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  manager: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-200",
  company: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  other: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

type NewRow = {
  entity: LabelEntity | null;
  role: string;
  pct: string;
};

type ExistingRow = TrackComposition & { role: string; pct: string };

function emptyRow(pct = ""): NewRow {
  return { entity: null, role: "compositor", pct };
}

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitEvenly(total: number, count: number) {
  if (count <= 0) return [];
  const base = Math.floor((total * 100) / count) / 100;
  return Array.from({ length: count }, (_, index) =>
    index === count - 1
      ? Number((total - base * (count - 1)).toFixed(2))
      : base,
  );
}

function compositionName(row: TrackComposition) {
  const legalName = row.entity_name ?? row.entity_id;
  const artisticName = row.entity_display_name?.trim();
  return artisticName &&
    artisticName.toLocaleLowerCase("pt-BR") !==
      legalName.toLocaleLowerCase("pt-BR")
    ? `${legalName} (${artisticName})`
    : legalName;
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(payload.error ?? "Não foi possível salvar a obra.");
  }
  return response;
}

type Props = {
  trackId: string;
  existing: TrackComposition[];
  onSaved?: () => void;
};

export default function CompositionForm({ trackId, existing, onSaved }: Props) {
  const router = useRouter();
  const [existingRows, setExistingRows] = useState<ExistingRow[]>(() =>
    existing.map((row) => ({ ...row, pct: String(row.percentage) })),
  );
  const [rows, setRows] = useState<NewRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExistingRows(
      existing.map((row) => ({ ...row, pct: String(row.percentage) })),
    );
  }, [existing]);

  const existingTotal = useMemo(
    () => existingRows.reduce((sum, row) => sum + numberValue(row.pct), 0),
    [existingRows],
  );
  const newTotal = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + (row.entity ? numberValue(row.pct) : 0),
        0,
      ),
    [rows],
  );
  const total = existingTotal + newTotal;
  const totalColor =
    Math.abs(total - 100) < 0.01
      ? "text-emerald-600 dark:text-emerald-300"
      : total > 100
        ? "text-red-600 dark:text-red-300"
        : "text-amber-600 dark:text-amber-300";

  function updateExisting(index: number, patch: Partial<ExistingRow>) {
    setExistingRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function updateRow(index: number, patch: Partial<NewRow>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function selectEntity(index: number, entity: LabelEntity | null) {
    const nextRows = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, entity } : row,
    );
    const selectedIndexes = nextRows
      .map((row, rowIndex) => (row.entity ? rowIndex : -1))
      .filter((rowIndex) => rowIndex >= 0);
    const values = splitEvenly(
      100,
      existingRows.length + selectedIndexes.length,
    );
    setExistingRows((current) =>
      current.map((row, rowIndex) => ({
        ...row,
        pct: String(values[rowIndex]),
      })),
    );
    setRows(
      nextRows.map((row, rowIndex) => {
        const selectedPosition = selectedIndexes.indexOf(rowIndex);
        return {
          ...row,
          pct:
            selectedPosition >= 0
              ? String(values[existingRows.length + selectedPosition])
              : "",
        };
      }),
    );
  }

  function removeNew(index: number) {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    const selectedIndexes = nextRows
      .map((row, rowIndex) => (row.entity ? rowIndex : -1))
      .filter((rowIndex) => rowIndex >= 0);
    const values = splitEvenly(
      100,
      existingRows.length + selectedIndexes.length,
    );
    setExistingRows((current) =>
      current.map((row, rowIndex) => ({
        ...row,
        pct: String(values[rowIndex]),
      })),
    );
    setRows(
      (nextRows.length ? nextRows : [emptyRow()]).map((row, rowIndex) => {
        const selectedPosition = selectedIndexes.indexOf(rowIndex);
        return {
          ...row,
          pct:
            selectedPosition >= 0
              ? String(values[existingRows.length + selectedPosition])
              : "",
        };
      }),
    );
  }

  function distributeAll() {
    const selectedNewIndexes = rows
      .map((row, index) => (row.entity ? index : -1))
      .filter((index) => index >= 0);
    const values = splitEvenly(
      100,
      existingRows.length + selectedNewIndexes.length,
    );
    if (values.length === 0) return;
    setExistingRows((current) =>
      current.map((row, index) => ({ ...row, pct: String(values[index]) })),
    );
    setRows((current) => {
      let valueIndex = existingRows.length;
      return current.map((row) =>
        row.entity ? { ...row, pct: String(values[valueIndex++]) } : row,
      );
    });
  }

  async function deleteExisting(row: ExistingRow) {
    setSaving(true);
    setError(null);
    try {
      await requestJson(
        `/api/label-os/tracks/${trackId}/compositions/${row.id}`,
        { method: "DELETE" },
      );
      const remaining = existingRows.filter((item) => item.id !== row.id);
      const selectedIndexes = rows
        .map((item, index) => (item.entity ? index : -1))
        .filter((index) => index >= 0);
      const values = splitEvenly(
        100,
        remaining.length + selectedIndexes.length,
      );
      const normalized = remaining.map((item, index) => ({
        ...item,
        pct: String(values[index]),
      }));
      await Promise.all(
        normalized.map((item) =>
          requestJson(
            `/api/label-os/tracks/${trackId}/compositions/${item.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                role: item.role || "compositor",
                percentage: numberValue(item.pct),
              }),
            },
          ),
        ),
      );
      setExistingRows(normalized);
      setRows((current) =>
        current.map((item, index) => {
          const selectedPosition = selectedIndexes.indexOf(index);
          return {
            ...item,
            pct:
              selectedPosition >= 0
                ? String(values[remaining.length + selectedPosition])
                : "",
          };
        }),
      );
      onSaved?.();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    const validNew = rows.filter((row) => row.entity);
    if (existingRows.length === 0 && validNew.length === 0) {
      setError("Adicione pelo menos um compositor.");
      return;
    }
    const allValues = [
      ...existingRows.map((row) => numberValue(row.pct)),
      ...validNew.map((row) => numberValue(row.pct)),
    ];
    if (allValues.some((value) => value < 0 || value > 100)) {
      setError("Cada percentual precisa estar entre 0 e 100.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        existingRows.map((row) =>
          requestJson(
            `/api/label-os/tracks/${trackId}/compositions/${row.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                role: row.role || "compositor",
                percentage: numberValue(row.pct),
              }),
            },
          ),
        ),
      );
      for (const row of validNew) {
        await requestJson(`/api/label-os/tracks/${trackId}/compositions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_id: row.entity!.id,
            role: row.role || "compositor",
            percentage: numberValue(row.pct),
          }),
        });
      }
      setRows([emptyRow()]);
      onSaved?.();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 text-foreground">
      {existingRows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-background/80">
          <div className="grid grid-cols-[minmax(0,1fr)_150px_92px_38px] gap-2 border-b border-border bg-muted/45 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Compositor</span>
            <span>Papel</span>
            <span className="text-right">%</span>
            <span />
          </div>
          {existingRows.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_150px_92px_38px] items-center gap-2 border-b border-border px-3 py-2 last:border-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {compositionName(row)}
                </div>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLOR[row.entity_type ?? "other"] ?? CATEGORY_COLOR.other}`}
                >
                  {ENTITY_TYPE_LABELS[row.entity_type as keyof typeof ENTITY_TYPE_LABELS] ?? "Compositor"}
                </span>
              </div>
              <input
                value={row.role}
                onChange={(event) =>
                  updateExisting(index, { role: event.target.value })
                }
                className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                value={row.pct}
                inputMode="decimal"
                onChange={(event) =>
                  updateExisting(index, { pct: event.target.value })
                }
                className="rounded-lg border border-border bg-background px-2.5 py-2 text-right text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => deleteExisting(row)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                aria-label={`Remover ${compositionName(row)}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_92px_38px]"
          >
            <EntityCombobox
              value={row.entity}
              onChange={(entity) => selectEntity(index, entity)}
              roles={["composer"]}
              nameMode="legal"
              placeholder="Buscar compositor por nome legal ou artístico..."
            />
            <input
              value={row.role}
              onChange={(event) => updateRow(index, { role: event.target.value })}
              placeholder="Compositor"
              className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={row.pct}
              inputMode="decimal"
              onChange={(event) => updateRow(index, { pct: event.target.value })}
              placeholder="Automático"
              className="rounded-lg border border-border bg-background px-2.5 py-2 text-right text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => removeNew(index)}
              disabled={rows.length === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-25"
              aria-label="Remover nova linha"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setRows((current) => [...current, emptyRow()])}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus size={14} /> Adicionar compositor
        </button>
        <button
          type="button"
          onClick={distributeAll}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Equal size={14} /> Dividir 100% igualmente
        </button>
        <div className={`ml-auto text-sm font-semibold ${totalColor}`}>
          Total da obra: {total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
        </div>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar obra"}
        </button>
      </div>
    </div>
  );
}
