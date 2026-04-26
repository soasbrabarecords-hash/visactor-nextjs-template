import Container from "@/components/container";
import MusicFilters from "@/components/charts/music-filters";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import HeroInsightPanel from "@/components/workspace/hero-insight";
import MetricGrid from "@/components/workspace/metric-grid";
import RadarMusicTable from "@/components/workspace/radar-music-table";
import { getRadarMusicPageData } from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

function getSearchParamValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export default async function RadarMusicPage({
  searchParams,
}: {
  searchParams: Promise<{
    country?: string | string[];
    genre?: string | string[];
    period?: string | string[];
    status?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const data = await getRadarMusicPageData({
    country: getSearchParamValue(params.country),
    genre: getSearchParamValue(params.genre),
    period: getSearchParamValue(params.period),
    status: getSearchParamValue(params.status),
  });

  return (
    <div>
      <TopNav title="Radar Music" />
      <PageIntro
        eyebrow={data.hero.eyebrow}
        title={data.hero.title}
        description={data.hero.description}
        action={
          <MusicFilters
            countryOptions={data.filters.countryOptions}
            genreOptions={data.filters.genreOptions}
            periodOptions={data.filters.periodOptions}
            statusOptions={data.filters.statusOptions}
            selectedCountry={data.filters.selectedCountry}
            selectedGenre={data.filters.selectedGenre}
            selectedPeriod={data.filters.selectedPeriod}
            selectedStatus={data.filters.selectedStatus}
          />
        }
      />

      <HeroInsightPanel insight={data.heroInsight} />
      <MetricGrid
        metrics={data.summaryCards.map((card) => ({
          title: card.title,
          value: card.value,
          helper: card.helper,
          tone: card.tone,
        }))}
      />

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 laptop:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Insight principal
            </div>
            <h2 className="mt-3 text-3xl font-semibold">
              Ranking com leitura real de movimento
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Aqui o foco e chart: posicao, ganho, perda, recorrencia e chance
              editorial. Tudo que nao ajuda decisao imediata ficou em segundo plano.
            </p>
          </article>

          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Confianca do dado
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge tone="blue">{data.support.sourceModeLabel}</StatusBadge>
              <StatusBadge tone="yellow">
                {data.support.historyDaysTracked} dias
              </StatusBadge>
              <StatusBadge tone="green">
                {data.support.sampleSize} tracks
              </StatusBadge>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {data.support.sourceModeDescription}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {data.support.marketHighlight}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Atualizado em {data.support.updatedAtLabel}
            </p>
          </article>
        </div>
      </Container>

      <RadarMusicTable rows={data.rows} />
    </div>
  );
}
