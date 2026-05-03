"use client";

import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
};

type RoleChipSelectorProps = {
  label: string;
  hint?: string;
  options: readonly Option[];
  value: string[];
  onChange: (nextValue: string[]) => void;
};

export default function RoleChipSelector({
  label,
  hint,
  options,
  value,
  onChange,
}: RoleChipSelectorProps) {
  function toggleRole(role: string) {
    if (value.includes(role)) {
      onChange(value.filter((current) => current !== role));
      return;
    }

    onChange([...value, role]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-medium text-white">{label}</div>
        {hint ? <div className="text-sm text-white/52">{hint}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleRole(option.value)}
              className={cn(
                "rounded-full border px-3 py-2 text-sm font-medium transition",
                active
                  ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-100 shadow-[0_0_0_1px_rgba(52,211,153,0.12)_inset]"
                  : "border-white/10 bg-white/[0.04] text-white/68 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
