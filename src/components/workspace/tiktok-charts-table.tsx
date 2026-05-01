import Link from "next/link";
import { ArrowRight, Flame, Radio } from "lucide-react";
import Container from "@/components/container";
import type { TikTokPublicChart } from "@/lib/tiktok-public-charts";
import StatusBadge from "./status-badge";

function formatSnapshotDate(value: string | null) {
  if (!value) {
    return "Data publica";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getRankTone(rank: number) {
  if (rank <= 10) {
    return "blue";
  }

  if (rank <= 25) {
    return "purple";
  }

  if (rank <= 50) {
    return "green";
  }

  return "slate";
}

function getRankLabel(rank: number) {
  if (rank <= 10) {
    return "Top 10";
  }

  if (rank <= 25) {
    return "Top 25";
  }

  if (rank <= 50) {
    return "Top 50";
  }

  return "Top 100";
}

export default function TikTokChartsTable({
  chart,
}: {
  chart: TikTokPublicChart;
}) {
  const featuredTracks = chart.tracks.slice(0, 3);

  return (
    <Container className="py-8">
      <div className="grid gap-4 laptop:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="overflow-hidden rounded-[30px] border border-border bg-[linear-gradient(135deg,rgba(0,0,0,0.95),rgba(29,78,216,0.18),rgba(217,70,239,0.18))] p-5 shadow-[0_28px_90px_-42px_rgba(14,165,233,0.45)]">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="blue">
              <Flame className="mr-1 h-3.5 w-3.5" />
              TikTok viral
            </StatusBadge>
            <StatusBadge tone="slate">{formatSnapshotDate(chart.snapshotDate)}</StatusBadge>
            <StatusBadge tone="purple">Fonte publica</StatusBadge>
          </div>

          <div className="mt-5 grid gap-4 laptop:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                Radar instantaneo
              </div>
              <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight text-white">
                O calor do TikTok em uma leitura simples e pronta para cruzar com Spotify.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                Esse painel puxa o chart viral publico do TikTok sem banco proprio,
                para testar rapidamente o que esta mais quente e jogar isso no Radar Music.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/radar-music"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white/90"
                >
                  Cruzar no Radar
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="https://tikcharts.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/72 transition hover:bg-white/10 hover:text-white"
                >
                  Abrir fonte
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <article className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Snapshot
                </div>
                <div className="mt-3 text-3xl font-semibold">
                  {chart.tracks.length}
                </div>
                <p className="mt-2 text-sm text-white/65">
                  faixas puxadas da leitura publica atual.
                </p>
              </article>

              <article className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Fluxo
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-white/80">
                  <Radio className="h-4 w-4 text-sky-300" />
                  TikTok Charts
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-white/55">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Radar Music
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          {featuredTracks.map((track) => (
            <article
              key={`featured-${track.rank}-${track.trackName}`}
              className="rounded-[26px] border border-border bg-card/70 p-4 shadow-[0_24px_48px_-32px_rgba(8,15,28,0.8)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <StatusBadge tone={getRankTone(track.rank)}>
                    {getRankLabel(track.rank)}
                  </StatusBadge>
                  <h3 className="mt-3 line-clamp-1 text-lg font-semibold">
                    {track.trackName}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {track.artistName}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Rank
                  </div>
                  <div className="mt-1 text-2xl font-semibold">#{track.rank}</div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-[30px] border border-border bg-card/60 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.9)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Top 100 externo
            </div>
            <h3 className="mt-1 text-xl font-semibold">TikTok Charts</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="yellow">Teste sem banco</StatusBadge>
            <StatusBadge tone="slate">Cache 30 min</StatusBadge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full divide-y divide-border text-left">
            <thead className="bg-muted/20">
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-3">Pos.</th>
                <th className="px-5 py-3">Faixa</th>
                <th className="px-5 py-3">Artista</th>
                <th className="px-5 py-3">Sinal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {chart.tracks.map((track) => (
                <tr key={`${track.rank}-${track.trackName}-${track.artistName}`} className="hover:bg-muted/10">
                  <td className="px-5 py-3 align-top">
                    <div className="text-lg font-semibold">#{track.rank}</div>
                  </td>
                  <td className="px-5 py-3 align-top">
                    <div className="font-medium">{track.trackName}</div>
                  </td>
                  <td className="px-5 py-3 align-top text-sm text-muted-foreground">
                    {track.artistName}
                  </td>
                  <td className="px-5 py-3 align-top">
                    <StatusBadge tone={getRankTone(track.rank)}>
                      {getRankLabel(track.rank)}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Container>
  );
}
