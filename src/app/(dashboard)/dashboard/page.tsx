import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import MetricGrid from "@/components/workspace/metric-grid";
import PrimaryActionCard from "@/components/workspace/primary-action-card";
import RecommendedActions from "@/components/workspace/recommended-actions";
import StatusBadge from "@/components/workspace/status-badge";
import {
  getBasePlaylistsPageData,
  getDashboardWorkspaceData,
} from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [dashboard, playlistsBase] = await Promise.all([
    getDashboardWorkspaceData(),
    getBasePlaylistsPageData(),
  ]);
  const playlistsNeedingAttention = playlistsBase.rows
    .filter(
      (row) =>
        row.growthTone === "red" ||
        row.growthTone === "yellow" ||
        row.playlist.score < 60,
    )
    .slice(0, 4);

  return (
    <main>
      <PageIntro
        eyebrow={dashboard.hero.eyebrow}
        title={dashboard.hero.title}
        description={dashboard.hero.description}
      />

      <PrimaryActionCard action={dashboard.primaryAction} />
      <MetricGrid metrics={dashboard.metrics} />
      <RecommendedActions actions={dashboard.recommendedActions} />

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 laptop:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Playlists que pedem atencao
            </div>
            <h2 className="mt-2 text-2xl font-semibold">
              Base que merece revisao hoje
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              O dashboard fica como comando do dia: uma decisao principal,
              filas de acao e playlists que merecem manutencao.
            </p>
          </div>
          <div className="space-y-3">
            {playlistsNeedingAttention.length > 0 ? (
              playlistsNeedingAttention.map((playlist) => (
                <div
                  key={playlist.playlist.id}
                  className="rounded-xl border border-border bg-card/70 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{playlist.playlist.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Score {playlist.playlist.score} · {playlist.tracksLabel} tracks
                      </div>
                    </div>
                    <StatusBadge tone={playlist.growthTone}>
                      {playlist.growthLabel}
                    </StatusBadge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-border bg-card/70 px-4 py-6 text-sm text-muted-foreground">
                Nenhuma playlist com alerta forte de manutencao agora.
              </div>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
