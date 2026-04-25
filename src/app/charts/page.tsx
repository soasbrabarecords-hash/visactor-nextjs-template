import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  Conversions,
  CustomerSatisfication,
  Metrics,
  TicketByChannels,
} from "@/components/chart-blocks";
import Container from "@/components/container";
import FeaturedPlaylistsStrip from "@/components/charts/featured-playlists-strip";
import InsightPanel from "@/components/charts/insight-panel";
import TracksTable from "@/components/charts/tracks-table";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import { getChartsData } from "@/lib/charts-data";

export const dynamic = "force-dynamic";

export default async function ChartsPage() {
  const chartsData = await getChartsData();

  return (
    <div>
      <TopNav title="Charts Playlists" />
      <PageIntro
        eyebrow="Radar Interno"
        title="Charts Playlists"
        description="Cruza as playlists monitoradas com sinais editoriais do Spotify para mostrar repeticao, lideranca por artista e momentum entre as suas curadorias."
        action={
          <>
            <Button asChild>
              <Link href="/charts/music">Abrir Charts Music</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/playlists-monitoradas">
                Ver Playlists Monitoradas
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />
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
            marketHighlight={chartsData.marketHighlight}
            sharedMomentumCount={chartsData.sharedMomentumCount}
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

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-3 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-1">
          <FeaturedPlaylistsStrip
            playlists={chartsData.featuredPlaylists}
            title="Mercado Externo"
            description="Playlists destaque do Spotify que ajudam a validar se o seu radar interno esta alinhado com o momento."
          />
        </Container>

        <Container className="py-4 laptop:col-span-2">
          <TracksTable
            tracks={chartsData.marketTracks}
            title="Mercado em Movimento"
            description="Top faixas que estao aparecendo agora nas playlists em destaque do Spotify Brasil, mesmo sem estarem nas suas playlists monitoradas."
            emptyMessage="Sem sinal de mercado no momento."
          />
        </Container>
      </div>

      <div className="border-b border-border">
        <TracksTable
          tracks={chartsData.tracks}
          title="Radar das Playlists Monitoradas"
          description="Faixas que mais aparecem dentro da sua base monitorada, ranqueadas por repeticao e popularidade."
        />
      </div>
    </div>
  );
}
