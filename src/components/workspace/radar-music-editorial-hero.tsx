import Link from "next/link";
import { ExternalLink, Sparkles, TrendingUp } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RadarMusicEditorialHero } from "@/types/workspace";
import StatusBadge from "./status-badge";

const genreThemes = [
  {
    match: ["trap", "rap", "hip hop"],
    className:
      "border-violet-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.28),_transparent_34%),linear-gradient(135deg,rgba(12,16,35,0.98),rgba(19,11,45,0.96))]",
  },
  {
    match: ["funk", "sertanejo", "pagode", "samba"],
    className:
      "border-amber-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.22),_transparent_36%),linear-gradient(135deg,rgba(16,14,28,0.98),rgba(43,26,8,0.94))]",
  },
  {
    match: ["pop", "latin", "reggaeton"],
    className:
      "border-sky-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_34%),linear-gradient(135deg,rgba(8,14,30,0.98),rgba(6,31,45,0.96))]",
  },
];

function getThemeClass(genreLabel: string) {
  const normalized = genreLabel.toLowerCase();

  return (
    genreThemes.find((theme) =>
      theme.match.some((item) => normalized.includes(item)),
    )?.className ??
    "border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_34%),linear-gradient(135deg,rgba(10,18,34,0.98),rgba(6,28,25,0.96))]"
  );
}

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

export default function RadarMusicEditorialHero({
  hero,
}: {
  hero: RadarMusicEditorialHero;
}) {
  return (
    <Container className="border-b border-border py-8">
      <section
        className={cn(
          "overflow-hidden rounded-[32px] border p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.75)] laptop:p-8",
          getThemeClass(hero.genreLabel),
        )}
      >
        <div className="grid gap-8 laptop:grid-cols-[1.2fr_0.8fr] laptop:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                {hero.badge}
              </div>
              <StatusBadge tone="blue">{hero.countryLabel}</StatusBadge>
              <StatusBadge tone="purple">{hero.genreLabel}</StatusBadge>
              <StatusBadge tone="green">{hero.periodLabel}</StatusBadge>
            </div>

            <div className="space-y-4">
              <h2 className="max-w-5xl text-4xl font-semibold tracking-tight text-white laptop:text-6xl">
                {hero.headline}
              </h2>
              <p className="max-w-3xl text-base leading-8 text-white/70 laptop:text-lg">
                {hero.summary}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <StatusBadge tone="green">{hero.rankLabel}</StatusBadge>
              <StatusBadge tone="yellow">{hero.movementLabel}</StatusBadge>
              <StatusBadge tone="blue">{hero.trackName}</StatusBadge>
            </div>

            <div className="grid gap-3 tablet:grid-cols-3">
              {hero.stats.map((item) => (
                <article
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm"
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-white/50">
                    {item.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {item.value}
                  </div>
                </article>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={hero.spotifyUrl} target="_blank" rel="noreferrer">
                  Abrir track lider
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                {hero.artists}
              </div>
            </div>
          </div>

          <div className="flex justify-center laptop:justify-end">
            <div className="relative w-full max-w-[360px]">
              <div className="absolute inset-x-8 bottom-0 top-10 rounded-[28px] bg-primary/20 blur-3xl" />
              <div className="relative rounded-[30px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <div
                  className="aspect-square w-full rounded-[26px] bg-white/5 shadow-2xl"
                  style={coverStyle(hero.coverUrl)}
                />
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-white">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/55">
                    Em destaque agora
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{hero.trackName}</div>
                  <div className="mt-1 text-sm text-white/70">{hero.artists}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Container>
  );
}
