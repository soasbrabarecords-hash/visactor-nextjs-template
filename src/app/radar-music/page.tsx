import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import RadarMusicActionBoard from "@/components/workspace/radar-music-action-board";
import RadarMusicGenreRail from "@/components/workspace/radar-music-genre-rail";
import RadarMusicHighlightGrid from "@/components/workspace/radar-music-highlight-grid";
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_18%),linear-gradient(180deg,#040816_0%,#030712_100%)]">
      <TopNav title="Radar Music" />

      <RadarMusicActionBoard queues={data.decisionQueues} />

      <RadarMusicTikTokStrip
        snapshotDate={data.tiktokMatches.snapshotDate}
        tracks={data.tiktokMatches.tracks}
      />

      <Container className="border-b border-border/70 py-5">
        <div className="grid gap-4 laptop:grid-cols-[1fr_0.95fr]">
          <article className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_48px_-34px_rgba(8,15,28,0.9)]">
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
            <div className="mt-3 text-xs uppercase tracking-[0.16em] text-white/45">
              Atualizado em {data.support.updatedAtLabel}
            </div>
          </article>

          <RadarMusicGenreRail items={data.genreSpotlights} />
        </div>
      </Container>

      <RadarMusicHighlightGrid highlights={data.summaryCards} />

      <RadarMusicTable rows={data.rows} decisionTracks={data.decisionRows} />
    </div>
  );
}
