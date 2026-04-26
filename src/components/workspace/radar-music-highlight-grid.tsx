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
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Tracks em destaque
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Leitura rapida do chart</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Os sinais mais importantes do momento com capa, cor e contexto editorial para bater o olho e decidir rapido.
        </p>
      </div>

      <div className="grid gap-4 laptop:grid-cols-12">
        {highlights.map((card, index) => (
          <article
            key={card.title}
            className={cn(
              "relative overflow-hidden rounded-[28px] border p-5 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.9)]",
              cardClasses[card.tone],
              index < 3 ? "laptop:col-span-4" : "laptop:col-span-6",
            )}
          >
            <div className="relative z-10 max-w-[70%] space-y-3">
              <StatusBadge tone={card.tone}>{card.accentLabel}</StatusBadge>
              <div className="text-xs uppercase tracking-[0.18em] text-white/55">
                {card.title}
              </div>
              <div className="text-4xl font-semibold tracking-tight text-white">
                {card.value}
              </div>
              <div className="text-sm text-white/70">{card.helper}</div>
              <p className="text-sm leading-6 text-white/65">{card.detail}</p>
            </div>

            <div
              className="absolute bottom-5 right-5 h-24 w-24 rounded-[22px] border border-white/10 bg-white/10 shadow-xl"
              style={coverStyle(card.coverUrl)}
            />
          </article>
        ))}
      </div>
    </Container>
  );
}
