import type { ReactNode } from "react";
import {
  AlertTriangle,
  Clock3,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";
import type { MusicDataTrustContext } from "@/types/music-charts";

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/80 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function SourceStat({
  icon,
  label,
  value,
  caption,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/10 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-medium">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{caption}</div>
    </div>
  );
}

export default function MusicInsightPanel({
  context,
}: {
  context: MusicDataTrustContext;
}) {
  const statusLabel = context.fallbackActive
    ? "Fallback ativo"
    : context.sourceMode === "hybrid"
      ? "Leitura hibrida"
      : context.sourceMode === "empty"
        ? "Sem sinal"
        : "Curadoria direta";

  const statusClass = context.fallbackActive
    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
    : context.sourceMode === "empty"
      ? "border-border bg-background text-muted-foreground"
      : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";

  return (
    <section className="flex flex-col gap-4 rounded-none">
      <div className="flex flex-col gap-3 laptop:flex-row laptop:items-start laptop:justify-between">
        <div className="max-w-3xl">
          <ChartTitle title="Radar Contexto & Confianca" icon={ShieldCheck} />
          <p className="mt-1 text-sm text-muted-foreground">
            {context.sourceModeDescription}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={[
              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
              statusClass,
            ].join(" ")}
          >
            {statusLabel}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {context.updatedAtLabel}
          </div>
        </div>
      </div>

      <div className="grid gap-3 laptop:grid-cols-[1.4fr_1fr_1fr]">
        <div className="rounded-3xl border border-border bg-muted/10 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Leitura editorial
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {context.marketHighlight}
          </p>

          <div className="mt-4 grid gap-3 tablet:grid-cols-4">
            <MiniStat label="Mercado" value={context.countryLabel} />
            <MiniStat label="Genero" value={context.genreLabel} />
            <MiniStat
              label="Amostra"
              value={`${context.sampleSize} tracks`}
            />
            <MiniStat
              label="Historico"
              value={`${context.historyDaysTracked} dias`}
            />
          </div>
        </div>

        <SourceStat
          icon={<Radio className="h-3.5 w-3.5" />}
          label="Featured"
          value={`${context.featuredPlaylistCount}`}
          caption={`${context.featuredOnlyCount} faixas exclusivas`}
        />

        <div className="grid gap-3">
          <SourceStat
            icon={<Search className="h-3.5 w-3.5" />}
            label="Buscas"
            value={`${context.queryCount}`}
            caption={`${context.searchOnlyCount} faixas search only`}
          />
          <SourceStat
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Hibrido"
            value={`${context.hybridCount}`}
            caption={`${context.activeSourceCount} fontes ativas no radar`}
          />
        </div>
      </div>

      <div className="grid gap-3 tablet:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/80 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Faixa lider agora
          </div>
          <div className="mt-2 truncate text-base font-medium">
            {context.topTrackName}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/80 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Share de explicit
          </div>
          <div className="mt-2 text-base font-medium">{context.explicitShare}</div>
        </div>

        <div className="rounded-2xl border border-border bg-background/80 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {context.fallbackActive ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Confianca do radar
          </div>
          <div className="text-sm text-muted-foreground">
            {context.sourceModeLabel} com {context.activeSourceCount} fontes
            validas neste recorte.
          </div>
        </div>
      </div>
    </section>
  );
}
