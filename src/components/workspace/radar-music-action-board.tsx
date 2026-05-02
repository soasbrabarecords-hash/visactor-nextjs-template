import Link from "next/link";
import { ExternalLink, Play, Sparkles, TrendingUp, Waves, Zap } from "lucide-react";
import Container from "@/components/container";
import type { DecisionTrack, RadarMusicDecisionQueues } from "@/types/workspace";
import { cn } from "@/lib/utils";
import SpotifyPlaylistAddButton from "./spotify-playlist-add-button";
import StatusBadge from "./status-badge";

function coverStyle(coverUrl: string | null) {
  if (!coverUrl) {
    return undefined;
  }

  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function getColumnTone(title: "Adicionar hoje" | "Testar TikTok" | "Observar" | "Revisar base") {
  switch (title) {
    case "Adicionar hoje":
      return "green";
    case "Testar TikTok":
      return "blue";
    case "Observar":
      return "yellow";
    case "Revisar base":
      return "red";
  }
}

function CompactTrackRow({
  track,
  tone,
}: {
  track: DecisionTrack;
  tone: "green" | "blue" | "yellow" | "red";
}) {
  return (
    <article className="rounded-2xl border border-white/8 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-start gap-3">
        <div
          className="h-12 w-12 shrink-0 rounded-xl border border-white/10 bg-white/5"
          style={coverStyle(track.coverUrl)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{track.name}</div>
              <div className="truncate text-xs text-white/60">{track.artists}</div>
            </div>
            <StatusBadge tone={tone} className="px-2 py-0.5 text-[10px]">
              {track.decisionScore}
            </StatusBadge>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge tone={track.movement.tone} className="px-2 py-0.5 text-[10px]">
              {track.chartDeltaLabel}
            </StatusBadge>
            <StatusBadge tone="slate" className="px-2 py-0.5 text-[10px]">
              {track.fitLabel}
            </StatusBadge>
            {track.suggestedPlaylistName ? (
              <StatusBadge tone="purple" className="px-2 py-0.5 text-[10px]">
                {track.suggestedPlaylistName}
              </StatusBadge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-white/60">
        <span className="truncate">
          {track.alreadyInPlaylists
            ? "Ja esta na tua base"
            : track.accountFitContext}
        </span>
        <div className="flex items-center gap-1.5">
          <SpotifyPlaylistAddButton
            spotifyTrackId={track.spotifyTrackId}
            suggestedPlaylistName={track.suggestedPlaylistName}
            label="Add"
            compact
            className="h-8 w-8 rounded-full border-white/10 bg-white/5 px-0 text-white"
          />
          <Link
            href={track.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function ActionColumn({
  title,
  helper,
  tracks,
}: {
  title: "Adicionar hoje" | "Testar TikTok" | "Observar" | "Revisar base";
  helper: string;
  tracks: DecisionTrack[];
}) {
  const tone = getColumnTone(title);

  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_48px_-32px_rgba(8,15,28,0.9)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <StatusBadge tone={tone}>{tracks.length}</StatusBadge>
      </div>

      <div className="mt-4 space-y-3">
        {tracks.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background/50 px-3 py-4 text-sm text-muted-foreground">
            Nenhuma faixa nessa fila agora.
          </div>
        ) : (
          tracks.map((track) => (
            <CompactTrackRow key={`${title}-${track.trackId}`} track={track} tone={tone} />
          ))
        )}
      </div>
    </section>
  );
}

export default function RadarMusicActionBoard({
  queues,
}: {
  queues: RadarMusicDecisionQueues;
}) {
  const primaryTrack = queues.primaryTrack;
  const summaryCards = [
    {
      label: "Adicionar hoje",
      value: queues.addNow.length,
      helper: "Fit alto e timing forte",
      tone: "green" as const,
      icon: Sparkles,
    },
    {
      label: "TikTok puxando",
      value: queues.testNow.length,
      helper: "Discovery acelerado",
      tone: "blue" as const,
      icon: Waves,
    },
    {
      label: "Observar",
      value: queues.observe.length,
      helper: "Pede mais confirmação",
      tone: "yellow" as const,
      icon: TrendingUp,
    },
    {
      label: "Revisar base",
      value: queues.review.length,
      helper: "Saturação ou queda",
      tone: "red" as const,
      icon: Zap,
    },
  ];

  return (
    <Container className="border-b border-border/70 py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
          Mesa de decisao
        </div>
        <h2 className="mt-2 text-[2rem] font-semibold tracking-tight text-white">Radar de ação do dia</h2>
        <p className="mt-1 max-w-3xl text-sm text-white/60">
          Primeiro vem a decisão. Depois a gente desce para o detalhe. Tudo aqui já cruza Spotify, TikTok Brasil e encaixe real com a tua base.
        </p>
      </div>

      <div className="mb-4 grid gap-3 tablet:grid-cols-2 desktop:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.label}
              className={cn(
                "rounded-[22px] border p-4",
                card.tone === "green"
                  ? "border-emerald-500/20 bg-emerald-500/8"
                  : card.tone === "blue"
                    ? "border-sky-500/20 bg-sky-500/8"
                    : card.tone === "yellow"
                      ? "border-amber-500/20 bg-amber-500/8"
                      : "border-rose-500/20 bg-rose-500/8",
              )}
            >
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                <Icon className="h-3.5 w-3.5" />
                {card.label}
              </div>
              <div className="text-3xl font-semibold text-white">{card.value}</div>
              <div className="mt-1 text-sm text-white/55">{card.helper}</div>
            </article>
          );
        })}
      </div>

      {primaryTrack ? (
        <section className="mb-4 overflow-hidden rounded-[28px] border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(6,12,10,0.98),rgba(6,36,26,0.94))] p-4 shadow-[0_22px_60px_-34px_rgba(6,95,70,0.7)]">
          <div className="grid gap-4 laptop:grid-cols-[1.2fr_0.8fr] laptop:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div
                className="h-24 w-24 shrink-0 rounded-[24px] border border-white/10 bg-white/5"
                style={coverStyle(primaryTrack.coverUrl)}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="green">
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    Melhor decisao
                  </StatusBadge>
                  <StatusBadge tone={primaryTrack.movement.tone}>
                    {primaryTrack.chartDeltaLabel}
                  </StatusBadge>
                  {primaryTrack.suggestedPlaylistName ? (
                    <StatusBadge tone="purple">
                      {primaryTrack.suggestedPlaylistName}
                    </StatusBadge>
                  ) : null}
                </div>
                <h3 className="mt-3 truncate text-2xl font-semibold text-white">
                  {primaryTrack.name}
                </h3>
                <p className="truncate text-sm text-white/65">{primaryTrack.artists}</p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
                  {primaryTrack.accountFitContext}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge tone="slate">{primaryTrack.fitLabel}</StatusBadge>
                  {primaryTrack.alreadyInPlaylists ? (
                    <StatusBadge tone="blue">Ja esta na base</StatusBadge>
                  ) : null}
                  {primaryTrack.accountPlaylistCount > 0 ? (
                    <StatusBadge tone="purple">
                      {primaryTrack.accountPlaylistCount} playlist{primaryTrack.accountPlaylistCount > 1 ? "s" : ""}
                    </StatusBadge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-3 laptop:justify-self-end">
              <div className="grid gap-3 tablet:grid-cols-3 laptop:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">Score</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{primaryTrack.decisionScore}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">Streams</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {primaryTrack.dailyStreams === null ? "—" : new Intl.NumberFormat("pt-BR").format(primaryTrack.dailyStreams)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">Ação</div>
                  <div className="mt-1 text-sm font-medium text-white">{primaryTrack.recommendedAction}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 laptop:justify-end">
                <SpotifyPlaylistAddButton
                  spotifyTrackId={primaryTrack.spotifyTrackId}
                  suggestedPlaylistName={primaryTrack.suggestedPlaylistName}
                  label="Adicionar"
                  className="h-10 rounded-full px-4"
                />
                <Link
                  href={primaryTrack.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  <Play className="h-4 w-4" />
                  Abrir no Spotify
                </Link>
              </div>
              {primaryTrack.suggestedPlaylistName ? (
                <div className="text-xs text-white/55 laptop:text-right">
                  Melhor destino agora: {primaryTrack.suggestedPlaylistName}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 desktop:grid-cols-4">
        <ActionColumn
          title="Adicionar hoje"
          helper="Confirmadas nas duas plataformas ou com fit muito forte."
          tracks={queues.addNow}
        />
        <ActionColumn
          title="Testar TikTok"
          helper="TikTok puxando antes da tua base. Boas para teste rapido."
          tracks={queues.testNow}
        />
        <ActionColumn
          title="Observar"
          helper="Sinais fortes, mas ainda pedem mais um pouco de validacao."
          tracks={queues.observe}
        />
        <ActionColumn
          title="Revisar base"
          helper="Faixas caindo ou saturadas que pedem ajuste fino."
          tracks={queues.review}
        />
      </div>
    </Container>
  );
}
