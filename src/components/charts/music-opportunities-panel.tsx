import { Lightbulb } from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";
import Container from "@/components/container";
import type { MusicOpportunity } from "@/types/music-charts";

function OpportunityMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/80 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

export default function MusicOpportunitiesPanel({
  opportunities,
}: {
  opportunities: MusicOpportunity[];
}) {
  return (
    <Container className="py-4">
      <section className="flex flex-col gap-4">
        <div>
          <ChartTitle
            title="Oportunidades para Playlist Nova"
            icon={Lightbulb}
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Blocos executaveis para transformar o radar do mercado em novas
            frentes de curadoria, discovery e playlist building.
          </p>
        </div>

        <div className="grid gap-4 laptop:grid-cols-3">
          {opportunities.map((opportunity) => (
            <div
              key={opportunity.title}
              className="rounded-3xl border border-border bg-muted/10 p-5"
            >
              <div className="mb-3 inline-flex rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {opportunity.badge}
              </div>

              <h3 className="text-lg font-medium">{opportunity.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {opportunity.description}
              </p>
              <p className="mt-4 text-sm">{opportunity.rationale}</p>

              <div className="mt-4 grid gap-3">
                <OpportunityMeta
                  label="Angulo editorial"
                  value={opportunity.playlistAngle}
                />
                <OpportunityMeta
                  label="Potencial"
                  value={opportunity.potential}
                />
                <OpportunityMeta label="Risco" value={opportunity.risk} />
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-background/80 p-3 text-sm font-medium">
                {opportunity.callToAction}
              </div>

              <div className="mt-4 grid gap-3">
                {opportunity.seeds.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-background/80 p-3 text-sm text-muted-foreground">
                    Ainda sem seeds suficientes para este angulo.
                  </div>
                ) : (
                  opportunity.seeds.map((seed) => (
                    <a
                      key={seed.id}
                      href={seed.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="grid grid-cols-[48px_1fr] items-center gap-3 rounded-2xl border border-border bg-background/80 p-3 transition-colors hover:bg-background"
                    >
                      {seed.coverUrl ? (
                        <div
                          className="h-12 w-12 rounded-xl"
                          style={{
                            backgroundImage: `url(${seed.coverUrl})`,
                            backgroundPosition: "center",
                            backgroundSize: "cover",
                          }}
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-muted" />
                      )}

                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {seed.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {seed.artists}
                        </div>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Container>
  );
}
