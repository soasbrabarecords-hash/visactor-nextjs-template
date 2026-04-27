import AddPlaylistForm from "@/components/dashboard/add-playlist-form";
import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import BasePlaylistsTable from "@/components/workspace/base-playlists-table";
import HeroInsightPanel from "@/components/workspace/hero-insight";
import MetricGrid from "@/components/workspace/metric-grid";
import PlaylistComparisonTable from "@/components/workspace/playlist-comparison-table";
import RadarPlaylistsTable from "@/components/workspace/radar-playlists-table";
import StatusBadge from "@/components/workspace/status-badge";
import {
  getBasePlaylistsPageData,
  getRadarPlaylistsPageData,
} from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function PlaylistsMonitoradasPage() {
  const [baseData, radarData] = await Promise.all([
    getBasePlaylistsPageData(),
    getRadarPlaylistsPageData(),
  ]);
  const playlistUpdateSuggestions =
    radarData.sharedMomentum.length > 0
      ? radarData.sharedMomentum.slice(0, 4)
      : radarData.rows.slice(0, 4);

  return (
    <div>
      <TopNav title="Playlists Monitoradas" />
      <PageIntro
        eyebrow="Base monitorada"
        title="Playlists Monitoradas"
        description="Centro operacional para cadastrar playlists, acompanhar a saude da base e decidir quais faixas merecem atualizacao nas playlists monitoradas."
      />

      <HeroInsightPanel insight={baseData.heroInsight} />
      <MetricGrid metrics={baseData.metrics} />
      <AddPlaylistForm />

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 laptop:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Leitura da base
            </div>
            <h2 className="mt-3 text-3xl font-semibold">
              Acompanhe a saude da base e o que merece manutencao
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Aqui voce acompanha crescimento, score, repeticao de faixas e os sinais
              que ja apontam atualizacoes concretas nas playlists monitoradas.
            </p>
          </article>

          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Sugestoes de atualizacao
            </div>
            <div className="mt-4 space-y-3">
              {playlistUpdateSuggestions.length > 0 ? (
                playlistUpdateSuggestions.map((track) => (
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
                      <StatusBadge tone={track.status.tone}>
                        {track.status.label === "Shared momentum"
                          ? "Atualizar playlist"
                          : track.status.label}
                      </StatusBadge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                  Ainda nao existe sugestao clara de atualizacao para a base.
                </div>
              )}
            </div>
          </article>
        </div>
      </Container>

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 desktop:grid-cols-3">
          {baseData.healthSummary.map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-border bg-card/70 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold">{item.label}</div>
                <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
              </div>
              <div className="mt-4 text-3xl font-semibold">{item.value}</div>
            </article>
          ))}
        </div>
      </Container>

      <BasePlaylistsTable rows={baseData.rows} />
      <PlaylistComparisonTable rows={baseData.comparisonRows} />
      <RadarPlaylistsTable
        rows={radarData.rows}
        title="Consenso entre playlists"
        description="Veja quais faixas estao se repetindo na sua base e quais ja mostram aderencia suficiente para justificar atualizacao editorial."
      />
      <RadarPlaylistsTable
        rows={radarData.sharedMomentum}
        title="Atualizacoes sugeridas"
        description="Faixas que ja vivem na sua base e tambem estao acelerando no Radar Music, prontas para puxar refresh de repertorio."
      />
    </div>
  );
}
