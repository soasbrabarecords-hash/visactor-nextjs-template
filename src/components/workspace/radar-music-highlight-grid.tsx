import Container from "@/components/container";
import { cn } from "@/lib/utils";
import type { RadarMusicSummaryCard } from "@/types/workspace";
import StatusBadge from "./status-badge";

const cardClasses = {
  green:
    "border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(2,6,23,0.94))]",
  red: "border-red-500/20 bg-[linear-gradient(180deg,rgba(239,68,68,0.10),rgba(2,6,23,0.94))]",
  purple:
    "border-violet-500/20 bg-[linear-gradient(180deg,rgba(168,85,247,0.10),rgba(2,6,23,0.94))]",
  yellow:
    "border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.10),rgba(2,6,23,0.94))]",
  blue:
    "border-sky-500/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.10),rgba(2,6,23,0.94))]",
  slate:
    "border-slate-500/20 bg-[linear-gradient(180deg,rgba(100,116,139,0.10),rgba(2,6,23,0.94))]",
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

export default function RadarMusicHighlightGrid({
  highlights,
}: {
  highlights: RadarMusicSummaryCard[];
}) {
  return (
    <Container className="border-b border-border/70 py-5">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
          Destaques do chart
        </div>
      </div>

      <div className="grid gap-3 tablet:grid-cols-2 laptop:grid-cols-5">
        {highlights.map((card) => (
          <article
            key={card.title}
            className={cn(
              "relative overflow-hidden rounded-[22px] border p-4 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.85)]",
              cardClasses[card.tone],
            )}
          >
            <div className="relative z-10 max-w-[72%] space-y-2">
              <StatusBadge tone={card.tone}>{card.accentLabel}</StatusBadge>
              <div className="text-xs uppercase tracking-[0.18em] text-white/55">
                {card.title}
              </div>
              <div className="text-3xl font-semibold tracking-tight text-white">
                {card.value}
              </div>
              <div className="text-sm text-white/70">{card.helper}</div>
            </div>

            <div
              className="absolute bottom-4 right-4 h-14 w-14 rounded-2xl border border-white/10 bg-white/10 shadow-lg"
              style={coverStyle(card.coverUrl)}
            />
          </article>
        ))}
      </div>
    </Container>
  );
}
