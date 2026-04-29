import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/types/workspace";

const toneClasses: Record<StatusTone, string> = {
  green:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 dark:text-emerald-300",
  red: "border-red-500/30 bg-red-500/10 text-red-400 dark:text-red-300",
  blue: "border-sky-500/30 bg-sky-500/10 text-sky-400 dark:text-sky-300",
  purple:
    "border-violet-500/30 bg-violet-500/10 text-violet-400 dark:text-violet-300",
  yellow:
    "border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-300",
  slate:
    "border-slate-500/20 bg-slate-500/10 text-slate-500 dark:text-slate-300",
};

export default function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
