import Container from "@/components/container";
import MusicFilters from "@/components/charts/music-filters";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import RadarMusicEditorialHero from "@/components/workspace/radar-music-editorial-hero";
import RadarMusicGenreRail from "@/components/workspace/radar-music-genre-rail";
import RadarMusicHighlightGrid from "@/components/workspace/radar-music-highlight-grid";
import RadarMusicRefreshButton from "@/components/workspace/radar-music-refresh-button";
import RadarMusicTable from "@/components/workspace/radar-music-table";
import StatusBadge from "@/components/workspace/status-badge";
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
          <>
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
            <RadarMusicRefreshButton
              country={data.filters.selectedCountry}
              genre={data.filters.selectedGenre}
            />
          </>
        }
      />

      <RadarMusicEditorialHero hero={data.editorialHero} />
      <RadarMusicGenreRail items={data.genreSpotlights} />
      <RadarMusicHighlightGrid highlights={data.summaryCards} />

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 laptop:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Insight principal
            </div>
            <h2 className="mt-3 text-3xl font-semibold">
              Ranking com leitura visual de chart
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              O topo da pagina ficou editorial e colorido para discovery rapido. Abaixo, a tabela segura a leitura analitica com rank, movimento, capa, oportunidade e score.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge tone="purple">{data.filters.selectedGenreLabel}</StatusBadge>
              <StatusBadge tone="blue">{data.filters.selectedCountryLabel}</StatusBadge>
              <StatusBadge tone="green">{data.editorialHero.periodLabel}</StatusBadge>
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Confianca do dado
            </div>
            <div className="mt-4 grid gap-3">
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="blue">{data.support.sourceModeLabel}</StatusBadge>
                <StatusBadge tone="yellow">
                  {data.support.historyDaysTracked} dias de historico
                </StatusBadge>
                <StatusBadge tone="green">
                  {data.support.sampleSize} tracks lidas
                </StatusBadge>
              </div>
              <p className="text-sm text-muted-foreground">
                {data.support.sourceModeDescription}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.support.marketHighlight}
              </p>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Atualizado em {data.support.updatedAtLabel}
              </p>
            </div>
          </article>
        </div>
      </Container>

      <RadarMusicTable rows={data.rows} selectedGenreLabel={data.filters.selectedGenreLabel} />
    </div>
  );
}
