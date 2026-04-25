import {
  AverageTicketsCreated,
  Conversions,
  CustomerSatisfication,
  Metrics,
  TicketByChannels,
} from "@/components/chart-blocks";
import Container from "@/components/container";
import PlaylistTable from "@/components/dashboard/playlist-table";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function Home() {
  const dashboardData = await getDashboardData();

  return (
    <div>
      <Metrics metrics={dashboardData.metrics} />

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-3 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-2">
          <AverageTicketsCreated data={dashboardData.playlistActivity} />
        </Container>

        <Container className="py-4 laptop:col-span-1">
          <Conversions data={dashboardData.topFollowers} />
        </Container>
      </div>

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-2 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-1">
          <TicketByChannels data={dashboardData.scoreDistribution} />
        </Container>

        <Container className="py-4 laptop:col-span-1">
          <CustomerSatisfication
            customerSatisfication={dashboardData.scoreHealth}
            totalCustomers={dashboardData.playlistCount}
          />
        </Container>
      </div>

      <div className="border-b border-border">
        <PlaylistTable playlists={dashboardData.playlists} />
      </div>
    </div>
  );
}
