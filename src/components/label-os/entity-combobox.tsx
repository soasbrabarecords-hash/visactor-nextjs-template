"use client";

import { useEffect, useRef, useState } from "react";
import type { LabelEntity } from "@/lib/label-entities-types";

const TYPE_LABEL: Record<string, string> = {
  artist: "Artista",
  label: "Gravadora",
  publisher: "Editora",
  producer: "Produtor",
  composer: "Compositor",
  manager: "Manager",
  company: "Empresa",
  other: "Outro",
};

const TYPE_COLOR: Record<string, string> = {
  artist: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  label: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  publisher: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  producer: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  composer: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  manager: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  company: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  other: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
};

type Props = {
  value: LabelEntity | null;
  onChange: (entity: LabelEntity | null) => void;
  placeholder?: string;
  required?: boolean;
};

export default function EntityCombobox({
  value,
  onChange,
  placeholder = "Buscar artista, gravadora ou empresa...",
  required = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LabelEntity[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Busca com debounce
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
        const res = await fetch(
          `/api/label-os/entities/search?q=${encodeURIComponent(query.trim())}`,
        );
        const data = (await res.json()) as LabelEntity[];
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [query]);

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
      {/* Entidade selecionada */}
      {value ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">
              {value.display_name ?? value.name}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[value.type] ?? TYPE_COLOR.other}`}
            >
              {TYPE_LABEL[value.type] ?? value.type}
            </span>
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

      {/* Dropdown de resultados */}
      {open && !value && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {loading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Buscando...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="flex flex-col gap-2 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Nenhuma entidade encontrada.
              </p>
              <a
                href="/label-os/entities/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 underline underline-offset-2 dark:text-blue-400"
              >
                + Criar nova entidade
              </a>
            </div>
          )}
          {!loading &&
            results.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => handleSelect(entity)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {entity.display_name ?? entity.name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[entity.type] ?? TYPE_COLOR.other}`}
                >
                  {TYPE_LABEL[entity.type] ?? entity.type}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
