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
import MusicFilters from "@/components/charts/music-filters";
import MusicInsightPanel from "@/components/charts/music-insight-panel";
import MusicOpportunitiesPanel from "@/components/charts/music-opportunities-panel";
import MusicTrackGrid from "@/components/charts/music-track-grid";
import TracksTable from "@/components/charts/tracks-table";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import {
  getMusicChartsData,
  getMusicGenreOptions,
  getMusicMarketOptions,
} from "@/lib/music-charts-data";

export const dynamic = "force-dynamic";

function getSearchParamValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export default async function ChartsMusicPage({
  searchParams,
}: {
  searchParams: Promise<{
    country?: string | string[];
    genre?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const chartsData = await getMusicChartsData({
    country: getSearchParamValue(params.country),
    genre: getSearchParamValue(params.genre),
  });

  return (
    <div>
      <TopNav title="Charts Music" />
      <PageIntro
        eyebrow="Radar Externo"
        title="Charts Music"
        description="Radar de tracks que estao bombando agora por pais e genero, usando sinais editoriais do Spotify para encontrar tendencias, oportunidades e uma lista profissional com as 200 tracks mais fortes do recorte."
        action={
          <>
            <MusicFilters
              countryOptions={getMusicMarketOptions()}
              genreOptions={getMusicGenreOptions()}
              selectedCountry={chartsData.countryValue}
              selectedGenre={chartsData.genreValue}
            />
            <Button asChild variant="outline">
              <Link href="/charts">
                Voltar para Charts Playlists
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
            title={
              chartsData.genreValue === "all"
                ? `Radar do Mercado · ${chartsData.countryLabel}`
                : `Radar ${chartsData.genreLabel}`
            }
            indicatorLabel="Popularidade somada"
          />
        </Container>

        <Container className="py-4 laptop:col-span-1">
          <MusicInsightPanel
            countryLabel={chartsData.countryLabel}
            genreLabel={chartsData.genreLabel}
            topTrackName={chartsData.topTrackName}
            explicitShare={chartsData.explicitShare}
            marketHighlight={chartsData.marketHighlight}
            sourcePlaylistsCount={chartsData.sourcePlaylistsCount}
          />
        </Container>
      </div>

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-2 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-1">
          <TicketByChannels
            data={chartsData.artistDistribution}
            title="Artistas em Alta"
            centerLabel="Top artistas"
          />
        </Container>

        <Container className="py-4 laptop:col-span-1">
          <CustomerSatisfication
            customerSatisfication={chartsData.popularityHealth}
            totalCustomers={chartsData.tracks.length}
            title="Saude do Radar"
            totalLabel="Faixas monitoradas"
            totalSuffix="tracks"
            labels={{
              positive: "Alta tracao",
              neutral: "Media tracao",
              negative: "Baixa tracao",
            }}
          />
        </Container>
      </div>

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-2 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <MusicTrackGrid
          title="Top Movers"
          description="Faixas com maior momentum no radar, combinando popularidade e recorrencia nas playlists fonte."
          tracks={chartsData.topMovers}
          emptyMessage="Ainda sem movers fortes para esse mercado."
        />

        <MusicTrackGrid
          title="Novas Entradas"
          description="Sinais frescos com baixa saturacao e potencial de crescimento rapido para descoberta."
          tracks={chartsData.newEntries}
          emptyMessage="Ainda sem novas entradas fortes neste recorte."
        />
      </div>

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-3 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-1">
          <FeaturedPlaylistsStrip
            playlists={chartsData.featuredPlaylists}
            title={`Playlists em Alta · ${chartsData.countryLabel}`}
            description="Leitura das playlists em destaque do Spotify que ajudam a entender o recorte editorial desse mercado agora."
            emptyMessage="O Spotify nao retornou playlists destaque para esse mercado agora."
          />
        </Container>

        <Container className="py-4 laptop:col-span-2">
          <TracksTable
            tracks={chartsData.recurringTracks}
            title="Faixas Recorrentes por Mercado"
            description={`Faixas que se repetem nas playlists fonte de ${chartsData.countryLabel} e ajudam a validar o repertorio que realmente esta dominando o momento.`}
            emptyMessage="Ainda nao encontramos recorrencia suficiente neste mercado."
            countLabel="Mercado"
          />
        </Container>
      </div>

      <div className="border-b border-border">
        <MusicOpportunitiesPanel opportunities={chartsData.opportunities} />
      </div>

      <div className="border-b border-border">
        <TracksTable
          tracks={chartsData.tracks}
          title="Top 200 Tracks do Radar"
          description={`Leitura completa das 200 faixas mais fortes em ${chartsData.countryLabel}${chartsData.genreValue !== "all" ? ` dentro do recorte ${chartsData.genreLabel}` : ""}, para pesquisa e validacao editorial.`}
          emptyMessage="Sem sinal suficiente para esse filtro neste momento."
          countLabel="Sinal"
        />
      </div>
    </div>
  );
}
