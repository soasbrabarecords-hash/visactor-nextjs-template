import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import HeroInsightPanel from "@/components/workspace/hero-insight";
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

      <HeroInsightPanel insight={dashboard.heroInsight} />
      <MetricGrid metrics={dashboard.metrics} />
      <PrimaryActionCard action={dashboard.primaryAction} />
      <RecommendedActions actions={dashboard.recommendedActions} />

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 desktop:grid-cols-3">
          <article className="rounded-3xl border border-border bg-card/70 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Musicas em alta
            </div>
            <div className="mt-4 space-y-3">
              {dashboard.addNow.length > 0 ? (
                dashboard.addNow.map((track) => (
                  <div
                    key={track.trackId}
                    className="rounded-2xl border border-border bg-background/40 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{track.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {track.artists}
                        </div>
                      </div>
                      <StatusBadge tone="green">{track.chartDeltaLabel}</StatusBadge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                  Nenhuma musica em alta com prioridade clara agora.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-card/70 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Oportunidades
            </div>
            <div className="mt-4 space-y-3">
              {dashboard.observe.length > 0 ? (
                dashboard.observe.map((track) => (
                  <div
                    key={track.trackId}
                    className="rounded-2xl border border-border bg-background/40 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{track.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {track.fitLabel}
                        </div>
                      </div>
                      <StatusBadge tone="yellow">{track.decisionScore}</StatusBadge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                  Nenhuma oportunidade em observacao forte no momento.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-card/70 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Playlists que pedem atencao
            </div>
            <div className="mt-4 space-y-3">
              {playlistsNeedingAttention.length > 0 ? (
                playlistsNeedingAttention.map((playlist) => (
                  <div
                    key={playlist.playlist.id}
                    className="rounded-2xl border border-border bg-background/40 px-4 py-3"
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
                <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                  Nenhuma playlist com alerta forte de manutencao agora.
                </div>
              )}
            </div>
          </article>
        </div>
      </Container>
    </main>
  );
}
