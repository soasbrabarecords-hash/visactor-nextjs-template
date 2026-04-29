import Container from "@/components/container";
import type { HeroInsight } from "@/types/workspace";
import StatusBadge from "./status-badge";

export default function HeroInsightPanel({
  insight,
}: {
  insight: HeroInsight;
}) {
  return (
    <Container className="border-b border-border py-6">
      <section className="rounded-[28px] border border-border bg-card/80 p-6 shadow-sm laptop:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={insight.tone}>Hero insight</StatusBadge>
        </div>
        <h2 className="mt-4 max-w-5xl text-3xl font-semibold tracking-tight laptop:text-5xl">
          {insight.headline}
        </h2>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground laptop:text-lg">
          {insight.summary}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {insight.supportingPoints.map((point) => (
            <div
              key={point}
              className="rounded-full border border-border bg-background/50 px-4 py-2 text-sm text-muted-foreground"
            >
              {point}
            </div>
          ))}
        </div>
      </section>
    </Container>
  );
}
