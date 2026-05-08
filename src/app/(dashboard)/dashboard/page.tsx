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
    green: "border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.14),rgba(7,11,10,0.96))]",
    red: "border-red-500/20 bg-[linear-gradient(180deg,rgba(248,113,113,0.14),rgba(11,7,8,0.96))]",
    blue: "border-sky-500/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.14),rgba(7,10,13,0.96))]",
    purple: "border-violet-500/20 bg-[linear-gradient(180deg,rgba(167,139,250,0.14),rgba(10,8,14,0.96))]",
    yellow: "border-amber-500/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.14),rgba(13,10,7,0.96))]",
    slate: "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(11,12,15,0.96))]",
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
    <section className={`rounded-[22px] border p-3.5 text-white shadow-[0_16px_42px_rgba(0,0,0,0.16)] ${panelToneClasses(tone)}`}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
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
                className="relative h-9 w-9 rounded-xl border border-white/10 bg-white/5"
                style={coverStyle(track.coverUrl)}
              />
              <div className="relative min-w-0">
                <div className="truncate text-[13px] font-medium text-white">
                  {track.name}
                </div>
                <div className="truncate text-[11px] text-white/55">{track.artists}</div>
                <div className="mt-1 flex flex-wrap gap-1">
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
          className={`rounded-[18px] border px-3.5 py-2.5 text-white ${metricToneClasses(metric.tone)}`}
        >
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
            {metric.title}
          </div>
          <div className="mt-1.5 text-[1.3rem] font-semibold tracking-tight">{metric.value}</div>
          <div className="mt-1 truncate text-[11px] text-white/55">{metric.helper}</div>
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
    <div className="grid gap-2.5 xl:grid-cols-2">
      {spotlights.slice(0, 2).map((spotlight) => (
        <article
          key={`${spotlight.title}-${spotlight.trackName}`}
          className={`group relative overflow-hidden rounded-[22px] border p-3.5 text-white shadow-[0_16px_42px_rgba(0,0,0,0.16)] ${panelToneClasses(spotlight.tone)}`}
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
              <p className="truncate text-[11px] text-white/55">{spotlight.artists}</p>
            </div>
            <div
              className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-white/5"
              style={coverStyle(spotlight.coverUrl)}
            />
          </div>

          <div className="relative mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <StatusBadge tone={spotlight.tone} className="px-2 py-0.5 text-[10px]">
                {spotlight.badge}
              </StatusBadge>
              <div className="mt-1.5 truncate text-[11px] text-white/62">
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
    <section className="rounded-[22px] border border-white/10 bg-[#0b1116]/92 p-3.5 text-white shadow-[0_16px_42px_rgba(0,0,0,0.16)]">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Radar quente</h2>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
            top 4 do momento
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

      <div className="space-y-1.5">
        {rows.slice(0, 4).map((row) => (
          <article
            key={row.trackId}
            className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
          >
            <div className="text-center">
              <div className="text-base font-semibold leading-none">{row.rank}</div>
              <div className="mt-1 text-[10px] text-white/45">{movementLabel(row)}</div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{row.name}</div>
              <div className="truncate text-[11px] text-white/55">{row.artists}</div>
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
    <Container className="py-2">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="green" className="px-2.5 py-0.5 text-[10px]">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Hoje
            </StatusBadge>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-foreground/80">
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

        <div className="grid gap-2 xl:grid-cols-[minmax(0,1.08fr)_304px]">
          <section
            className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1116]/95 px-4 py-3 text-white shadow-[0_16px_42px_rgba(0,0,0,0.16)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(30,215,96,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(8,11,14,0.96))]" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                    Melhor ação do dia
                  </div>
                  <StatusBadge tone={heroTrack?.movement.tone ?? "slate"} className="px-2 py-0.5 text-[10px]">
                    {heroTrack?.chartDeltaLabel ?? "Sem movimento"}
                  </StatusBadge>
                  <StatusBadge tone="yellow" className="px-2 py-0.5 text-[10px]">
                    Score {heroTrack?.decisionScore ?? 0}
                  </StatusBadge>
                </div>
                {heroTrack?.suggestedPlaylistName ? (
                  <StatusBadge tone="green" className="px-2 py-0.5 text-[10px]">
                    {heroTrack.suggestedPlaylistName}
                  </StatusBadge>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[78px_minmax(0,1fr)_220px] lg:items-center">
                <div
                  className="h-[78px] w-[78px] rounded-[20px] border border-white/10 bg-white/5 shadow-[0_14px_30px_rgba(0,0,0,0.24)]"
                  style={coverStyle(heroTrack?.coverUrl)}
                />

                <div className="min-w-0">
                  <h1 className="truncate text-[1.05rem] font-semibold tracking-tight md:text-[1.18rem]">
                    {heroTrack?.name ?? "Sem prioridade definida"}
                  </h1>
                  <p className="mt-0.5 truncate text-[12px] text-white/68">
                    {heroTrack?.artists ?? "Aguardando novo sinal"}
                  </p>
                  <p className="mt-2 max-w-2xl text-[12px] leading-5 text-white/72 line-clamp-2">
                    {data.primaryAction.reason}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SpotifyPlaylistAddButton
                      spotifyTrackId={heroTrack?.spotifyTrackId ?? null}
                      suggestedPlaylistName={heroTrack?.suggestedPlaylistName}
                      label="Adicionar"
                      className="h-8 rounded-full px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    />
                    {heroTrack ? (
                      <Link
                        href={heroTrack.spotifyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:bg-white/10 hover:text-white"
                      >
                        Abrir
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                      Fit editorial
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-white/78 line-clamp-2">
                      {heroTrack?.accountFitContext ?? "Sem leitura de base no momento"}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                      Leitura rápida
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-white/78 line-clamp-2">
                      {data.heroInsight.supportingPoints[0] ?? "Sem resumo quente agora"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-2.5">
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
        <EditorialStrip spotlights={data.editorialSpotlights} />

        <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
