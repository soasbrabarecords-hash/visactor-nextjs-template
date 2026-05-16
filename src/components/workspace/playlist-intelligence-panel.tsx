import { ArrowDown, ArrowUp, Gauge, ListChecks, Sparkles } from "lucide-react";
import type {
  PlaylistDecisionAction,
  PlaylistIntelligenceResult,
  PlaylistTrackDecision,
} from "@/lib/playlist-intelligence";
import { cn } from "@/lib/utils";

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function coverStyle(coverUrl: string | null) {
  if (!coverUrl) return undefined;
  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function actionClasses(action: PlaylistDecisionAction) {
  if (action === "priority") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200";
  if (action === "raise") return "border-sky-400/40 bg-sky-400/10 text-sky-700 dark:text-sky-200";
  if (action === "lower") return "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-200";
  if (action === "test") return "border-rose-400/40 bg-rose-400/10 text-rose-700 dark:text-rose-200";
  return "border-border bg-muted/50 text-muted-foreground";
}

function actionIcon(action: PlaylistDecisionAction) {
  if (action === "priority") return <Sparkles className="h-3.5 w-3.5" />;
  if (action === "raise") return <ArrowUp className="h-3.5 w-3.5" />;
  if (action === "lower" || action === "test") return <ArrowDown className="h-3.5 w-3.5" />;
  return <ListChecks className="h-3.5 w-3.5" />;
}

function DecisionCard({ decision }: { decision: PlaylistTrackDecision }) {
  return (
    <article className="group relative overflow-hidden rounded-[22px] border border-border/80 bg-background/[0.72] p-3 shadow-[0_18px_50px_-40px_rgba(8,15,28,0.7)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background/[0.88] dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex items-start gap-3">
        <div
          className="h-12 w-12 shrink-0 rounded-[16px] border border-border/70 bg-muted shadow-inner dark:border-white/10"
          style={coverStyle(decision.imageUrl)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                actionClasses(decision.action),
              )}
            >
              {actionIcon(decision.action)}
              {decision.label}
            </span>
            <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-1 text-[10px] font-bold tabular-nums text-muted-foreground">
              {formatPercent(decision.score)}
            </span>
          </div>
          <h4 className="mt-2 truncate text-sm font-black text-foreground">{decision.name}</h4>
          <p className="truncate text-xs font-medium text-muted-foreground">{decision.artists}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-muted/70 px-2 py-1 text-[10px] font-bold text-muted-foreground">
              #{decision.currentIndex + 1} &gt; #{decision.suggestedIndex + 1}
            </span>
            {decision.signals.slice(0, 2).map((signal) => (
              <span key={signal} className="rounded-full bg-muted/70 px-2 py-1 text-[10px] font-bold text-muted-foreground">
                {signal}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function PlaylistIntelligencePanel({
  intelligence,
  isEnriching,
}: {
  intelligence: PlaylistIntelligenceResult;
  isEnriching: boolean;
}) {
  const { summary } = intelligence;
  const priority = intelligence.decisions
    .filter((decision) => decision.action === "priority" || decision.action === "raise")
    .sort((a, b) => a.suggestedIndex - b.suggestedIndex)
    .slice(0, 3);
  const review = intelligence.decisions
    .filter((decision) => decision.action === "test" || decision.action === "lower")
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const orderPreview = intelligence.decisions
    .filter((decision) => Math.abs(decision.currentIndex - decision.suggestedIndex) >= 3)
    .sort((a, b) => Math.abs(b.currentIndex - b.suggestedIndex) - Math.abs(a.currentIndex - a.suggestedIndex))
    .slice(0, 4);
  const focusList = [...priority, ...review, ...orderPreview]
    .filter((decision, index, list) => list.findIndex((item) => item.trackKey === decision.trackKey) === index)
    .slice(0, 6);

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-border/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(241,245,249,0.68))] p-4 shadow-[0_24px_90px_-58px_rgba(15,23,42,0.48)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(3,7,18,0.92))] tablet:p-5">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/[0.16] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-24 h-64 w-64 rounded-full bg-sky-400/[0.16] blur-3xl" />

      <div className="relative grid gap-4 laptop:grid-cols-[0.9fr_1.5fr]">
        <div className="flex flex-col justify-between rounded-[24px] border border-border/70 bg-background/[0.72] p-4 dark:border-white/10 dark:bg-black/20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              Curadoria IA
            </span>
            <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-foreground">
              Ordem sugerida da semana
            </h3>
            <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
              Leitura segura: popularidade, chart BR e Kworb. Nada e salvo no Spotify aqui.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-[18px] border border-border/70 bg-muted/40 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Score</p>
              <p className="mt-1 text-xl font-black tabular-nums">{formatPercent(summary.averageScore)}</p>
            </div>
            <div className="rounded-[18px] border border-border/70 bg-muted/40 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Subir</p>
              <p className="mt-1 text-xl font-black tabular-nums">{summary.priorityCount + summary.raiseCount}</p>
            </div>
            <div className="rounded-[18px] border border-border/70 bg-muted/40 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Revisar</p>
              <p className="mt-1 text-xl font-black tabular-nums">{summary.reviewCount}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
              <Gauge className="h-3.5 w-3.5" />
              Confianca {summary.confidenceLabel}
            </span>
            <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
              {summary.chartMatches} no chart
            </span>
            <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
              {summary.streamMatches} com Kworb
            </span>
            {isEnriching && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-amber-700 dark:text-amber-200">
                atualizando sinais
              </span>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-border/70 bg-background/60 p-3 dark:border-white/10 dark:bg-black/20">
          {focusList.length > 0 ? (
            <div className="grid gap-3 tablet:grid-cols-2">
              {focusList.map((decision) => (
                <DecisionCard key={decision.trackKey} decision={decision} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-[22px] border border-dashed border-border/80 bg-muted/30 px-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
              <div>
                <ListChecks className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-black text-foreground">Playlist equilibrada</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Nenhuma mudanca forte apareceu nos sinais atuais.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
