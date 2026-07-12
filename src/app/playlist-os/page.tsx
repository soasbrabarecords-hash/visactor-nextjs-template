import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Disc3,
  Eye,
  Flame,
  Play,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import ModuleGuard from "@/components/workspace/module-guard";
import SpotifyPlaylistAddButton from "@/components/workspace/spotify-playlist-add-button";
import StatusBadge from "@/components/workspace/status-badge";
import { getDashboardWorkspaceData } from "@/lib/workspace-data";
import type {
  DashboardEditorialSpotlight,
  DecisionTrack,
  RadarMusicRow,
  StatusTone,
  WorkspaceMetric,
} from "@/types/workspace";

export const dynamic = "force-dynamic";

function coverStyle(coverUrl: string | null | undefined) {
  if (!coverUrl) {
    return undefined;
  }

  return {
    backgroundImage: `linear-gradient(135deg, rgba(6,10,8,0.18), rgba(6,10,8,0.5)), url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function metricDotClass(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    green: "bg-emerald-400",
    red: "bg-rose-400",
    blue: "bg-sky-400",
    purple: "bg-violet-400",
    yellow: "bg-amber-400",
    slate: "bg-slate-400",
  };

  return classes[tone];
}

function queueAccentClasses(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    green: "bg-emerald-400/12 text-emerald-300 ring-emerald-400/20",
    red: "bg-rose-400/12 text-rose-300 ring-rose-400/20",
    blue: "bg-sky-400/12 text-sky-300 ring-sky-400/20",
    purple: "bg-violet-400/12 text-violet-300 ring-violet-400/20",
    yellow: "bg-amber-400/12 text-amber-300 ring-amber-400/20",
    slate: "bg-white/[0.06] text-white/65 ring-white/10",
  };

  return classes[tone];
}

function spotlightGlow(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    green: "from-emerald-400/10",
    red: "from-rose-400/10",
    blue: "from-sky-400/10",
    purple: "from-violet-400/10",
    yellow: "from-amber-400/10",
    slate: "from-white/[0.06]",
  };

  return classes[tone];
}

function movementLabel(row: RadarMusicRow) {
  if (row.previousRank === null || row.rankChange === null) {
    return "NEW";
  }

  if (row.previousRank > row.rank) {
    return `+${row.previousRank - row.rank}`;
  }

  if (row.previousRank < row.rank) {
    return `-${row.rank - row.previousRank}`;
  }

  return "0";
}

function QueueColumn({
  title,
  description,
  tone,
  icon,
  tracks,
  emptyLabel,
}: {
  title: string;
  description: string;
  tone: StatusTone;
  icon: ReactNode;
  tracks: DecisionTrack[];
  emptyLabel: string;
}) {
  return (
    <section className="min-w-0 px-4 py-4 first:pl-0 last:pr-0 lg:border-l lg:border-white/[0.07] lg:first:border-l-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${queueAccentClasses(tone)}`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-white/42 truncate text-[11px]">{description}</p>
          </div>
        </div>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/[0.06] px-1.5 text-[11px] font-medium text-white/55 ring-1 ring-inset ring-white/[0.07]">
          {tracks.length}
        </span>
      </div>

      <div className="mt-3">
        {tracks.length === 0 ? (
          <div className="text-white/42 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-3 py-5 text-center text-xs leading-5">
            {emptyLabel}
          </div>
        ) : (
          tracks.slice(0, 2).map((track, index) => (
            <article
              key={`${title}-${track.trackId}`}
              className={`group py-3 ${index > 0 ? "border-t border-white/[0.07]" : ""}`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/30 ring-1 ring-inset ring-white/[0.08]"
                  style={coverStyle(track.coverUrl)}
                >
                  {track.coverUrl ? null : <Disc3 className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-white">
                    {track.name}
                  </div>
                  <div className="truncate text-[11px] text-white/45">
                    {track.artists}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <SpotifyPlaylistAddButton
                    spotifyTrackId={track.spotifyTrackId}
                    suggestedPlaylistName={track.suggestedPlaylistName}
                    compact
                    className="h-8 w-8 rounded-full border-white/[0.08] bg-white/[0.05] px-0 text-white shadow-none hover:bg-white/10"
                  />
                  <Link
                    href={track.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir ${track.name} no Spotify`}
                    className="text-white/42 inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/[0.07] hover:text-white"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
              <div className="mt-2 flex min-w-0 items-center gap-1.5 pl-[50px]">
                <StatusBadge
                  tone={track.movement.tone}
                  className="shrink-0 border-0 px-2 py-0.5 text-[9px] tracking-[0.11em]"
                >
                  {track.chartDeltaLabel}
                </StatusBadge>
                {track.suggestedPlaylistName ? (
                  <span className="text-white/42 truncate text-[10px]">
                    Melhor fit: {track.suggestedPlaylistName}
                  </span>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function MetricBar({ metrics }: { metrics: WorkspaceMetric[] }) {
  return (
    <div className="grid border-t border-white/[0.07] sm:grid-cols-2 xl:grid-cols-4">
      {metrics.slice(0, 4).map((metric, index) => (
        <article
          key={metric.title}
          className={`px-5 py-4 ${index > 0 ? "sm:border-l sm:border-white/[0.07]" : ""} ${index === 2 ? "sm:border-l-0 xl:border-l" : ""}`}
        >
          <div className="flex items-center gap-2 text-[11px] font-medium text-white/45">
            <span
              className={`h-1.5 w-1.5 rounded-full ${metricDotClass(metric.tone)}`}
            />
            {metric.title}
          </div>
          <div className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-white">
            {metric.value}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-white/40">
            {metric.helper}
          </div>
        </article>
      ))}
    </div>
  );
}

function EditorialList({
  spotlights,
}: {
  spotlights: DashboardEditorialSpotlight[];
}) {
  if (spotlights.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-white/[0.07] px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Destaques editoriais
          </h3>
          <p className="mt-0.5 text-[11px] text-white/40">
            Contexto para a próxima decisão
          </p>
        </div>
        <Sparkles className="h-4 w-4 text-white/35" />
      </div>

      <div className="space-y-2">
        {spotlights.slice(0, 2).map((spotlight) => (
          <article
            key={`${spotlight.title}-${spotlight.trackName}`}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${spotlightGlow(spotlight.tone)} to-white/[0.025] p-3.5 ring-1 ring-inset ring-white/[0.07]`}
          >
            <div className="relative flex items-start gap-3">
              <div
                className="h-11 w-11 shrink-0 rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/10"
                style={coverStyle(spotlight.coverUrl)}
              />
              <div className="min-w-0 flex-1">
                <div className="text-white/38 text-[9px] font-medium uppercase tracking-[0.14em]">
                  {spotlight.title}
                </div>
                <h4 className="mt-1 truncate text-[13px] font-semibold text-white">
                  {spotlight.trackName}
                </h4>
                <p className="truncate text-[11px] text-white/45">
                  {spotlight.artists}
                </p>
              </div>
            </div>

            <div className="relative mt-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <StatusBadge
                  tone={spotlight.tone}
                  className="border-0 px-2 py-0.5 text-[9px] tracking-[0.1em]"
                >
                  {spotlight.badge}
                </StatusBadge>
                <p className="mt-1.5 truncate text-[10px] text-white/45">
                  {spotlight.stats[0] ?? spotlight.summary}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <SpotifyPlaylistAddButton
                  spotifyTrackId={spotlight.spotifyTrackId}
                  suggestedPlaylistName={spotlight.suggestedPlaylistName}
                  compact
                  className="h-8 w-8 rounded-full border-white/[0.08] bg-white/[0.05] px-0 text-white shadow-none hover:bg-white/10"
                />
                <Link
                  href={spotlight.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir ${spotlight.trackName} no Spotify`}
                  className="text-white/42 inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/[0.07] hover:text-white"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SignalRail({
  rows,
  spotlights,
}: {
  rows: RadarMusicRow[];
  spotlights: DashboardEditorialSpotlight[];
}) {
  return (
    <aside className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.035] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.8)] backdrop-blur-xl">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">
              <Activity className="h-3.5 w-3.5 text-sky-400" />
              Ao vivo
            </div>
            <h2 className="mt-1.5 text-base font-semibold text-white">
              Radar quente
            </h2>
            <p className="text-white/42 mt-0.5 text-[11px]">
              O que está ganhando atenção agora
            </p>
          </div>
          <Link
            href="/radar-music"
            className="inline-flex h-8 items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[11px] font-medium text-white/60 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/10 hover:text-white"
          >
            Ver radar
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4">
          {rows.slice(0, 4).map((row, index) => (
            <article
              key={row.trackId}
              className={`grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5 ${index > 0 ? "border-t border-white/[0.06]" : ""}`}
            >
              <div className="text-center">
                <div className="text-[15px] font-semibold leading-none text-white">
                  {row.rank}
                </div>
                <div className="mt-1 text-[9px] font-medium text-white/35">
                  {movementLabel(row)}
                </div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium text-white">
                  {row.name}
                </div>
                <div className="text-white/42 truncate text-[10px]">
                  {row.artists}
                </div>
              </div>
              <Link
                href={row.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir ${row.name} no Spotify`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/35 transition hover:bg-white/[0.07] hover:text-white"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))}
        </div>
      </div>

      <EditorialList spotlights={spotlights} />
    </aside>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardWorkspaceData();
  const heroTrack = data.primaryAction.track;
  const hotSummary =
    data.heroInsight.supportingPoints[1] ?? "Sem pico forte agora";

  return (
    <ModuleGuard moduleKey="playlist_os">
      <TopNav title="Visão geral" />
      <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-[#08090c]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_18%_0%,rgba(37,99,235,0.12),transparent_40%),radial-gradient(circle_at_82%_4%,rgba(16,185,129,0.07),transparent_34%)]" />

        <Container className="relative py-6 tablet:py-8">
          <header className="flex flex-col justify-between gap-5 pb-6 text-white lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="text-white/38 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em]">
                <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                Playlist intelligence
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="text-white/48 normal-case tracking-normal">
                  {hotSummary}
                </span>
              </div>
              <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.045em] tablet:text-[2.65rem] tablet:leading-[1.08]">
                Sua operação, em ordem de prioridade.
              </h1>
              <p className="text-white/48 mt-2 max-w-xl text-sm leading-6 tablet:text-[15px]">
                Uma visão única do que adicionar, acompanhar e revisar hoje.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={data.hero.secondaryCtaHref ?? "/radar-music"}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.05] px-4 text-sm font-medium text-white/65 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/10 hover:text-white"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Explorar radar
              </Link>
              <Link
                href={data.hero.primaryCtaHref ?? "/curadoria"}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_12px_36px_-14px_rgba(37,99,235,0.9)] transition hover:brightness-110"
              >
                Abrir curadoria
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <main className="min-w-0 space-y-4">
              <section className="overflow-hidden rounded-[28px] border border-white/[0.085] bg-white/[0.04] shadow-[0_32px_100px_-56px_rgba(0,0,0,0.95)] backdrop-blur-xl">
                <div className="relative p-5 tablet:p-6">
                  <div className="pointer-events-none absolute right-0 top-0 h-48 w-64 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_68%)]" />

                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-sky-300/75">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
                      Faça isso primeiro
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <StatusBadge
                        tone={heroTrack?.movement.tone ?? "slate"}
                        className="border-0 px-2 py-0.5 text-[9px] tracking-[0.11em]"
                      >
                        {heroTrack?.chartDeltaLabel ?? "Sem movimento"}
                      </StatusBadge>
                      <StatusBadge
                        tone="yellow"
                        className="border-0 px-2 py-0.5 text-[9px] tracking-[0.11em]"
                      >
                        Score {heroTrack?.decisionScore ?? 0}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="relative mt-5 grid gap-5 lg:grid-cols-[112px_minmax(0,1fr)_auto] lg:items-center">
                    <div
                      className="flex h-28 w-28 items-center justify-center rounded-[24px] bg-white/[0.05] text-white/25 shadow-[0_18px_44px_-22px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/10"
                      style={coverStyle(heroTrack?.coverUrl)}
                    >
                      {heroTrack?.coverUrl ? null : (
                        <Disc3 className="h-7 w-7" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-semibold tracking-[-0.035em] text-white">
                        {heroTrack?.name ?? "Sem prioridade definida"}
                      </h2>
                      <p className="text-white/48 mt-1 truncate text-sm">
                        {heroTrack?.artists ?? "Aguardando novo sinal"}
                      </p>
                      <p className="text-white/62 mt-3 max-w-2xl text-sm leading-6">
                        {data.primaryAction.reason}
                      </p>
                      <div className="text-white/42 mt-3 flex min-w-0 items-center gap-2 text-xs">
                        <span className="text-white/62 shrink-0 font-medium">
                          Melhor fit
                        </span>
                        <span className="h-1 w-1 shrink-0 rounded-full bg-white/20" />
                        <span className="truncate">
                          {heroTrack?.accountFitContext ??
                            "Sem leitura de base no momento"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <SpotifyPlaylistAddButton
                        spotifyTrackId={heroTrack?.spotifyTrackId ?? null}
                        suggestedPlaylistName={heroTrack?.suggestedPlaylistName}
                        label="Adicionar à playlist"
                        className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_34px_-14px_rgba(37,99,235,0.9)] hover:bg-primary/90"
                      />
                      {heroTrack ? (
                        <Link
                          href={heroTrack.spotifyUrl}
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
                </div>

                <MetricBar metrics={data.metrics} />
              </section>

              <section className="rounded-[26px] border border-white/[0.08] bg-white/[0.03] px-4 pb-1 pt-4 shadow-[0_24px_80px_-52px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.07] pb-4">
                  <div>
                    <div className="text-white/32 text-[10px] font-medium uppercase tracking-[0.16em]">
                      Próximas decisões
                    </div>
                    <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-white">
                      Fila de ação
                    </h2>
                  </div>
                  <p className="text-white/38 max-w-sm text-right text-xs leading-5">
                    Prioridades organizadas pelo momento de cada faixa.
                  </p>
                </div>

                <div className="grid lg:grid-cols-3">
                  <QueueColumn
                    title="Adicionar agora"
                    description="Ação recomendada"
                    tone="green"
                    icon={<Flame className="h-3.5 w-3.5" />}
                    tracks={data.addNow}
                    emptyLabel="Nenhuma faixa urgente para adicionar."
                  />
                  <QueueColumn
                    title="Observar"
                    description="Sinais em formação"
                    tone="yellow"
                    icon={<Eye className="h-3.5 w-3.5" />}
                    tracks={data.observe}
                    emptyLabel="Nenhuma observação forte agora."
                  />
                  <QueueColumn
                    title="Revisar"
                    description="Perda de tração"
                    tone="red"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    tracks={data.removeOrTest}
                    emptyLabel="Nada pedindo revisão imediata."
                  />
                </div>
              </section>
            </main>

            <SignalRail
              rows={data.topRadarRows}
              spotlights={data.editorialSpotlights}
            />
          </div>
        </Container>
      </div>
    </ModuleGuard>
  );
}
