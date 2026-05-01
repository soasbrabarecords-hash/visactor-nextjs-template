import Link from "next/link";
import CompetitorPlaylistsTable from "@/components/workspace/competitor-playlists-table";
import DashboardEditorialSpotlights from "@/components/workspace/dashboard-editorial-spotlights";
import DashboardTopTracksTable from "@/components/workspace/dashboard-top-tracks-table";
import DecisionTrackList from "@/components/workspace/decision-track-list";
import HeroInsightPanel from "@/components/workspace/hero-insight";
import MetricGrid from "@/components/workspace/metric-grid";
import PageIntro from "@/components/page-intro";
import PrimaryActionCard from "@/components/workspace/primary-action-card";
import RecommendedActions from "@/components/workspace/recommended-actions";
import SpotifyAccountPlaylistsPanel from "@/components/workspace/spotify-account-playlists-panel";
import { Button } from "@/components/ui/button";
import { getDashboardWorkspaceData } from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardWorkspaceData();

  return (
    <main>
      <PageIntro
        eyebrow={data.hero.eyebrow}
        title={data.hero.title}
        description={data.hero.description}
        action={
          <>
            {data.hero.primaryCtaLabel && data.hero.primaryCtaHref ? (
              <Button asChild>
                <Link href={data.hero.primaryCtaHref}>
                  {data.hero.primaryCtaLabel}
                </Link>
              </Button>
            ) : null}
            {data.hero.secondaryCtaLabel && data.hero.secondaryCtaHref ? (
              <Button asChild variant="outline">
                <Link href={data.hero.secondaryCtaHref}>
                  {data.hero.secondaryCtaLabel}
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <HeroInsightPanel insight={data.heroInsight} />
      <MetricGrid metrics={data.metrics} />
      <PrimaryActionCard action={data.primaryAction} />
      <DashboardEditorialSpotlights spotlights={data.editorialSpotlights} />
      <RecommendedActions actions={data.recommendedActions} />
      <DecisionTrackList
        title="Entrar agora"
        description="Faixas que ja bateram os sinais mais fortes de subida, fit e janela editorial para entrar na base."
        tracks={data.addNow}
        tone="green"
      />
      <DecisionTrackList
        title="Observar de perto"
        description="Musicas com leitura boa, mas que ainda precisam de mais confirmacao antes de ganhar espaco fixo."
        tracks={data.observe}
        tone="yellow"
      />
      <DecisionTrackList
        title="Testar ou limpar"
        description="Faixas que perderam tracao e merecem revisao para nao ocupar espaco nobre na playlist."
        tracks={data.removeOrTest}
        tone="red"
      />
      <DashboardTopTracksTable rows={data.topRadarRows} />
      <SpotifyAccountPlaylistsPanel />
      <CompetitorPlaylistsTable rows={data.playlistBaseRows} />
    </main>
  );
}
