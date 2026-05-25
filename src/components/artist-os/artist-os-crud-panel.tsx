"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ArtistOsFieldConfig,
  ArtistOsFilterConfig,
  ArtistOsResourceConfig,
} from "@/lib/artist-os-config";
import type { ArtistOsArtistOption, ArtistOsRecord } from "@/lib/artist-os-types";
import { cn } from "@/lib/utils";

type ArtistOsCrudPanelProps = {
  config: ArtistOsResourceConfig;
  initialRows: ArtistOsRecord[];
  artists: ArtistOsArtistOption[];
  tableReady: boolean;
  initialError: string | null;
};

type FormState = Record<string, string | number | boolean | null>;

function money(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function dateLabel(value: unknown, withTime = false) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: withTime ? "2-digit" : undefined,
  });
}

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function statusLabel(value: unknown) {
  return String(value ?? "sem_status").replaceAll("_", " ");
}

function getArtistName(artists: ArtistOsArtistOption[], id: unknown) {
  return artists.find((artist) => artist.id === id)?.name ?? "Sem artista";
}

function getInitialFormState(fields: ArtistOsFieldConfig[], row?: ArtistOsRecord | null): FormState {
  return fields.reduce<FormState>((state, field) => {
    const value = row?.[field.key];

    if (field.type === "checkbox") {
      state[field.key] = Boolean(value);
      return state;
    }

    if (field.type === "select") {
      state[field.key] = String(value ?? field.options?.[0]?.value ?? "");
      return state;
    }

    if (field.type === "number") {
      state[field.key] = value == null ? "" : Number(value);
      return state;
    }

    state[field.key] = value == null ? "" : String(value);
    return state;
  }, {});
}

function formatCell(
  row: ArtistOsRecord,
  key: string,
  type: string | undefined,
  artists: ArtistOsArtistOption[],
) {
  const value = row[key];

  if (type === "money") return money(value);
  if (type === "date") return dateLabel(value);
  if (type === "datetime") return dateLabel(value, true);
  if (type === "artist") return getArtistName(artists, value);
  if (type === "boolean") return value ? "Sim" : "Não";

  if (type === "status") {
    return (
      <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
        {statusLabel(value)}
      </span>
    );
  }

  return String(value ?? "—");
}

function matchesFilters(
  row: ArtistOsRecord,
  config: ArtistOsResourceConfig,
  query: string,
  filters: Record<string, string>,
) {
  const normalizedQuery = normalize(query);

  if (normalizedQuery) {
    const found = config.searchFields.some((field) =>
      normalize(row[field]).includes(normalizedQuery),
    );
    if (!found) return false;
  }

  for (const filter of config.filters) {
    const value = filters[filter.key];
    if (!value) continue;

    if (filter.type === "month") {
      if (!String(row[filter.key] ?? "").startsWith(value)) return false;
      continue;
    }

    if (String(row[filter.key] ?? "") !== value) return false;
  }

  return true;
}

function FieldInput({
  field,
  value,
  artists,
  onChange,
}: {
  field: ArtistOsFieldConfig;
  value: FormState[string];
  artists: ArtistOsArtistOption[];
  onChange: (value: string | number | boolean | null) => void;
}) {
  const baseClass =
    "w-full rounded-2xl border border-white/10 bg-black/24 px-3 py-2.5 text-sm font-medium text-white outline-none transition placeholder:text-white/24 focus:border-white/28";

  if (field.type === "textarea") {
    return (
      <textarea
        rows={3}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        className={cn(baseClass, "min-h-24 resize-y")}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "inline-flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-sm font-black transition",
          value
            ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100"
            : "border-white/10 bg-black/24 text-white/50",
        )}
      >
        <span>{value ? "Sim" : "Não"}</span>
        <CheckCircle2 className="h-4 w-4" />
      </button>
    );
  }

  if (field.type === "select" || field.type === "artist") {
    const options =
      field.type === "artist"
        ? [
            { label: "Sem artista", value: "" },
            ...artists.map((artist) => ({ label: artist.name, value: artist.id })),
          ]
        : field.options ?? [];

    return (
      <select
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value || null)}
        className={baseClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-950">
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : field.type}
      value={String(value ?? "")}
      onChange={(event) =>
        onChange(field.type === "number" ? event.target.value : event.target.value)
      }
      placeholder={field.placeholder}
      className={baseClass}
      step={field.type === "number" ? "0.01" : undefined}
    />
  );
}

