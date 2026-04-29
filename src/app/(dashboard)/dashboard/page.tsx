import PageIntro from "@/components/page-intro";
import CompetitorPlaylistsTable from "@/components/workspace/competitor-playlists-table";
import DashboardTopTracksTable from "@/components/workspace/dashboard-top-tracks-table";
import SpotifyAccountPlaylistsPanel from "@/components/workspace/spotify-account-playlists-panel";
import {
  getBasePlaylistsPageData,
  getRadarMusicPageData,
} from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [radarMusic, competitorData] = await Promise.all([
    getRadarMusicPageData({
      country: "BR",
      genre: "all",
      period: "7d",
      status: "all",
    }),
    getBasePlaylistsPageData(),
  ]);

  return (
    <main>
      <PageIntro
        eyebrow="Centro de controle"
        title="Dashboard"
        description="Leitura rapida do que esta bombando no Brasil, suas playlists conectadas e os concorrentes que merecem acompanhamento."
      />

      <DashboardTopTracksTable rows={radarMusic.rows.slice(0, 10)} />
      <SpotifyAccountPlaylistsPanel />
      <CompetitorPlaylistsTable rows={competitorData.rows} />
    </main>
  );
}
