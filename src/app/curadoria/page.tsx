import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import CurationTable from "@/components/workspace/curation-table";
import HeroInsightPanel from "@/components/workspace/hero-insight";
import MetricGrid from "@/components/workspace/metric-grid";
import SpotifyAccountPlaylistsPanel from "@/components/workspace/spotify-account-playlists-panel";
import StatusBadge from "@/components/workspace/status-badge";
import { getCurationPageData } from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function CuradoriaPage() {
  const data = await getCurationPageData();
  const observeQueue = data.rows.filter(
    (track) => track.recommendedAction === "observe",
  ).slice(0, 4);

  return (
    <div>
      <TopNav title="Curadoria" />
      <PageIntro
        eyebrow="Mesa de decisao"
        title="Curadoria"
        description="Espaco preparado para conectar a conta Spotify, puxar playlists da conta e transformar o Radar Music em decisoes editoriais acionaveis."
      />

      <HeroInsightPanel insight={data.heroInsight} />
      <MetricGrid metrics={data.metrics} />
      <SpotifyAccountPlaylistsPanel />

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 laptop:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Sugestoes do radar
            </div>
            <h2 className="mt-2 text-2xl font-semibold">
              Faixas para avaliar antes de atualizar playlists
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Esta fila usa o Radar Music como entrada e fica pronta para cruzar
              com a playlist escolhida quando a conexao Spotify estiver ativa.
            </p>
          </div>
          <div className="space-y-3">
            {observeQueue.length > 0 ? (
              observeQueue.map((track) => (
                <div
                  key={track.trackId}
                  className="rounded-xl border border-border bg-card/70 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{track.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {track.artists}
                      </div>
                    </div>
                    <StatusBadge tone="yellow">{track.fitLabel}</StatusBadge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-border bg-card/70 px-4 py-6 text-sm text-muted-foreground">
                O Radar Music ainda nao trouxe uma sugestao pronta para esta fila.
              </div>
            )}
          </div>
        </div>
      </Container>

      <CurationTable rows={data.rows} />
    </div>
  );
}
