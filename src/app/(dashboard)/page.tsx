import PageIntro from "@/components/page-intro";
import DecisionTrackList from "@/components/workspace/decision-track-list";
import MetricGrid from "@/components/workspace/metric-grid";
import RecommendedActions from "@/components/workspace/recommended-actions";
import { getDashboardWorkspaceData } from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dashboard = await getDashboardWorkspaceData();

  return (
    <main>
      <PageIntro
        eyebrow={dashboard.hero.eyebrow}
        title={dashboard.hero.title}
        description={dashboard.hero.description}
      />

      <MetricGrid metrics={dashboard.metrics} />
      <RecommendedActions actions={dashboard.recommendedActions} />
      <DecisionTrackList
        title="Adicionar agora"
        description="Faixas com melhor combinacao entre movimento, baixa saturacao e prontidao editorial."
        tracks={dashboard.addNow}
        tone="green"
      />
      <DecisionTrackList
        title="Observar"
        description="Sinais que merecem acompanhamento antes de uma entrada definitiva na base."
        tracks={dashboard.observe}
        tone="yellow"
      />
      <DecisionTrackList
        title="Remover ou testar"
        description="Faixas que pedem ajuste de repertorio ou teste controlado nas playlists monitoradas."
        tracks={dashboard.removeOrTest}
        tone="red"
      />
    </main>
  );
}
