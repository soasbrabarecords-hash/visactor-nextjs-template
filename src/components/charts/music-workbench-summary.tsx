import Container from "@/components/container";
import type { MusicWorkbenchMetric } from "@/types/music-charts";

export default function MusicWorkbenchSummary({
  cards,
}: {
  cards: MusicWorkbenchMetric[];
}) {
  return (
    <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-4 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
      {cards.map((card) => (
        <Container key={card.title} className="py-4">
          <section className="flex h-full flex-col">
            <div className="text-sm font-medium text-muted-foreground">
              {card.title}
            </div>
            <div className="mt-3 text-4xl font-medium tracking-tight">
              {card.value}
            </div>
            <p className="mt-2 max-w-[24ch] text-sm text-muted-foreground">
              {card.caption}
            </p>
          </section>
        </Container>
      ))}
    </div>
  );
}
