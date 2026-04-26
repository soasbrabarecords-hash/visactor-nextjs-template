import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import CurationTable from "@/components/workspace/curation-table";
import HeroInsightPanel from "@/components/workspace/hero-insight";
import MetricGrid from "@/components/workspace/metric-grid";
import { getCurationPageData } from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function CuradoriaPage() {
  const data = await getCurationPageData();
  const shortlist = data.rows.slice(0, 4);

  return (
    <div>
      <TopNav title="Curadoria" />
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
              Curadoria final com score de decisao
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Aqui o trabalho fica pragmatico: decidir o que entra, o que
              espera, o que sai e o que merece teste em playlists diferentes.
            </p>
          </article>

          <article className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Shortlist atual
            </div>
            <div className="mt-4 space-y-3">
              {shortlist.map((track) => (
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
                    <StatusBadge tone={track.movement.tone}>
                      {track.decisionScore}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </Container>

      <CurationTable rows={data.rows} />
    </div>
  );
}
