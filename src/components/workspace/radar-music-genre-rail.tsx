import Link from "next/link";
import { cn } from "@/lib/utils";
import type { RadarMusicGenreSpotlight } from "@/types/workspace";

const toneClasses = {
  green:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15",
  purple:
    "border-violet-500/20 bg-violet-500/10 text-violet-100 hover:bg-violet-500/15",
  blue:
    "border-sky-500/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/15",
  yellow:
    "border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15",
  slate:
    "border-slate-500/20 bg-slate-500/10 text-slate-100 hover:bg-slate-500/15",
  red: "border-red-500/20 bg-red-500/10 text-red-100 hover:bg-red-500/15",
} as const;

function coverStyle(coverUrl: string | null) {
  if (!coverUrl) {
    return undefined;
  }

  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

export default function RadarMusicGenreRail({
  items,
}: {
  items: RadarMusicGenreSpotlight[];
}) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_48px_-34px_rgba(8,15,28,0.9)]">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
          Generos em destaque
        </div>
      </div>

      <div className="grid gap-3 tablet:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.value}
            href={item.href}
            className={cn(
              "group relative overflow-hidden rounded-[22px] border p-4 transition-all duration-200",
              toneClasses[item.tone],
              item.isActive ? "ring-1 ring-white/20" : "",
            )}
          >
            <div className="relative z-10 space-y-2">
              <div className="text-[11px] uppercase tracking-[0.22em] text-current/70">
                {item.chipLabel}
              </div>
              <div className="pr-16 text-lg font-semibold">{item.label}</div>
              <p className="max-w-[16rem] text-sm leading-5 text-current/75">
                {item.description}
              </p>
            </div>

            <div
              className="absolute bottom-4 right-4 h-12 w-12 rounded-xl border border-white/10 bg-white/10 shadow-lg transition-transform duration-200 group-hover:scale-105"
              style={coverStyle(item.coverUrl)}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
