import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  AverageTicketsCreated,
  Conversions,
  CustomerSatisfication,
  Metrics,
  TicketByChannels,
} from "@/components/chart-blocks";
import Container from "@/components/container";
import AddPlaylistForm from "@/components/dashboard/add-playlist-form";
import PlaylistTable from "@/components/dashboard/playlist-table";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function MonitoredPlaylistsPage() {
  const dashboardData = await getDashboardData();

  return (
    <div>
      <TopNav title="Playlists Monitoradas" />
      <PageIntro
        eyebrow="Workspace de Curadoria"
        title="Playlists Monitoradas"
        description="Central dedicada para acompanhar a base de playlists, adicionar novas URLs, validar score e abrir analises detalhadas de cada oportunidade."
        action={
          <>
            <Button asChild>
              <Link href="/charts">Charts Playlists</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/charts/music">
                Charts Music
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <Metrics metrics={dashboardData.metrics} />
      <AddPlaylistForm />

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-3 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-2">
          <AverageTicketsCreated data={dashboardData.playlistActivity} />
        </Container>

        <Container className="py-4 laptop:col-span-1">
          <Conversions
            data={dashboardData.topFollowers}
            title="Lideres por Followers"
            indicatorLabel="Followers"
          />
        </Container>
      </div>

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-2 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-1">
          <TicketByChannels
            data={dashboardData.scoreDistribution}
            title="Distribuicao de Score"
            centerLabel="Playlists ativas"
          />
        </Container>

        <Container className="py-4 laptop:col-span-1">
          <CustomerSatisfication
            customerSatisfication={dashboardData.scoreHealth}
            totalCustomers={dashboardData.playlistCount}
            title="Saude da Base"
            totalLabel="Playlists monitoradas"
            totalSuffix="playlists"
            labels={{
              positive: "Score alto",
              neutral: "Score medio",
              negative: "Score baixo",
            }}
          />
        </Container>
      </div>

      <div className="border-b border-border">
        <PlaylistTable
          playlists={dashboardData.playlists}
          title="Central de Playlists Monitoradas"
          description="Abra a analise de cada playlist, acompanhe crescimento e tome decisoes de curadoria com base em score, followers e faixas."
          emptyMessage="Nenhuma playlist monitorada foi encontrada ainda."
        />
      </div>
    </div>
  );
}
