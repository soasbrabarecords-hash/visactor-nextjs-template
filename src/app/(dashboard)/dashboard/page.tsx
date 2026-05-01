import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Eye,
  Flame,
  Play,
  Sparkles,
  Trash2,
} from "lucide-react";
import Container from "@/components/container";
import SpotifyPlaylistAddButton from "@/components/workspace/spotify-playlist-add-button";
import StatusBadge from "@/components/workspace/status-badge";
import { getDashboardWorkspaceData } from "@/lib/workspace-data";
import type {
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
    <section className="rounded-[24px] border border-white/10 bg-[#0b1116]/92 p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70">
            {icon}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
              {tracks.length} sinais
            </p>
          </div>
        </div>
        <StatusBadge tone={tone} className="px-2 py-0.5 text-[10px]">
          {title}
        </StatusBadge>
      </div>

      <div className="space-y-2.5">
        {tracks.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-white/55">
            {emptyLabel}
          </div>
        ) : (
          tracks.slice(0, 4).map((track) => (
            <article
              key={`${title}-${track.trackId}`}
              className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
            >
              <div
                className="h-10 w-10 rounded-xl border border-white/10 bg-white/5"
                style={coverStyle(track.coverUrl)}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">
                  {track.name}
                </div>
                <div className="truncate text-xs text-white/55">{track.artists}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <StatusBadge tone={track.movement.tone} className="px-2 py-0.5 text-[10px]">
                    {track.chartDeltaLabel}
                  </StatusBadge>
                  {track.suggestedPlaylistName ? (
                    <StatusBadge tone="green" className="px-2 py-0.5 text-[10px]">
                      {track.suggestedPlaylistName}
                    </StatusBadge>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.slice(0, 4).map((metric) => (
        <article
          key={metric.title}
          className={`rounded-[20px] border px-4 py-3 text-white ${metricToneClasses(metric.tone)}`}
        >
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
            {metric.title}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</div>
          <div className="mt-1 truncate text-xs text-white/55">{metric.helper}</div>
        </article>
      ))}
    </div>
  );
}

function RadarStrip({ rows }: { rows: RadarMusicRow[] }) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-[#0b1116]/92 p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Radar quente</h2>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
            top 5 do momento
          </p>
        </div>
        <Link
          href="/radar-music"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/65 transition hover:bg-white/10 hover:text-white"
        >
          Radar
          <BarChart3 className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="space-y-2">
        {rows.slice(0, 5).map((row) => (
          <article
            key={row.trackId}
            className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"
          >
            <div className="text-center">
              <div className="text-lg font-semibold leading-none">{row.rank}</div>
              <div className="mt-1 text-[10px] text-white/45">{movementLabel(row)}</div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{row.name}</div>
              <div className="truncate text-xs text-white/55">{row.artists}</div>
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
  const hotSummary = data.heroInsight.supportingPoints[1] ?? "Sem pico forte agora";

  return (
    <Container className="py-4">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="green" className="px-2.5 py-0.5 text-[10px]">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Hoje
            </StatusBadge>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-foreground/80">
              {hotSummary}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data.hero.primaryCtaLabel && data.hero.primaryCtaHref ? (
              <Link
                href={data.hero.primaryCtaHref}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[#1ed760] px-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-[#35e26c]"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                {data.hero.primaryCtaLabel}
              </Link>
            ) : null}
            {data.hero.secondaryCtaLabel && data.hero.secondaryCtaHref ? (
              <Link
                href={data.hero.secondaryCtaHref}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/75 transition hover:bg-white/10 hover:text-foreground"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                {data.hero.secondaryCtaLabel}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <section
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#08100c] p-5 text-white shadow-[0_24px_64px_rgba(0,0,0,0.24)]"
            style={coverStyle(heroTrack?.coverUrl)}
          >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,8,0.1),rgba(7,10,8,0.82)_55%,rgba(7,10,8,0.95))]" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={heroTrack?.movement.tone ?? "slate"} className="px-2 py-0.5 text-[10px]">
                  {heroTrack?.chartDeltaLabel ?? "Sem movimento"}
                </StatusBadge>
                <StatusBadge tone="yellow" className="px-2 py-0.5 text-[10px]">
                  Score {heroTrack?.decisionScore ?? 0}
                </StatusBadge>
                {heroTrack?.suggestedPlaylistName ? (
                  <StatusBadge tone="green" className="px-2 py-0.5 text-[10px]">
                    {heroTrack.suggestedPlaylistName}
                  </StatusBadge>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[88px_minmax(0,1fr)_auto] lg:items-center">
                <div
                  className="h-[88px] w-[88px] rounded-[22px] border border-white/10 bg-white/5 shadow-[0_14px_32px_rgba(0,0,0,0.28)]"
                  style={coverStyle(heroTrack?.coverUrl)}
                />

                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    Melhor ação do dia
                  </div>
                  <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight">
                    {heroTrack?.name ?? "Sem prioridade definida"}
                  </h1>
                  <p className="mt-1 truncate text-sm text-white/68">
                    {heroTrack?.artists ?? "Aguardando novo sinal"}
                  </p>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72 line-clamp-2">
                    {data.primaryAction.reason}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <SpotifyPlaylistAddButton
                    spotifyTrackId={heroTrack?.spotifyTrackId ?? null}
                    suggestedPlaylistName={heroTrack?.suggestedPlaylistName}
                    label="Adicionar"
                    className="h-9 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.14em]"
                  />
                  {heroTrack ? (
                    <Link
                      href={heroTrack.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:bg-white/10 hover:text-white"
                    >
                      Abrir
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">
                    Fit editorial
                  </div>
                  <div className="mt-1 text-sm text-white/78 line-clamp-2">
                    {heroTrack?.accountFitContext ?? "Sem leitura de base no momento"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">
                    Resumo
                  </div>
                  <div className="mt-1 text-sm text-white/78 line-clamp-2">
                    {data.heroInsight.supportingPoints[0] ?? "Sem resumo quente agora"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4">
            <QueuePanel
              title="Entrar hoje"
              tone="green"
              icon={<Flame className="h-3.5 w-3.5" />}
              tracks={data.addNow}
              emptyLabel="Sem faixa urgente para adicionar."
            />
            <RadarStrip rows={data.topRadarRows} />
          </div>
        </div>

        <MetricStrip metrics={data.metrics} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
    </Container>
  );
}
