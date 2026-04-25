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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/10 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-lg font-medium">{value}</div>
    </div>
  );
}

export default function MusicInsightPanel({
  context,
}: {
  context: MusicDataTrustContext;
}) {
  return (
    <section className="flex h-full flex-col gap-4">
      <ChartTitle title="Data Trust & Context" icon={ShieldCheck} />

      <div className="rounded-3xl border border-border bg-muted/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Modo de leitura
            </div>
            <div className="mt-2 text-2xl font-medium">
              {context.sourceModeLabel}
            </div>
          </div>

          <div
            className={[
              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
              context.fallbackActive
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                : context.sourceMode === "empty"
                  ? "border-border bg-background text-muted-foreground"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
            ].join(" ")}
          >
            {context.fallbackActive
              ? "Fallback ativo"
              : context.sourceMode === "hybrid"
                ? "Leitura hibrida"
                : context.sourceMode === "empty"
                  ? "Sem sinal"
                  : "Curadoria direta"}
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {context.sourceModeDescription}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {context.activeSourceCount} fontes entraram na leitura atual do radar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Mercado" value={context.countryLabel} />
        <StatCard label="Genero" value={context.genreLabel} />
        <StatCard label="Atualizado" value={context.updatedAtLabel} />
        <StatCard
          label="Amostra"
          value={`${context.sampleSize} tracks`}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-background/80 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Radio className="h-3.5 w-3.5" />
            Featured
          </div>
          <div className="text-2xl font-medium">
            {context.featuredPlaylistCount}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {context.featuredOnlyCount} faixas exclusivas
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/80 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            Buscas
          </div>
          <div className="text-2xl font-medium">{context.queryCount}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {context.searchOnlyCount} faixas search only
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/80 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Hibrido
          </div>
          <div className="text-2xl font-medium">{context.hybridCount}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            cruzam as duas leituras
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-muted/10 p-4">
        <div className="grid gap-4 laptop:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Faixa lider agora
            </div>
            <div className="mt-2 text-lg font-medium">
              {context.topTrackName}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Share de explicit
            </div>
            <div className="mt-2 text-lg font-medium">
              {context.explicitShare}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background/80 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {context.fallbackActive ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <Clock3 className="h-3.5 w-3.5" />
            )}
            Leitura editorial
          </div>
          <p className="text-sm text-muted-foreground">
            {context.marketHighlight}
          </p>
        </div>
      </div>
    </section>
  );
}