function FilterControl({
  filter,
  value,
  artists,
  onChange,
}: {
  filter: ArtistOsFilterConfig;
  value: string;
  artists: ArtistOsArtistOption[];
  onChange: (value: string) => void;
}) {
  const inputClass =
    "rounded-2xl border border-white/10 bg-black/24 px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-white/25";

  if (filter.type === "month") {
    return (
      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-white/38">
        {filter.label}
        <input
          type="month"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      </label>
    );
  }

  const options =
    filter.type === "artist"
      ? artists.map((artist) => ({ label: artist.name, value: artist.id }))
      : filter.options ?? [];

  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-white/38">
      {filter.label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="" className="bg-slate-950">
          Todos
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-950">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ArtistOsCrudPanel({
  config,
  initialRows,
  artists,
  tableReady,
  initialError,
}: ArtistOsCrudPanelProps) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<ArtistOsRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => getInitialFormState(config.fields));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesFilters(row, config, query, filters)),
    [config, filters, query, rows],
  );

  function openCreate() {
    setEditing(null);
    setForm(getInitialFormState(config.fields));
    setError(null);
    setSuccess(null);
    setIsFormOpen(true);
  }

  function openEdit(row: ArtistOsRecord) {
    setEditing(row);
    setForm(getInitialFormState(config.fields, row));
    setError(null);
    setSuccess(null);
    setIsFormOpen(true);
  }

  function updateForm(key: string, value: string | number | boolean | null) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function reloadRows() {
    setIsReloading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artist-os/${config.key}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { rows?: ArtistOsRecord[]; error?: string }
        | null;

      if (!response.ok) throw new Error(payload?.error ?? "Erro ao atualizar ArtistOS.");
      setRows(payload?.rows ?? []);
    } catch (reloadError) {
      setError(reloadError instanceof Error ? reloadError.message : "Erro ao atualizar.");
    } finally {
      setIsReloading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const url = editing
        ? `/api/artist-os/${config.key}/${editing.id}`
        : `/api/artist-os/${config.key}`;
      const response = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as
        | (ArtistOsRecord & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Nao foi possivel salvar.");
      }

      setRows((current) =>
        editing
          ? current.map((row) => (row.id === payload.id ? payload : row))
          : [payload, ...current],
      );
      setSuccess(editing ? "Registro atualizado." : "Registro criado.");
      setIsFormOpen(false);
      setEditing(null);
      setForm(getInitialFormState(config.fields));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRow(row: ArtistOsRecord) {
    if (!window.confirm(`Excluir este ${config.singular}?`)) return;

    setIsDeleting(row.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/artist-os/${config.key}/${row.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) throw new Error(payload?.error ?? "Nao foi possivel excluir.");

      setRows((current) => current.filter((item) => item.id !== row.id));
      setSuccess("Registro excluido.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao excluir.");
    } finally {
      setIsDeleting(null);
    }
  }

  const Icon = config.icon;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045] shadow-[0_20px_90px_-60px_rgba(0,0,0,0.9)]">
        <div className="flex flex-col gap-4 border-b border-white/10 p-4 tablet:p-5 laptop:flex-row laptop:items-center laptop:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
                {config.eyebrow}
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
                {config.title}
              </h2>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-white/50">
                {config.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={reloadRows}
              disabled={isReloading}
              className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/10"
            >
              {isReloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Atualizar
            </Button>
            <Button type="button" onClick={openCreate} className="rounded-full bg-white text-slate-950 hover:bg-white/90">
              <Plus className="h-4 w-4" />
              {config.newLabel}
            </Button>
          </div>
        </div>

        {!tableReady ? (
          <div className="mx-4 mt-4 flex items-start gap-3 rounded-[22px] border border-amber-300/20 bg-amber-300/[0.08] p-4 text-amber-100 tablet:mx-5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium leading-5">
              {initialError ?? "Migration do ArtistOS pendente. A lista pode exibir dados demo."}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mx-4 mt-4 rounded-[20px] border border-rose-300/20 bg-rose-300/[0.08] px-4 py-3 text-sm font-semibold text-rose-100 tablet:mx-5">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mx-4 mt-4 rounded-[20px] border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-3 text-sm font-semibold text-emerald-100 tablet:mx-5">
            {success}
          </div>
        ) : null}

        <div className="grid gap-3 p-4 tablet:p-5 laptop:grid-cols-[minmax(260px,1fr)_auto] laptop:items-end">
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-white/38">
            Buscar
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Buscar ${config.singular}...`}
                className="w-full rounded-2xl border border-white/10 bg-black/24 py-2.5 pl-9 pr-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-white/25"
              />
            </div>
          </label>

          <div className="grid gap-2 md:grid-flow-col">
            {config.filters.map((filter) => (
              <FilterControl
                key={filter.key}
                filter={filter}
                value={filters[filter.key] ?? ""}
                artists={artists}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, [filter.key]: value }))
                }
              />
            ))}
          </div>
        </div>

        {isFormOpen ? (
          <form onSubmit={submit} className="mx-4 mb-4 rounded-[26px] border border-white/10 bg-black/24 p-4 tablet:mx-5 tablet:mb-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                  {editing ? "Editar" : "Criar"}
                </div>
                <h3 className="text-lg font-black text-white">
                  {editing ? String(editing[config.primaryField] ?? config.singular) : config.newLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-full border border-white/10 p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {config.fields.map((field) => (
                <label
                  key={field.key}
                  className={cn(
                    "grid gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-white/38",
                    field.span === "full" ? "md:col-span-2 xl:col-span-3" : null,
                  )}
                >
                  {field.label}
                  <FieldInput
                    field={field}
                    value={form[field.key]}
                    artists={artists}
                    onChange={(value) => updateForm(field.key, value)}
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving} className="rounded-full bg-white text-slate-950 hover:bg-white/90">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Salvar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                disabled={isSaving}
                className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-y border-white/10 bg-black/16 text-[11px] font-black uppercase tracking-[0.14em] text-white/38">
                {config.columns.map((column) => (
                  <th key={column.key} className="px-4 py-3">
                    {column.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-white/10 text-sm text-white/70 transition hover:bg-white/[0.035]">
                  {config.columns.map((column) => (
                    <td key={column.key} className="max-w-[260px] px-4 py-3">
                      <div className="truncate">
                        {formatCell(row, column.key, column.type, artists)}
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="rounded-full border border-white/10 p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting === row.id}
                        onClick={() => void deleteRow(row)}
                        className="rounded-full border border-rose-300/15 p-2 text-rose-200/60 transition hover:bg-rose-300/10 hover:text-rose-100 disabled:opacity-50"
                      >
                        {isDeleting === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRows.length === 0 ? (
            <div className="p-6">
              <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-8 text-center">
                <div className="text-base font-black text-white">Nada encontrado</div>
                <p className="mt-2 text-sm text-white/45">
                  Ajuste os filtros ou crie o primeiro registro de {config.singular}.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
