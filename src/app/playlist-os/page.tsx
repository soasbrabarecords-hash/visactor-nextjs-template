import {
  ArrowUpRight,
  BarChart3,
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
    backgroundImage: `linear-gradient(135deg, rgba(6,10,8,0.52), rgba(6,10,8,0.92)), url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function metricToneClasses(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    green: "border-emerald-500/20 bg-emerald-500/10",
    red: "border-red-500/20 bg-red-500/10",
    blue: "border-sky-500/20 bg-sky-500/10",
    purple: "border-violet-500/20 bg-violet-500/10",
    yellow: "border-amber-500/20 bg-amber-500/10",
    slate: "border-white/10 bg-white/5",
  };

  return classes[tone];
}

function panelToneClasses(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    green: "border-emerald-500/20 bg-[#0d1212]",
    red: "border-red-500/20 bg-[#121011]",
    blue: "border-sky-500/20 bg-[#0d1115]",
    purple: "border-violet-500/20 bg-[#100f14]",
    yellow: "border-amber-500/20 bg-[#12110e]",
    slate: "border-white/10 bg-[#0f1115]",
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

function QueuePanel({
  title,
  tone,
  icon,
  tracks,
  emptyLabel,
}: {
  title: string;
  tone: StatusTone;
  icon: ReactNode;
  tracks: DecisionTrack[];
  emptyLabel: string;
}) {
  return (
    <section
      className={`rounded-[20px] border p-3.5 text-white ${panelToneClasses(tone)}`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70">
            {icon}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="text-[11px] text-white/45">{tracks.length} sinais</p>
          </div>
        </div>
        <StatusBadge tone={tone} className="px-2 py-0.5 text-[10px]">
          {title}
        </StatusBadge>
      </div>

      <div className="space-y-2">
        {tracks.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-white/55">
            {emptyLabel}
          </div>
        ) : (
          tracks.slice(0, 2).map((track) => (
            <article
              key={`${title}-${track.trackId}`}
              className="relative grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5"
            >
              <div
                className="absolute inset-0 opacity-[0.14]"
                style={coverStyle(track.coverUrl)}
              />
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/35"
                style={coverStyle(track.coverUrl)}
              >
                {track.coverUrl ? null : <Disc3 className="h-4 w-4" />}
              </div>
              <div className="relative min-w-0">
                <div className="truncate text-[13px] font-medium text-white">
                  {track.name}
                </div>
                <div className="truncate text-[11px] text-white/55">
                  {track.artists}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <StatusBadge
                    tone={track.movement.tone}
                    className="px-2 py-0.5 text-[10px]"
                  >
                    {track.chartDeltaLabel}
                  </StatusBadge>
                  {track.suggestedPlaylistName ? (
                    <StatusBadge
                      tone="green"
                      className="px-2 py-0.5 text-[10px]"
                    >
                      {track.suggestedPlaylistName}
                    </StatusBadge>
                  ) : null}
                </div>
              </div>
              <div className="relative flex items-center gap-1.5">
                <SpotifyPlaylistAddButton
                  spotifyTrackId={track.spotifyTrackId}
                  suggestedPlaylistName={track.suggestedPlaylistName}
                  compact
                  className="h-8 w-8 rounded-full border-white/10 bg-white/5 px-0 text-white"
                />
                <Link
                  href={track.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function MetricStrip({ metrics }: { metrics: WorkspaceMetric[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {metrics.slice(0, 4).map((metric) => (
        <article
          key={metric.title}
          className={`rounded-2xl border px-3.5 py-3 text-white ${metricToneClasses(metric.tone)}`}
        >
          <div className="text-xs text-white/50">{metric.title}</div>
          <div className="mt-1.5 text-[1.3rem] font-semibold tracking-tight">
            {metric.value}
          </div>
          <div className="mt-1 truncate text-[11px] text-white/55">
            {metric.helper}
          </div>
        </article>
      ))}
    </div>
  );
}

function EditorialStrip({
  spotlights,
}: {
  spotlights: DashboardEditorialSpotlight[];
}) {
  if (spotlights.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2.5">
      {spotlights.slice(0, 2).map((spotlight) => (
        <article
          key={`${spotlight.title}-${spotlight.trackName}`}
          className={`group relative overflow-hidden rounded-[20px] border p-3.5 text-white ${panelToneClasses(spotlight.tone)}`}
        >
          <div
            className="absolute inset-0 opacity-[0.18] transition duration-300 group-hover:opacity-[0.24]"
            style={coverStyle(spotlight.coverUrl)}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,9,0.04),rgba(5,7,9,0.92))]" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                {spotlight.title}
              </div>
              <h3 className="mt-1.5 truncate text-[15px] font-semibold">
                {spotlight.trackName}
              </h3>
              <p className="truncate text-[11px] text-white/55">
                {spotlight.artists}
              </p>
            </div>
            <div
              className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-white/5"
              style={coverStyle(spotlight.coverUrl)}
            />
          </div>

          <div className="relative mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <StatusBadge
                tone={spotlight.tone}
                className="px-2 py-0.5 text-[10px]"
              >
                {spotlight.badge}
              </StatusBadge>
              <div className="text-white/62 mt-1.5 truncate text-[11px]">
                {spotlight.stats[0] ?? spotlight.summary}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <SpotifyPlaylistAddButton
                spotifyTrackId={spotlight.spotifyTrackId}
                suggestedPlaylistName={spotlight.suggestedPlaylistName}
                compact
                className="h-8 w-8 rounded-full border-white/10 bg-white/5 px-0 text-white"
              />
              <Link
                href={spotlight.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function RadarStrip({ rows }: { rows: RadarMusicRow[] }) {
  return (
    <section className="rounded-[20px] border border-white/10 bg-[#0f1115] p-3.5 text-white">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Radar quente</h2>
          <p className="text-[11px] text-white/45">top 4 do momento</p>
        </div>
        <Link
          href="/radar-music"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/65 transition hover:bg-white/10 hover:text-white"
        >
          Radar
          <BarChart3 className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="space-y-1.5">
        {rows.slice(0, 4).map((row) => (
          <article
            key={row.trackId}
            className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
          >
            <div className="text-center">
              <div className="text-base font-semibold leading-none">
                {row.rank}
              </div>
              <div className="mt-1 text-[10px] text-white/45">
                {movementLabel(row)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{row.name}</div>
              <div className="truncate text-[11px] text-white/55">
                {row.artists}
              </div>
            </div>
            <Link
              href={row.spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardWorkspaceData();
  const heroTrack = data.primaryAction.track;
  const hotSummary =
    data.heroInsight.supportingPoints[1] ?? "Sem pico forte agora";

  return (
    <ModuleGuard moduleKey="playlist_os">
      <TopNav title="Playlist OS" />
      <div className="min-h-[calc(100dvh-4rem)] bg-[#080a0e]">
        <Container className="py-5">
          <div className="space-y-3">
            <header className="flex flex-wrap items-end justify-between gap-4 py-1 text-white">
              <div>
                <div className="flex items-center gap-2 text-xs text-white/45">
                  <Sparkles className="h-3.5 w-3.5" />
                  {hotSummary}
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] tablet:text-3xl">
                  Playlist OS
                </h1>
                <p className="mt-1 text-sm text-white/55">
                  Curadoria guiada por charts, sinais e performance.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={data.hero.primaryCtaHref ?? "/curadoria"}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Ir para curadoria
                </Link>
                <Link
                  href={data.hero.secondaryCtaHref ?? "/radar-music"}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Abrir Radar Music
                </Link>
              </div>
            </header>

            <section className="rounded-[22px] border border-white/10 bg-[#0f1115] p-4 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium text-white/50">
                  Melhor ação do dia
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone={heroTrack?.movement.tone ?? "slate"}>
                    {heroTrack?.chartDeltaLabel ?? "Sem movimento"}
                  </StatusBadge>
                  <StatusBadge tone="yellow">
                    Score {heroTrack?.decisionScore ?? 0}
                  </StatusBadge>
                  {heroTrack?.suggestedPlaylistName ? (
                    <StatusBadge tone="green">
                      {heroTrack.suggestedPlaylistName}
                    </StatusBadge>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid gap-4 lg:grid-cols-[72px_minmax(0,1fr)_minmax(220px,0.42fr)_auto] lg:items-center">
                <div
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-white/30"
                  style={coverStyle(heroTrack?.coverUrl)}
                >
                  {heroTrack?.coverUrl ? null : <Disc3 className="h-6 w-6" />}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight">
                    {heroTrack?.name ?? "Sem prioridade definida"}
                  </h2>
                  <p className="truncate text-sm text-white/55">
                    {heroTrack?.artists ?? "Aguardando novo sinal"}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/65">
                    {data.primaryAction.reason}
                  </p>
                </div>
                <div className="min-w-0 border-l border-white/10 pl-4">
                  <div className="text-xs font-medium text-white/45">
                    Fit editorial
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/70">
                    {heroTrack?.accountFitContext ??
                      "Sem leitura de base no momento"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SpotifyPlaylistAddButton
                    spotifyTrackId={heroTrack?.spotifyTrackId ?? null}
                    suggestedPlaylistName={heroTrack?.suggestedPlaylistName}
                    label="Adicionar"
                    className="h-9 rounded-full px-4 text-xs font-semibold"
                  />
                  {heroTrack ? (
                    <Link
                      href={heroTrack.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      Abrir
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>

            <MetricStrip metrics={data.metrics} />

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid content-start gap-3">
                <QueuePanel
                  title="Entrar hoje"
                  tone="green"
                  icon={<Flame className="h-3.5 w-3.5" />}
                  tracks={data.addNow}
                  emptyLabel="Sem faixa urgente para adicionar."
                />
                <div className="grid gap-3 lg:grid-cols-2">
                  <QueuePanel
                    title="Observar"
                    tone="yellow"
                    icon={<Eye className="h-3.5 w-3.5" />}
                    tracks={data.observe}
                    emptyLabel="Sem observação forte agora."
                  />
                  <QueuePanel
                    title="Revisar"
                    tone="red"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    tracks={data.removeOrTest}
                    emptyLabel="Nada pedindo limpeza imediata."
                  />
                </div>
              </div>
              <aside className="grid content-start gap-3">
                <RadarStrip rows={data.topRadarRows} />
                <EditorialStrip spotlights={data.editorialSpotlights} />
              </aside>
            </div>
          </div>
        </Container>
      </div>
    </ModuleGuard>
  );
}
