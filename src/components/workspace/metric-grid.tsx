import Container from "@/components/container";
import { cn } from "@/lib/utils";
import type { WorkspaceMetric } from "@/types/workspace";

const toneDotClasses = {
  green: "bg-emerald-400",
  red: "bg-red-400",
  blue: "bg-sky-400",
  purple: "bg-violet-400",
  yellow: "bg-amber-400",
  slate: "bg-slate-400",
} as const;

export default function MetricGrid({
  metrics,
}: {
  metrics: WorkspaceMetric[];
}) {
  return (
    <Container className="border-b border-border py-5">
      <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
        {metrics.map((metric) => (
          <article
            key={metric.title}
            className="rounded-2xl border border-border bg-card/70 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    toneDotClasses[metric.tone],
                  )}
                />
                {metric.title}
              </div>
            </div>
            <div className="mt-4 text-3xl font-semibold">{metric.value}</div>
            <p className="mt-2 text-sm text-muted-foreground">{metric.helper}</p>
          </article>
        ))}
      </div>
    </Container>
  );
}
