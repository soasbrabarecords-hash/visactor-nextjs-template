import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Disc3,
  Eye,
  Flame,
  Gauge,
  Globe2,
  Play,
  RadioTower,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import Container from "@/components/container";
import { MusicIntelligenceTrackCard } from "@/components/workspace/music-intelligence-track-card";
import SpotifyPlaylistAddButton from "@/components/workspace/spotify-playlist-add-button";
import type {
  MusicIntelligenceResponse,
  MusicIntelligenceTrack,
} from "@/types/music-intelligence";

type MusicIntelligenceDashboardProps = {
  data: MusicIntelligenceResponse;
};

const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR");
const SHORT_MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

function formatDate(date: string | null) {
  if (!date) {
    return "Aguardando base";
  }

  const [year, month, day] = date.split("-");
  return `${day} ${SHORT_MONTHS[Number(month) - 1] ?? month} ${year}`;
}

function heroMovement(track: MusicIntelligenceTrack) {
  const market = track.primaryCountry === "GLOBAL" ? "Global" : "BR";

  if (track.isNewEntry) {
    return `Nova entrada no ${market}`;
  }

  if (track.movement7d === null || track.movement7d === 0) {
    return `Estável no ${market} em 7 dias`;
  }

  return track.movement7d > 0
    ? `Subiu ${track.movement7d} no ${market} em 7 dias`
    : `Caiu ${Math.abs(track.movement7d)} no ${market} em 7 dias`;
}

function positionLabel(track: MusicIntelligenceTrack) {
  const positions = (["BR", "GLOBAL"] as const).flatMap((country) => {
    const position = track.positions[country];
    if (!position) {
      return [];
    }

    return [`${country === "GLOBAL" ? "Global" : "BR"} #${position}`];
  });

  return positions.length > 0
    ? positions.join(" · ")
    : `${track.primaryCountry === "GLOBAL" ? "Global" : "BR"} #${track.currentPosition}`;
}

function scoreTone(score: number, inverse = false) {
  if (inverse) {
    if (score >= 65) {
      return "bg-rose-400";
    }
    if (score >= 40) {
      return "bg-amber-400";
    }
    return "bg-emerald-400";
  }

  if (score >= 70) {
    return "bg-emerald-400";
  }
  if (score >= 45) {
    return "bg-sky-400";
  }
  return "bg-amber-400";
}

