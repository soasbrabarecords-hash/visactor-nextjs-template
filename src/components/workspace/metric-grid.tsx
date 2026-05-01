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

const toneCardClasses = {
  green: "border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(12,18,16,0.94))]",
  red: "border-red-500/20 bg-[linear-gradient(180deg,rgba(248,113,113,0.16),rgba(18,12,12,0.94))]",
  blue: "border-sky-500/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.16),rgba(10,16,20,0.94))]",
  purple: "border-violet-500/20 bg-[linear-gradient(180deg,rgba(167,139,250,0.16),rgba(14,12,20,0.94))]",
  yellow: "border-amber-500/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.18),rgba(22,17,10,0.94))]",
  slate: "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(12,14,18,0.94))]",
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
            className={cn(
              "group relative overflow-hidden rounded-[26px] border p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-0.5",
              toneCardClasses[metric.tone],
            )}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    toneDotClasses[metric.tone],
                  )}
                />
                {metric.title}
              </div>
            </div>
            <div className="mt-5 text-4xl font-semibold tracking-tight">
              {metric.value}
            </div>
            <p className="mt-3 max-w-[22ch] text-sm leading-6 text-white/70">
              {metric.helper}
            </p>
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  toneDotClasses[metric.tone],
                )}
                style={{ width: `${Math.max(18, Math.min(100, metric.value.length * 12))}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </Container>
  );
}
