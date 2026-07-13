"use client";

import { useEffect, useRef, useState } from "react";
import type { LabelEntity } from "@/lib/label-entities-types";
import {
  ENTITY_FUNCTION_LABELS,
  ENTITY_TYPE_LABELS,
  type EntityFunction,
} from "@/lib/label-os-taxonomy";

const TYPE_COLOR: Record<string, string> = {
  label: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  imprint: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  publisher: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  manager: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  company: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  other: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
  artist: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  producer: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  composer: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

type Props = {
  value: LabelEntity | null;
  onChange: (entity: LabelEntity | null) => void;
  placeholder?: string;
  required?: boolean;
  roles?: EntityFunction[];
  excludeIds?: string[];
  nameMode?: "public" | "legal";
};

function entityName(entity: LabelEntity, mode: Props["nameMode"]) {
  const publicName = entity.display_name?.trim();
  if (mode === "legal") {
    return publicName && publicName.toLocaleLowerCase("pt-BR") !== entity.name.toLocaleLowerCase("pt-BR")
      ? `${entity.name} (${publicName})`
      : entity.name;
  }
  return publicName || entity.name;
}

export default function EntityCombobox({
  value,
  onChange,
  placeholder = "Buscar gravadora, selo, editora ou parceiro...",
  required = false,
  roles = [],
  excludeIds = [],
  nameMode = "public",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LabelEntity[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rolesKey = roles.join(",");
  const excludeIdsKey = excludeIds.join(",");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (rolesKey) params.set("roles", rolesKey);
        const res = await fetch(`/api/label-os/entities/search?${params.toString()}`);
        const data = (await res.json()) as LabelEntity[];
        const excluded = new Set(excludeIdsKey ? excludeIdsKey.split(",") : []);
        setResults(
          Array.isArray(data)
            ? data.filter((entity) => !excluded.has(entity.id))
            : [],
        );
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [excludeIdsKey, query, rolesKey]);

  const handleSelect = (entity: LabelEntity) => {
    onChange(entity);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      {value ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">
                {entityName(value, nameMode)}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[value.type] ?? TYPE_COLOR.other}`}
              >
                {ENTITY_TYPE_LABELS[value.type] ?? value.type}
              </span>
            </div>
            {value.roles?.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {value.roles.slice(0, 2).map((role) => (
                  <span
                    key={role}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {ENTITY_FUNCTION_LABELS[role as EntityFunction] ?? role}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Remover seleção"
          >
            ✕
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 1 && setOpen(true)}
          placeholder={placeholder}
          required={required}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
        />
      )}

      {open && !value && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {loading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Buscando...</div>
          ) : null}
          {!loading && results.length === 0 ? (
            <div className="flex flex-col gap-2 px-4 py-3">
              <p className="text-sm text-muted-foreground">Nenhuma entidade encontrada.</p>
              <a
                href="/label-os/entities/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 underline underline-offset-2 dark:text-blue-400"
              >
                + Criar nova pessoa ou entidade
              </a>
            </div>
          ) : null}
          {!loading &&
            results.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => handleSelect(entity)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entityName(entity, nameMode)}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[entity.type] ?? TYPE_COLOR.other}`}
                  >
                    {ENTITY_TYPE_LABELS[entity.type] ?? entity.type}
                  </span>
                </div>
                {entity.display_name &&
                entity.display_name.toLocaleLowerCase("pt-BR") !==
                  entity.name.toLocaleLowerCase("pt-BR") &&
                nameMode !== "legal" ? (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entity.name}
                  </div>
                ) : null}
                {entity.roles?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entity.roles.slice(0, 2).map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {ENTITY_FUNCTION_LABELS[role as EntityFunction] ?? role}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
