"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Equal, Plus, Trash2 } from "lucide-react";
import EntityCombobox from "./entity-combobox";
import type { LabelEntity } from "@/lib/label-entities-types";
import {
  MASTER_GROUP_TARGETS,
  MASTER_GROUP_TYPES,
  type MasterGroupType,
  type TrackMasterSplit,
} from "@/lib/label-splits-types";
import type { EntityFunction } from "@/lib/label-os-taxonomy";
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
  group_type: MasterGroupType;
  role: string;
  pct: string;
};

type ExistingRow = TrackMasterSplit & { role: string; pct: string };

function emptyRow(group: MasterGroupType = "interpreter"): NewRow {
  return { entity: null, group_type: group, role: "", pct: "" };
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

function distributeByGroup(existing: ExistingRow[], rows: NewRow[]) {
  const nextExisting = existing.map((row) => ({ ...row }));
  const nextRows = rows.map((row) => ({
    ...row,
    pct: row.entity ? row.pct : "",
  }));
  for (const group of MASTER_GROUP_TYPES) {
    const existingIndexes = nextExisting
      .map((row, index) => (row.group_type === group.value ? index : -1))
      .filter((index) => index >= 0);
    const newIndexes = nextRows
      .map((row, index) =>
        row.group_type === group.value && row.entity ? index : -1,
      )
      .filter((index) => index >= 0);
    const values = splitEvenly(
      MASTER_GROUP_TARGETS[group.value],
      existingIndexes.length + newIndexes.length,
    );
    existingIndexes.forEach((index, valueIndex) => {
      nextExisting[index].pct = String(values[valueIndex]);
    });
    newIndexes.forEach((index, newIndex) => {
      nextRows[index].pct = String(values[existingIndexes.length + newIndex]);
    });
  }
  return { existing: nextExisting, rows: nextRows };
}

function compatibleRoles(group: MasterGroupType): EntityFunction[] {
  if (group === "interpreter") return ["interpreter", "artist"];
  if (group === "phonographic_producer") {
    return ["phonographic_producer", "label", "record_company"];
  }
  return ["musician", "interpreter", "artist", "music_producer"];
}

function publicName(row: TrackMasterSplit) {
  return row.entity_display_name?.trim() || row.entity_name || row.entity_id;
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(payload.error ?? "Não foi possível salvar o fonograma.");
  }
  return response;
}

type Props = {
  trackId: string;
  existing: TrackMasterSplit[];
  onSaved?: () => void;
};

