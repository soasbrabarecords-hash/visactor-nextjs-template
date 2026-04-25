"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { MusicFilterOption } from "@/types/music-charts";

function FilterSelect({
  label,
  value,
  options,
  disabled,
  onValueChange,
}: {
  label: string;
  value: string;
  options: MusicFilterOption[];
  disabled: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-[180px] gap-2 text-sm">
      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary disabled:cursor-wait disabled:opacity-70"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function MusicFilters({
  countryOptions,
  genreOptions,
  selectedCountry,
  selectedGenre,
}: {
  countryOptions: MusicFilterOption[];
  genreOptions: MusicFilterOption[];
  selectedCountry: string;
  selectedGenre: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParams(nextCountry: string, nextGenre: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("country", nextCountry);
    params.set("genre", nextGenre);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, {
        scroll: false,
      });
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <FilterSelect
        label="Pais"
        value={selectedCountry}
        options={countryOptions}
        disabled={isPending}
        onValueChange={(value) => updateParams(value, selectedGenre)}
      />
      <FilterSelect
        label="Genero"
        value={selectedGenre}
        options={genreOptions}
        disabled={isPending}
        onValueChange={(value) => updateParams(selectedCountry, value)}
      />
    </div>
  );
}
