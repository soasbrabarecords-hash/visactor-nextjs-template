"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import EntityCombobox from "./entity-combobox";
import type { LabelEntity } from "@/lib/label-entities-types";
import type { TrackRoyaltySplit } from "@/lib/label-splits-types";

type SplitRow = {
  entity: LabelEntity | null;
  role: string;
  pct: string;
  recoupable: boolean;
  notes: string;
};

function emptyRow(): SplitRow {
  return { entity: null, role: "", pct: "", recoupable: false, notes: "" };
}

function sumPct(rows: SplitRow[]): number {
  return rows.reduce<number>((acc, r) => {
    const v = parseFloat(r.pct.replace(",", "."));
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
}

type Props = {
  trackId: string;
  existing: TrackRoyaltySplit[];
  onSaved?: () => void;
};

export default function RoyaltySplitForm({ trackId, existing, onSaved }: Props) {
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
        const res = await fetch(`/api/label-os/tracks/${trackId}/royalty-splits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_id: r.entity!.id,
            role: r.role || undefined,
            percentage: pct,
            recoupable: r.recoupable,
            notes: r.notes || undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Erro ao salvar royalty split.");
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

  const existingTotal = existing.reduce<number>((acc, s) => acc + s.percentage, 0);
  const existingColor =
    Math.abs(existingTotal - 100) < 0.01
      ? "text-green-600"
      : existingTotal > 100
        ? "text-red-600"
        : "text-amber-600";

  return (
    <div className="space-y-4">
      {/* Existing rows */}
      {existing.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50 dark:bg-slate-900">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Entidade</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Papel</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Recoup.</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Notas</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">%</th>
              </tr>
            </thead>
            <tbody>
              {existing.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    {s.entity_display_name ?? s.entity_name ?? s.entity_id}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.role ?? "—"}</td>
                  <td className="px-3 py-2 text-center">
                    {s.recoupable ? (
                      <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-950 dark:text-orange-300">Sim</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{s.notes ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {s.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-slate-50 dark:bg-slate-900">
                <td colSpan={4} className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  Total já registrado
                </td>
                <td className={`px-3 py-2 text-right text-sm font-bold ${existingColor}`}>
                  {existingTotal.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* New rows */}
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-border p-3">
            <div className="flex gap-2 items-start">
              <div className="flex-1 min-w-0">
                <EntityCombobox
                  value={row.entity}
                  onChange={(e) => updateRow(i, { entity: e })}
                  placeholder="Buscar entidade..."
                />
              </div>
              <input
                type="text"
                placeholder="Papel (ex: label, artista)"
                value={row.role}
                onChange={(ev) => updateRow(i, { role: ev.target.value })}
                className="w-36 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            <div className="flex gap-4 items-center pl-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={row.recoupable}
                  onChange={(ev) => updateRow(i, { recoupable: ev.target.checked })}
                  className="rounded border-border"
                />
                Recoupable
              </label>
              <input
                type="text"
                placeholder="Notas (opcional)"
                value={row.notes}
                onChange={(ev) => updateRow(i, { notes: ev.target.value })}
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
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
          {saving ? "Salvando..." : "Salvar Royalties"}
        </button>
      </div>
    </div>
  );
}