export default function MasterSplitForm({ trackId, existing, onSaved }: Props) {
  const router = useRouter();
  const [existingRows, setExistingRows] = useState<ExistingRow[]>(() =>
    existing.map((row) => ({
      ...row,
      role: row.role ?? "",
      pct: String(row.percentage),
    })),
  );
  const [rows, setRows] = useState<NewRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExistingRows(
      existing.map((row) => ({
        ...row,
        role: row.role ?? "",
        pct: String(row.percentage),
      })),
    );
  }, [existing]);

  const total = useMemo(
    () =>
      existingRows.reduce((sum, row) => sum + numberValue(row.pct), 0) +
      rows.reduce(
        (sum, row) => sum + (row.entity ? numberValue(row.pct) : 0),
        0,
      ),
    [existingRows, rows],
  );
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

  function updateExistingGroup(index: number, group: MasterGroupType) {
    const next = existingRows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, group_type: group } : row,
    );
    const distributed = distributeByGroup(next, rows);
    setExistingRows(distributed.existing);
    setRows(distributed.rows);
  }

  function selectEntity(index: number, entity: LabelEntity | null) {
    const next = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, entity } : row,
    );
    const distributed = distributeByGroup(existingRows, next);
    setExistingRows(distributed.existing);
    setRows(distributed.rows);
  }

  function updateNewGroup(index: number, group: MasterGroupType) {
    const next = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, group_type: group } : row,
    );
    const distributed = distributeByGroup(existingRows, next);
    setExistingRows(distributed.existing);
    setRows(distributed.rows);
  }

  function removeNew(index: number) {
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    const distributed = distributeByGroup(existingRows, next);
    setExistingRows(distributed.existing);
    setRows(distributed.rows.length ? distributed.rows : [emptyRow()]);
  }

  function distributeAll() {
    const distributed = distributeByGroup(existingRows, rows);
    setExistingRows(distributed.existing);
    setRows(distributed.rows);
  }

  async function deleteExisting(row: ExistingRow) {
    setSaving(true);
    setError(null);
    try {
      await requestJson(
        `/api/label-os/tracks/${trackId}/master-splits/${row.id}`,
        { method: "DELETE" },
      );
      const remaining = existingRows.filter((item) => item.id !== row.id);
      const distributed = distributeByGroup(remaining, rows);
      await Promise.all(
        distributed.existing.map((item) =>
          requestJson(
            `/api/label-os/tracks/${trackId}/master-splits/${item.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                group_type: item.group_type,
                role: item.role || null,
                percentage: numberValue(item.pct),
              }),
            },
          ),
        ),
      );
      setExistingRows(distributed.existing);
      setRows(distributed.rows);
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
      setError("Adicione pelo menos um participante do fonograma.");
      return;
    }
    const values = [
      ...existingRows.map((row) => numberValue(row.pct)),
      ...validNew.map((row) => numberValue(row.pct)),
    ];
    if (values.some((value) => value < 0 || value > 100)) {
      setError("Cada percentual precisa estar entre 0 e 100.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        existingRows.map((row) =>
          requestJson(
            `/api/label-os/tracks/${trackId}/master-splits/${row.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                group_type: row.group_type,
                role: row.role || null,
                percentage: numberValue(row.pct),
              }),
            },
          ),
        ),
      );
      for (const row of validNew) {
        await requestJson(`/api/label-os/tracks/${trackId}/master-splits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_id: row.entity!.id,
            group_type: row.group_type,
            role: row.role || undefined,
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
      {MASTER_GROUP_TYPES.map((group) => {
        const groupRows = existingRows
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => row.group_type === group.value);
        if (!groupRows.length) return null;
        const subtotal = groupRows.reduce(
          (sum, item) => sum + numberValue(item.row.pct),
          0,
        );
        return (
          <div
            key={group.value}
            className="overflow-hidden rounded-xl border border-border bg-background/80"
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/45 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {group.label}
              </span>
              <span className="text-xs text-muted-foreground">
                Meta {MASTER_GROUP_TARGETS[group.value].toLocaleString("pt-BR")}%
              </span>
            </div>
            {groupRows.map(({ row, index }) => (
              <div
                key={row.id}
                className="grid items-center gap-2 border-b border-border px-3 py-2 last:border-0 md:grid-cols-[minmax(180px,1fr)_190px_150px_92px_38px]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{publicName(row)}</div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLOR[row.entity_type ?? "other"] ?? CATEGORY_COLOR.other}`}
                    >
                      {ENTITY_TYPE_LABELS[row.entity_type as keyof typeof ENTITY_TYPE_LABELS] ?? row.entity_type ?? "Participante"}
                    </span>
                    {row.entity_display_name && row.entity_name ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {row.entity_name}
                      </span>
                    ) : null}
                  </div>
                </div>
                <select
                  value={row.group_type}
                  onChange={(event) =>
                    updateExistingGroup(index, event.target.value as MasterGroupType)
                  }
                  className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {MASTER_GROUP_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={row.role}
                  onChange={(event) =>
                    updateExisting(index, { role: event.target.value })
                  }
                  placeholder="Papel opcional"
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
                  aria-label={`Remover ${publicName(row)}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <div className="flex justify-between border-t border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-semibold">{subtotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</span>
            </div>
          </div>
        );
      })}

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_190px_150px_92px_38px]"
          >
            <EntityCombobox
              value={row.entity}
              onChange={(entity) => selectEntity(index, entity)}
              roles={compatibleRoles(row.group_type)}
              placeholder="Buscar participante compatível..."
            />
            <select
              value={row.group_type}
              onChange={(event) =>
                updateNewGroup(index, event.target.value as MasterGroupType)
              }
              className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {MASTER_GROUP_TYPES.map((group) => (
                <option key={group.value} value={group.value}>
                  {group.label}
                </option>
              ))}
            </select>
            <input
              value={row.role}
              onChange={(event) =>
                setRows((current) =>
                  current.map((item, rowIndex) =>
                    rowIndex === index
                      ? { ...item, role: event.target.value }
                      : item,
                  ),
                )
              }
              placeholder="Papel opcional"
              className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={row.pct}
              inputMode="decimal"
              onChange={(event) =>
                setRows((current) =>
                  current.map((item, rowIndex) =>
                    rowIndex === index
                      ? { ...item, pct: event.target.value }
                      : item,
                  ),
                )
              }
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
          <Plus size={14} /> Adicionar participação
        </button>
        <button
          type="button"
          onClick={distributeAll}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Equal size={14} /> Distribuir percentuais automaticamente
        </button>
        <div className={`ml-auto text-sm font-semibold ${totalColor}`}>
          Total registrado: {total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
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
          {saving ? "Salvando..." : "Salvar fonograma"}
        </button>
      </div>
    </div>
  );
}
