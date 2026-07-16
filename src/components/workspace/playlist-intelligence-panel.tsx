"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Gauge, ListChecks, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function movementLabel(decision: PlaylistTrackDecision) {
  const delta = decision.currentIndex - decision.suggestedIndex;
  if (delta > 0) return `sobe ${delta}`;
  if (delta < 0) return `desce ${Math.abs(delta)}`;
  return "mantem";
}

function DecisionCard({ decision }: { decision: PlaylistTrackDecision }) {
  return (
    <article className="rounded-2xl border border-border/80 bg-background/70 p-2.5 transition hover:border-primary/30 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex items-center gap-2.5">
        <div
          className="h-10 w-10 shrink-0 rounded-xl border border-border/70 bg-muted dark:border-white/10"
          style={coverStyle(decision.imageUrl)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-xs font-semibold text-foreground">{decision.name}</h4>
              <p className="truncate text-[10px] text-muted-foreground">{decision.artists}</p>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em]",
                actionClasses(decision.action),
              )}
            >
              {actionIcon(decision.action)}
              {decision.label}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="font-semibold tabular-nums">#{decision.currentIndex + 1} → #{decision.suggestedIndex + 1}</span>
            <span className="truncate">{decision.signals[0]}</span>
            <span className="ml-auto font-semibold tabular-nums">{formatPercent(decision.score)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function OrderPreviewRow({ decision }: { decision: PlaylistTrackDecision }) {
  const delta = decision.currentIndex - decision.suggestedIndex;
  const isUp = delta > 0;
  const isDown = delta < 0;

  return (
    <article className="grid gap-2 rounded-2xl border border-border/80 bg-background/70 p-2.5 transition hover:border-primary/30 dark:border-white/10 dark:bg-white/[0.035] tablet:grid-cols-[54px_1fr_auto] tablet:items-center">
      <div className="flex items-center gap-2 tablet:block">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Nova</span>
        <div className="text-lg font-semibold tabular-nums tracking-[-0.03em] text-foreground">
          #{decision.suggestedIndex + 1}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className="h-10 w-10 shrink-0 rounded-xl border border-border/70 bg-muted dark:border-white/10"
          style={coverStyle(decision.imageUrl)}
        />
        <div className="min-w-0">
          <h4 className="truncate text-xs font-semibold text-foreground">{decision.name}</h4>
          <p className="truncate text-[10px] text-muted-foreground">{decision.artists} · {decision.reason}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 tablet:justify-end">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em]",
            actionClasses(decision.action),
          )}
        >
          {actionIcon(decision.action)}
          {decision.label}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold tabular-nums",
            isUp && "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200",
            isDown && "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-200",
            !isUp && !isDown && "border-border bg-muted/50 text-muted-foreground",
          )}
        >
          {isUp ? <ArrowUp className="h-3 w-3" /> : isDown ? <ArrowDown className="h-3 w-3" /> : <ListChecks className="h-3 w-3" />}
          #{decision.currentIndex + 1} | {movementLabel(decision)}
        </span>
      </div>
    </article>
  );
}

export default function PlaylistIntelligencePanel({
  intelligence,
  isEnriching,
  isApplyingOrder = false,
  applyDisabledReason,
  onApplySuggestedOrder,
}: {
  intelligence: PlaylistIntelligenceResult;
  isEnriching: boolean;
  isApplyingOrder?: boolean;
  applyDisabledReason?: string;
  onApplySuggestedOrder?: () => Promise<boolean>;
}) {
  const [view, setView] = useState<"summary" | "order">("summary");
  const { summary } = intelligence;
  const hasOrderChanges = summary.orderChangesCount > 0;
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
  const suggestedOrder = [...intelligence.decisions].sort((a, b) => a.suggestedIndex - b.suggestedIndex);
  const canApplyOrder = Boolean(
    onApplySuggestedOrder && hasOrderChanges && !isApplyingOrder && !applyDisabledReason,
  );

  async function handleApplyOrder() {
    if (!onApplySuggestedOrder || !canApplyOrder) return;
    const success = await onApplySuggestedOrder();
    if (success) {
      setView("summary");
    }
  }

  return (
    <section className="rounded-[22px] border border-border/80 bg-background/72 p-3 shadow-[0_18px_56px_-46px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
      <header className="flex flex-col gap-3 laptop:flex-row laptop:items-center laptop:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/12 text-emerald-700 ring-1 ring-inset ring-emerald-400/25 dark:text-emerald-200">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Curadoria IA</h3>
              {isEnriching ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-200">
                  <Loader2 className="h-3 w-3 animate-spin" /> atualizando sinais
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {summary.orderChangesCount} ajustes sugeridos · {summary.priorityCount + summary.raiseCount} faixas para subir
              {summary.accountMatches > 0
                ? ` · ${summary.accountMatches} sinais da conta`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-muted/35 px-3 text-[10px] font-medium text-muted-foreground">
            <Gauge className="h-3 w-3" /> {summary.confidenceLabel} · score {formatPercent(summary.averageScore)}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setView(view === "order" ? "summary" : "order")}
            disabled={!hasOrderChanges && view !== "order"}
            className="h-8 rounded-full px-3 text-xs"
          >
            {view === "order" ? "Fechar sugestões" : "Revisar sugestões"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleApplyOrder()}
            disabled={!canApplyOrder}
            className="h-8 rounded-full px-3 text-xs"
            title={applyDisabledReason}
          >
            {isApplyingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListChecks className="h-3.5 w-3.5" />}
            Aplicar ordem sugerida
          </Button>
        </div>
      </header>

      {view === "order" && hasOrderChanges ? (
        <div className="mt-3 border-t border-border/70 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Preview completo — nada muda até confirmar.</p>
            <span className="text-[10px] font-semibold text-muted-foreground">{summary.orderChangesCount} ajustes</span>
          </div>
          <div className="grid max-h-[360px] gap-1.5 overflow-y-auto pr-1">
            {suggestedOrder.map((decision) => (
              <OrderPreviewRow key={decision.trackKey} decision={decision} />
            ))}
          </div>
        </div>
      ) : focusList.length > 0 ? (
        <div className="mt-3 grid gap-1.5 border-t border-border/70 pt-3 tablet:grid-cols-3">
          {focusList.slice(0, 3).map((decision) => (
            <DecisionCard key={decision.trackKey} decision={decision} />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          <ListChecks className="h-4 w-4" /> Playlist equilibrada nos sinais atuais.
        </div>
      )}
    </section>
  );
}
