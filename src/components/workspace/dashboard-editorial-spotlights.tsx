import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import { cn } from "@/lib/utils";
import type { DashboardEditorialSpotlight } from "@/types/workspace";
import StatusBadge from "./status-badge";

const toneRingClasses = {
  green: "border-emerald-500/25",
  red: "border-red-500/25",
  blue: "border-sky-500/25",
  purple: "border-violet-500/25",
  yellow: "border-amber-500/25",
  slate: "border-slate-500/25",
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

export default function DashboardEditorialSpotlights({
  spotlights,
}: {
  spotlights: DashboardEditorialSpotlight[];
}) {
  if (spotlights.length === 0) {
    return null;
  }

  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Curadoria editorial
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Leituras que merecem acao</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          O dashboard prioriza entradas, apostas e alertas cruzando subida no chart,
          consistencia no radar e fit com a sua base.
        </p>
      </div>

      <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
        {spotlights.map((spotlight) => (
          <article
            key={`${spotlight.title}-${spotlight.trackName}`}
            className={cn(
              "flex min-h-[320px] flex-col rounded-2xl border bg-card/70 p-5",
              toneRingClasses[spotlight.tone],
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {spotlight.title}
                </div>
                <StatusBadge tone={spotlight.tone}>{spotlight.badge}</StatusBadge>
              </div>
              <div
                className="h-14 w-14 shrink-0 rounded-2xl border border-border bg-muted"
                style={coverStyle(spotlight.coverUrl)}
              />
            </div>

            <div className="mt-5 min-w-0">
              <h3 className="truncate text-xl font-semibold">{spotlight.trackName}</h3>
              <p className="truncate text-sm text-muted-foreground">
                {spotlight.artists}
              </p>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {spotlight.summary}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {spotlight.stats.map((stat) => (
                <span
                  key={stat}
                  className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground"
                >
                  {stat}
                </span>
              ))}
            </div>

            <div className="mt-auto pt-5">
              <Link
                href={spotlight.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Abrir no Spotify
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </Container>
  );
}
