import Container from "@/components/container";
import { cn } from "@/lib/utils";
import type { HeroInsight } from "@/types/workspace";
import StatusBadge from "./status-badge";

const toneSurfaceClasses = {
  green: "border-emerald-500/20 bg-emerald-500/10",
  red: "border-red-500/20 bg-red-500/10",
  blue: "border-sky-500/20 bg-sky-500/10",
  purple: "border-violet-500/20 bg-violet-500/10",
  yellow: "border-amber-500/20 bg-amber-500/10",
  slate: "border-white/10 bg-white/5",
} as const;

export default function HeroInsightPanel({
  insight,
}: {
  insight: HeroInsight;
}) {
  return (
    <Container className="border-b border-border py-6">
      <section
        className={cn(
          "rounded-[30px] border p-6 shadow-sm laptop:p-8",
          toneSurfaceClasses[insight.tone],
        )}
      >
        <div className="grid gap-6 laptop:grid-cols-[1.2fr_0.8fr] laptop:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={insight.tone}>Pulse editorial</StatusBadge>
            </div>
            <h2 className="mt-4 max-w-5xl text-3xl font-semibold tracking-tight laptop:text-[2.7rem]">
              {insight.headline}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground laptop:text-lg">
              {insight.summary}
            </p>
          </div>

          <div className="grid gap-3">
            {insight.supportingPoints.map((point, index) => (
              <article
                key={point}
                className="rounded-2xl border border-white/10 bg-background/55 px-4 py-4 backdrop-blur"
              >
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {index === 0 ? "Agora" : index === 1 ? "Movimento" : "Leitura base"}
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                  {point}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </Container>
  );
}
