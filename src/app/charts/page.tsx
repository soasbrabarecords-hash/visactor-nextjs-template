import {
  Conversions,
  CustomerSatisfication,
  Metrics,
  TicketByChannels,
} from "@/components/chart-blocks";
import Container from "@/components/container";
import InsightPanel from "@/components/charts/insight-panel";
import TracksTable from "@/components/charts/tracks-table";
import { getChartsData } from "@/lib/charts-data";

export const dynamic = "force-dynamic";

export default async function ChartsPage() {
  const chartsData = await getChartsData();

  return (
    <div>
      <Metrics metrics={chartsData.metrics} />

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-3 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-2">
          <Conversions
            data={chartsData.topTracks}
            title="Top Tracks"
            indicatorLabel="Popularidade somada"
          />
        </Container>

        <Container className="py-4 laptop:col-span-1">
          <InsightPanel
            analyzedPlaylists={chartsData.analyzedPlaylists}
            topRepeatedTrack={chartsData.topRepeatedTrack}
            explicitShare={chartsData.explicitShare}
          />
        </Container>
      </div>

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-2 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-1">
          <TicketByChannels
            data={chartsData.artistDistribution}
            title="Artist Share"
            centerLabel="Top artistas"
          />
        </Container>

        <Container className="py-4 laptop:col-span-1">
          <CustomerSatisfication
            customerSatisfication={chartsData.popularityHealth}
            totalCustomers={chartsData.tracks.length}
            title="Popularity Health"
            totalLabel="Faixas analisadas"
            totalSuffix="tracks"
            labels={{
              positive: "Alta popularidade",
              neutral: "Media popularidade",
              negative: "Baixa popularidade",
            }}
          />
        </Container>
      </div>

      <div className="border-b border-border">
        <TracksTable tracks={chartsData.tracks} />
      </div>
    </div>
  );
}
