import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import CurationTable from "@/components/workspace/curation-table";
import HeroInsightPanel from "@/components/workspace/hero-insight";
import MetricGrid from "@/components/workspace/metric-grid";
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

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 laptop:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Spotify na curadoria
            </div>
            <h2 className="mt-3 text-3xl font-semibold">
              Login Spotify para puxar playlists da conta
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Esta area vai receber a conexao com Spotify para listar as playlists
              da conta, comparar com o Radar Music e sugerir atualizacoes direto da mesa editorial.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button disabled>Conectar Spotify</Button>
              <StatusBadge tone="blue">Em breve</StatusBadge>
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Sugestoes do radar
            </div>
            <div className="mt-4 space-y-3">
              {observeQueue.length > 0 ? (
                observeQueue.map((track) => (
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
                      <StatusBadge tone="yellow">
                        {track.fitLabel}
                      </StatusBadge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                  O Radar Music ainda nao trouxe uma sugestao pronta para esta fila.
                </div>
              )}
            </div>
          </article>
        </div>
      </Container>

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 desktop:grid-cols-3">
          <article className="rounded-2xl border border-border bg-card/70 p-5">
            <div className="text-lg font-semibold">Playlists da conta</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Lista das playlists do Spotify conectadas para selecionar quais entram no fluxo de curadoria.
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card/70 p-5">
            <div className="text-lg font-semibold">Sugestoes do Radar</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Faixas e oportunidades do Radar Music preparadas para atualizacao editorial.
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card/70 p-5">
            <div className="text-lg font-semibold">Fila de decisao</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Onde a equipe decide o que adicionar, observar, ignorar ou remover antes de atualizar playlists.
            </p>
          </article>
        </div>
      </Container>

      <CurationTable rows={data.rows} />
    </div>
  );
}
