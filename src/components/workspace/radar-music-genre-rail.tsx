import Link from "next/link";
import Container from "@/components/container";
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
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Generos em destaque
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Rotas editoriais rapidas</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Atalhos visuais para navegar entre recortes do mercado sem perder o contexto do chart.
        </p>
      </div>

      <div className="grid gap-4 laptop:grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.value}
            href={item.href}
            className={cn(
              "group relative overflow-hidden rounded-[28px] border p-5 transition-all duration-200",
              toneClasses[item.tone],
              item.isActive ? "ring-1 ring-white/20" : "",
            )}
          >
            <div className="relative z-10 space-y-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-current/70">
                {item.chipLabel}
              </div>
              <div className="text-2xl font-semibold">{item.label}</div>
              <p className="max-w-[16rem] text-sm leading-6 text-current/75">
                {item.description}
              </p>
            </div>

            <div
              className="absolute bottom-4 right-4 h-20 w-20 rounded-2xl border border-white/10 bg-white/10 shadow-xl transition-transform duration-200 group-hover:scale-105"
              style={coverStyle(item.coverUrl)}
            />
          </Link>
        ))}
      </div>
    </Container>
  );
}
