"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import EntityCombobox from "./entity-combobox";
import type { LabelEntity } from "@/lib/label-entities-types";
import { MASTER_GROUP_TYPES } from "@/lib/label-splits-types";
import type { TrackMasterSplit, MasterGroupType } from "@/lib/label-splits-types";

type SplitRow = {
  entity: LabelEntity | null;
  group_type: MasterGroupType;
  role: string;
  pct: string;
};

function emptyRow(): SplitRow {
  return { entity: null, group_type: "interpreter", role: "", pct: "" };
}

function sumPct(rows: SplitRow[]): number {
  return rows.reduce<number>((acc, r) => {
    const v = parseFloat(r.pct.replace(",", "."));
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
}

type Props = {
  trackId: string;
  existing: TrackMasterSplit[];
  onSaved?: () => void;
};

export default function MasterSplitForm({ trackId, existing, onSaved }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<SplitRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = sumPct(rows);
  const totalColor =
    Math.abs(total - 100) < 0.01
      ? "text-green-600"
      : total > 100
        ? "text-red-600"
        : "text-amber-600";

  const addRow = () => setRows((r) => [...r, emptyRow()]);

  const removeRow = (i: number) =>
    setRows((r) => r.filter((_, idx) => idx !== i));

  const updateRow = (i: number, patch: Partial<SplitRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const handleSubmit = async () => {
    setError(null);
    const valid = rows.filter((r) => r.entity && r.pct.trim() !== "");
    if (valid.length === 0) {
      setError("Adicione pelo menos um participante.");
      return;
    }

    setSaving(true);
    try {
      for (const r of valid) {
        const pct = parseFloat(r.pct.replace(",", "."));
        const res = await fetch(`/api/label-os/tracks/${trackId}/master-splits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_id: r.entity!.id,
            group_type: r.group_type,
            role: r.role || undefined,
            percentage: pct,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Erro ao salvar split.");
        }
      }
      setRows([emptyRow()]);
      onSaved?.();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  };

  // Group existing by group_type
  const grouped = MASTER_GROUP_TYPES.map((g) => ({
    ...g,
    items: existing.filter((s) => s.group_type === g.value),
    total: existing
      .filter((s) => s.group_type === g.value)
      .reduce<number>((acc, s) => acc + s.percentage, 0),
  }));

  const existingTotal = existing.reduce<number>((acc, s) => acc + s.percentage, 0);
  const existingColor =
    Math.abs(existingTotal - 100) < 0.01
      ? "text-green-600"
      : existingTotal > 100
        ? "text-red-600"
        : "text-amber-600";

  return (
    <div className="space-y-4">
      {/* Existing rows grouped */}
      {existing.length > 0 && (
        <div className="space-y-3">
          {grouped
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.value} className="rounded-lg border border-border overflow-hidden">
                <div className="border-b border-border bg-slate-50 dark:bg-slate-900 px-3 py-1.5">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {g.label}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {g.items.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          {s.entity_display_name ?? s.entity_name ?? s.entity_id}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{s.role ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {s.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-slate-50 dark:bg-slate-900">
                      <td colSpan={2} className="px-3 py-1 text-xs text-muted-foreground">Subtotal</td>
                      <td className="px-3 py-1 text-right text-xs font-semibold">
                        {g.total.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          <div className={`text-right text-sm font-bold ${existingColor}`}>
            Total registrado: {existingTotal.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%
          </div>
        </div>
      )}

      {/* New rows */}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              <EntityCombobox
                value={row.entity}
                onChange={(e) => updateRow(i, { entity: e })}
                placeholder="Buscar entidade..."
              />
            </div>
            <select
              value={row.group_type}
              onChange={(ev) => updateRow(i, { group_type: ev.target.value as MasterGroupType })}
              className="rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MASTER_GROUP_TYPES.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Papel (opcional)"
              value={row.role}
              onChange={(ev) => updateRow(i, { role: ev.target.value })}
              className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="50"
              value={row.pct}
              onChange={(ev) => updateRow(i, { pct: ev.target.value })}
              className="w-20 rounded-md border border-border bg-background px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="py-2 text-sm text-muted-foreground">%</span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="py-2 text-muted-foreground hover:text-red-500"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      {rows.some((r) => r.pct.trim() !== "") && (
        <div className={`text-right text-sm font-semibold ${totalColor}`}>
          Total novo: {total.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus size={14} /> Adicionar linha
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="ml-auto rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
        >
          {saving ? "Salvando..." : "Salvar Fonograma"}
        </button>
      </div>
    </div>
  );
}
