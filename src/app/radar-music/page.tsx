import Container from "@/components/container";
import MusicFilters from "@/components/charts/music-filters";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import RadarMusicEditorialHero from "@/components/workspace/radar-music-editorial-hero";
import RadarMusicGenreRail from "@/components/workspace/radar-music-genre-rail";
import RadarMusicHighlightGrid from "@/components/workspace/radar-music-highlight-grid";
import RadarMusicRefreshButton from "@/components/workspace/radar-music-refresh-button";
import RadarMusicTable from "@/components/workspace/radar-music-table";
import RadarMusicTikTokStrip from "@/components/workspace/radar-music-tiktok-strip";
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

      <RadarMusicEditorialHero
        hero={data.editorialHero}
        leadRow={data.rows[0] ?? null}
      />

      <RadarMusicTikTokStrip
        snapshotDate={data.tiktokMatches.snapshotDate}
        tracks={data.tiktokMatches.tracks}
      />

      <RadarMusicTable rows={data.rows} />

      <RadarMusicHighlightGrid highlights={data.summaryCards} />

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 laptop:grid-cols-[1fr_0.9fr]">
          <article className="rounded-3xl border border-border bg-card/50 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="blue">{data.support.sourceModeLabel}</StatusBadge>
              <StatusBadge tone="green">
                {data.support.sampleSize} faixas
              </StatusBadge>
              <StatusBadge tone="yellow">
                {data.support.historyDaysTracked} dias
              </StatusBadge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {data.support.marketHighlight}
            </p>
            <div className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Atualizado em {data.support.updatedAtLabel}
            </div>
          </article>

          <RadarMusicGenreRail items={data.genreSpotlights} />
        </div>
      </Container>
    </div>
  );
}
