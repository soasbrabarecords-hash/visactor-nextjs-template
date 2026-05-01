import Link from "next/link";
import {
  BarChart3,
  Disc3,
  Play,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Container from "@/components/container";
import DashboardEditorialSpotlights from "@/components/workspace/dashboard-editorial-spotlights";
import DashboardTopTracksTable from "@/components/workspace/dashboard-top-tracks-table";
import DecisionTrackList from "@/components/workspace/decision-track-list";
import MetricGrid from "@/components/workspace/metric-grid";
import StatusBadge from "@/components/workspace/status-badge";
import { Button } from "@/components/ui/button";
import { getDashboardWorkspaceData } from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

function heroCoverStyle(coverUrl: string | null | undefined) {
  if (!coverUrl) {
    return undefined;
  }

  return {
    backgroundImage: `linear-gradient(135deg, rgba(5,7,10,0.45), rgba(5,7,10,0.9)), url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

export default async function DashboardPage() {
  const data = await getDashboardWorkspaceData();
  const heroTrack = data.primaryAction.track;

  return (
    <main>
      <Container className="border-b border-border py-6">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0f0d] text-white shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <div className="grid gap-8 p-6 laptop:grid-cols-[1.3fr_0.9fr] laptop:p-8 desktop:p-10">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone="green">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  {data.hero.eyebrow}
                </StatusBadge>
                <StatusBadge tone="purple">
                  <Disc3 className="mr-1 h-3.5 w-3.5" />
                  Dashboard editorial
                </StatusBadge>
              </div>

              <div className="max-w-3xl">
                <h1 className="text-4xl font-semibold tracking-tight laptop:text-5xl desktop:text-6xl">
                  {data.hero.title}
                </h1>
                <p className="mt-4 max-w-2xl text-base text-white/70 laptop:text-lg">
                  {data.hero.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {data.hero.primaryCtaLabel && data.hero.primaryCtaHref ? (
                  <Button
                    asChild
                    className="h-11 rounded-full bg-[#1ed760] px-5 text-sm font-semibold text-black hover:bg-[#35e26c]"
                  >
                    <Link href={data.hero.primaryCtaHref}>
                      <Play className="mr-1 h-4 w-4 fill-current" />
                      {data.hero.primaryCtaLabel}
                    </Link>
                  </Button>
                ) : null}
                {data.hero.secondaryCtaLabel && data.hero.secondaryCtaHref ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 rounded-full border-white/15 bg-white/5 px-5 text-sm text-white hover:bg-white/10"
                  >
                    <Link href={data.hero.secondaryCtaHref}>
                      <BarChart3 className="mr-1 h-4 w-4" />
                      {data.hero.secondaryCtaLabel}
                    </Link>
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-3 tablet:grid-cols-2">
                {data.heroInsight.supportingPoints.slice(0, 2).map((point, index) => (
                  <article
                    key={point}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                  >
                    <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                      {index === 0 ? "Sinal principal" : "Radar"}
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-white/90">
                      {point}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="flex">
              <article
                className="relative flex min-h-[360px] w-full flex-col justify-end overflow-hidden rounded-[28px] border border-white/10 bg-black/60 p-6"
                style={heroCoverStyle(heroTrack?.coverUrl)}
              >
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,8,0.08),rgba(7,10,8,0.78)_45%,rgba(7,10,8,0.94))]" />
                <div className="absolute right-5 top-5 flex flex-wrap justify-end gap-2">
                  <StatusBadge tone={heroTrack?.movement.tone ?? "slate"}>
                    {heroTrack?.movement.icon ?? "•"}{" "}
                    {heroTrack?.chartDeltaLabel ?? "Sem movimento"}
                  </StatusBadge>
                  <StatusBadge tone="yellow">
                    Score {heroTrack?.decisionScore ?? 0}
                  </StatusBadge>
                </div>

                <div className="relative z-10">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/55">
                    Agora no topo da mesa
                  </div>
                  <h2 className="mt-4 max-w-lg text-3xl font-semibold tracking-tight text-white">
                    {heroTrack?.name ?? data.heroInsight.headline}
                  </h2>
                  <p className="mt-2 text-base text-white/75">
                    {heroTrack?.artists ?? data.heroInsight.summary}
                  </p>

                  <div className="mt-5 grid gap-3 tablet:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Melhor leitura
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/85">
                        {data.primaryAction.reason}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#1ed760]/10 p-4">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[#9df6b8]">
                        Fit editorial
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/85">
                        {heroTrack?.accountFitContext ?? data.heroInsight.supportingPoints[0]}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      </Container>

      <MetricGrid metrics={data.metrics} />
      <DashboardEditorialSpotlights spotlights={data.editorialSpotlights} />
      <DecisionTrackList
        title="Entrar agora"
        description="Fila curta com os sinais mais fortes para agir agora."
        tracks={data.addNow}
        tone="green"
      />
      <DecisionTrackList
        title="Observar de perto"
        description="Faixas promissoras que ainda pedem mais confirmacao."
        tracks={data.observe}
        tone="yellow"
      />
      <DecisionTrackList
        title="Testar ou limpar"
        description="O que perdeu tracao e merece revisao rapida."
        tracks={data.removeOrTest}
        tone="red"
      />
      <DashboardTopTracksTable rows={data.topRadarRows} />
    </main>
  );
}
