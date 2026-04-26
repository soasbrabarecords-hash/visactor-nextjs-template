import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import HeroInsightPanel from "@/components/workspace/hero-insight";
import MetricGrid from "@/components/workspace/metric-grid";
import RadarPlaylistsTable from "@/components/workspace/radar-playlists-table";
import { getRadarPlaylistsPageData } from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function RadarPlaylistsPage() {
  const data = await getRadarPlaylistsPageData();

  return (
    <div>
      <TopNav title="Radar Playlists" />
      <PageIntro
        eyebrow={data.hero.eyebrow}
        title={data.hero.title}
        description={data.hero.description}
      />

      <HeroInsightPanel insight={data.heroInsight} />
      <MetricGrid metrics={data.metrics} />

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 laptop:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Insight principal
            </div>
            <h2 className="mt-3 text-3xl font-semibold">
              O que as suas playlists estao repetindo agora
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              A leitura aqui e interna: faixas que dominam a sua base, quais
              aparecem em varias playlists e onde existe shared momentum com o radar externo.
            </p>
          </article>

          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Shared momentum
            </div>
            <div className="mt-4 space-y-3">
              {data.sharedMomentum.slice(0, 4).map((track) => (
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
                    <StatusBadge tone="green">Shared momentum</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </Container>

      <RadarPlaylistsTable
        rows={data.rows}
        title="Radar da base"
        description="Tabela operacional para cruzar repeticao, popularidade e presenca nas playlists monitoradas."
      />

      <RadarPlaylistsTable
        rows={data.sharedMomentum}
        title="Shared momentum"
        description="Faixas que ja vivem na sua base e tambem estao ganhando tracao no Radar Music."
      />
    </div>
  );
}