export function MusicIntelligenceDashboard({
  data,
}: MusicIntelligenceDashboardProps) {
  const hero = data.markets.BR.nextBestOpportunity;
  const baseIsReady = data.summary.status === "ready";
  const scoreRows = hero
    ? [
        { label: "Força", value: hero.scores.heatScore },
        { label: "Momentum", value: hero.scores.momentumScore },
        { label: "Frescor", value: hero.scores.freshnessScore },
        { label: "Estabilidade", value: hero.scores.stabilityScore },
        { label: "Crossover", value: hero.scores.crossoverScore },
        {
          label: "Risco de ciclo",
          value: hero.scores.saturationRisk,
          inverse: true,
        },
      ]
    : [];
  const heroCoverStyle = hero?.coverUrl
    ? {
        backgroundImage: `linear-gradient(145deg, rgba(5,8,14,0.08), rgba(5,8,14,0.45)), url(${hero.coverUrl})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : undefined;
  const queues = [
    {
      key: "br",
      title: "Radar Brasil",
      description: "O que está ganhando força no Top 200 BR.",
      items: [...data.markets.BR.addNow, ...data.markets.BR.watch].slice(0, 6),
      accent: "emerald" as const,
      icon: Flame,
      empty: "Nenhuma oportunidade brasileira atingiu o gate agora.",
    },
    {
      key: "global",
      title: "Radar Global",
      description: "Tendências internacionais calculadas separadamente.",
      items: [
        ...data.markets.GLOBAL.addNow,
        ...data.markets.GLOBAL.watch,
      ].slice(0, 6),
      accent: "sky" as const,
      icon: Globe2,
      empty: "Nenhuma oportunidade global atingiu o gate agora.",
    },
    {
      key: "review",
      title: "Revisar / evitar",
      description: "Perda de tração ou risco de ciclo alto.",
      items: data.review,
      accent: "rose" as const,
      icon: TrendingDown,
      empty: "Nenhuma faixa pede revisão imediata.",
    },
    {
      key: "crossover",
      title: "Crossover BR + Global",
      description: "Força combinada nos dois mercados.",
      items: data.crossover,
      accent: "amber" as const,
      icon: Eye,
      empty: "Nenhum crossover forte na data mais recente.",
    },
  ];

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-[#08090c]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(circle_at_12%_0%,rgba(37,99,235,0.15),transparent_38%),radial-gradient(circle_at_84%_8%,rgba(16,185,129,0.09),transparent_34%),radial-gradient(circle_at_54%_28%,rgba(124,58,237,0.06),transparent_32%)]" />

      <Container className="relative py-6 tablet:py-8">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col justify-between gap-5 pb-6 text-white lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.17em] text-sky-300/75">
                <Sparkles className="h-3.5 w-3.5" />
                Music Intelligence v1
              </div>
              <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.048em] tablet:text-[2.8rem] tablet:leading-[1.06]">
                Oportunidade musical, explicada.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60 tablet:text-[15px]">
                Oportunidades do Brasil e do Global calculadas em filas
                separadas, com crossover apenas como sinal adicional.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/radar-music"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.05] px-4 text-sm font-medium text-white/65 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/10 hover:text-white"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Abrir Radar Music
              </Link>
              <Link
                href="/curadoria"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_12px_36px_-14px_rgba(37,99,235,0.9)] transition hover:brightness-110"
              >
                Abrir curadoria
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </header>

          <div className="space-y-4">
            <section className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.035] shadow-[0_26px_90px_-56px_rgba(0,0,0,0.95)] backdrop-blur-xl">
              <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${
                      baseIsReady
                        ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                        : "bg-amber-400/10 text-amber-200 ring-amber-400/20"
                    }`}
                  >
                    <RadioTower className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">
                        Radar Music Intelligence
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset ${
                          baseIsReady
                            ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                            : "bg-amber-400/10 text-amber-200 ring-amber-400/20"
                        }`}
                      >
                        {baseIsReady ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {data.summary.statusLabel}
                      </span>
                    </div>
                    <p className="mt-1 max-w-3xl text-[11px] leading-5 text-white/55">
                      {data.summary.statusDetail}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {data.summary.availableWindows.map((window) => (
                    <span
                      key={window}
                      className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset ${
                        window === data.summary.maxWindow
                          ? "bg-sky-400/10 text-sky-300 ring-sky-400/20"
                          : "bg-white/[0.04] text-white/55 ring-white/[0.07]"
                      }`}
                    >
                      {window}d
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {[
                  {
                    label: "Última leitura",
                    value: formatDate(data.summary.latestChartDate),
                    icon: CalendarDays,
                  },
                  {
                    label: "Dias BR",
                    value: NUMBER_FORMATTER.format(
                      data.summary.availableDaysBR,
                    ),
                    icon: ShieldCheck,
                  },
                  {
                    label: "Dias Global",
                    value: NUMBER_FORMATTER.format(
                      data.summary.availableDaysGlobal,
                    ),
                    icon: Globe2,
                  },
                  {
                    label: "Faixas analisadas",
                    value: NUMBER_FORMATTER.format(
                      data.summary.totalCandidates,
                    ),
                    icon: Activity,
                  },
                  {
                    label: "Novas entradas",
                    value: NUMBER_FORMATTER.format(data.summary.newEntries),
                    icon: Sparkles,
                  },
                  {
                    label: "Grandes subidas",
                    value: NUMBER_FORMATTER.format(data.summary.topRisers),
                    icon: TrendingUp,
                  },
                  {
                    label: "Quedas relevantes",
                    value: NUMBER_FORMATTER.format(data.summary.biggestDrops),
                    icon: TrendingDown,
                  },
                ].map(({ label, value, icon: Icon }, index) => (
                  <div
                    key={label}
                    className={`px-5 py-4 ${index > 0 ? "border-white/[0.07] sm:border-l" : ""}`}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.11em] text-white/55">
                      <Icon className="h-3 w-3" />
                      {label}
                    </div>
                    <div className="mt-2 truncate text-base font-semibold tracking-[-0.025em] text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[30px] border border-white/[0.09] bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(10,14,22,0.94))] p-5 shadow-[0_34px_110px_-60px_rgba(37,99,235,0.55)] tablet:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(56,189,248,0.13),transparent_30%),radial-gradient(circle_at_8%_100%,rgba(16,185,129,0.08),transparent_34%)]" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.9)]" />
                  Melhor oportunidade no Brasil
                </div>
                {hero ? (
                  <span className="rounded-full bg-white/[0.055] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55 ring-1 ring-inset ring-white/[0.08]">
                    {heroMovement(hero)}
                  </span>
                ) : null}
              </div>

              {hero ? (
                <div className="relative mt-5 grid gap-6 xl:grid-cols-[128px_minmax(0,1.3fr)_minmax(320px,0.8fr)] xl:items-center">
                  <div
                    aria-hidden="true"
                    className="flex h-32 w-32 items-center justify-center rounded-[28px] bg-white/[0.055] text-white/25 shadow-[0_22px_50px_-24px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-white/10"
                    style={heroCoverStyle}
                  >
                    {hero.coverUrl ? null : <Disc3 className="h-8 w-8" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                        {hero.actionLabel}
                      </span>
                      <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55 ring-1 ring-inset ring-white/[0.07]">
                        {positionLabel(hero)}
                      </span>
                    </div>
                    <h2 className="mt-3 truncate text-2xl font-semibold tracking-[-0.04em] text-white tablet:text-3xl">
                      {hero.name}
                    </h2>
                    <p className="mt-1 truncate text-sm text-white/60">
                      {hero.artists}
                    </p>
                    <p className="text-white/66 mt-4 max-w-2xl text-sm leading-6">
                      {hero.explanation}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <SpotifyPlaylistAddButton
                        spotifyTrackId={hero.spotifyTrackId}
                        suggestedPlaylistName={hero.suggestedPlaylistName}
                        label="Testar em playlist"
                        className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_34px_-14px_rgba(37,99,235,0.9)] hover:bg-primary/90"
                      />
                      {hero.spotifyUrl ? (
                        <Link
                          href={hero.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.055] px-4 text-sm font-medium text-white/65 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/10 hover:text-white"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          Ouvir
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/[0.08] bg-black/15 p-4">
                    <div className="flex items-end justify-between border-b border-white/[0.07] pb-3">
                      <div>
                        <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/55">
                          Opportunity score
                        </div>
                        <div className="mt-1 text-4xl font-semibold tracking-[-0.055em] text-white">
                          {hero.scores.opportunityScore}
                          <span className="ml-1 text-sm font-medium text-white/55">
                            /100
                          </span>
                        </div>
                      </div>
                      <Gauge className="h-5 w-5 text-sky-300/70" />
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {scoreRows.map((score) => (
                        <div key={score.label}>
                          <div className="flex items-center justify-between text-[10px] text-white/55">
                            <span>{score.label}</span>
                            <span className="text-white/62 tabular-nums">
                              {score.value}
                            </span>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                            <div
                              className={`h-full rounded-full ${scoreTone(score.value, score.inverse)}`}
                              style={{ width: `${score.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative mt-5 rounded-[24px] border border-dashed border-white/10 bg-white/[0.025] px-5 py-10 text-center">
                  <Disc3 className="mx-auto h-8 w-8 text-white/20" />
                  <h2 className="mt-3 text-base font-semibold text-white">
                    Aguardando uma oportunidade confiável
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/55">
                    Assim que BR e Global tiverem uma leitura comum, as decisões
                    aparecem aqui automaticamente.
                  </p>
                </div>
              )}
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              {queues.map((queue) => {
                const Icon = queue.icon;
                return (
                  <section
                    key={queue.key}
                    className="rounded-[26px] border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_24px_80px_-54px_rgba(0,0,0,0.95)] backdrop-blur-xl tablet:p-5"
                  >
                    <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/[0.055] text-white/65 ring-1 ring-inset ring-white/[0.08]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-semibold text-white">
                            {queue.title}
                          </h2>
                          <p className="mt-0.5 truncate text-[11px] text-white/55">
                            {queue.description}
                          </p>
                        </div>
                      </div>
                      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/[0.055] px-2 text-[11px] font-medium tabular-nums text-white/55 ring-1 ring-inset ring-white/[0.07]">
                        {queue.items.length}
                      </span>
                    </div>

                    {queue.items.length > 0 ? (
                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        {queue.items.map((track) => (
                          <MusicIntelligenceTrackCard
                            key={`${queue.key}-${track.id}`}
                            track={track}
                            accent={queue.accent}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs leading-5 text-white/55">
                        {queue.empty}
                      </div>
                    )}
                  </section>
                );
              })}
            </section>

            <section className="grid gap-4 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/70" />
                  Leitura explicável
                </div>
                <p className="mt-2 max-w-4xl text-xs leading-5 text-white/60">
                  Cada radar usa posição, subida, frescor e estabilidade do seu
                  próprio mercado. BR e Global não disputam mais a mesma fila; o
                  crossover aparece apenas como contexto adicional.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {data.signals.risingArtists.slice(0, 3).map((artist) => (
                  <span
                    key={artist.artist}
                    className="rounded-full bg-white/[0.045] px-3 py-1.5 text-[10px] text-white/60 ring-1 ring-inset ring-white/[0.07]"
                  >
                    {artist.artist} · {artist.averageOpportunityScore}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}
