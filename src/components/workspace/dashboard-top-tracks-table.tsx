import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import Container from "@/components/container";
import { cn } from "@/lib/utils";
import type { RadarMusicRow } from "@/types/workspace";
import StatusBadge from "./status-badge";

function formatCount(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

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

function movementLabel(row: RadarMusicRow) {
  if (row.previousRank === null || row.rankChange === null) {
    return "NEW";
  }

  if (row.previousRank > row.rank) {
    return `↑ ${row.previousRank - row.rank}`;
  }

  if (row.previousRank < row.rank) {
    return `↓ ${row.rank - row.previousRank}`;
  }

  return "—";
}

function movementTone(row: RadarMusicRow) {
  if (row.previousRank === null || row.rankChange === null) {
    return "purple";
  }

  if (row.previousRank > row.rank) {
    return "green";
  }

  if (row.previousRank < row.rank) {
    return "red";
  }

  return "slate";
}

function rankBarWidth(rank: number) {
  return `${Math.max(20, 100 - rank * 4)}%`;
}

export default function DashboardTopTracksTable({
  rows,
}: {
  rows: RadarMusicRow[];
}) {
  return (
    <Container className="border-b border-border py-6">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0f0d] p-5 text-white shadow-[0_24px_64px_rgba(0,0,0,0.24)] laptop:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">
              Top 10 Brasil
            </div>
            <h2 className="mt-2 text-2xl font-semibold">O que esta bombando agora</h2>
            <p className="mt-2 text-sm text-white/70">
              Leitura viva do chart com movimento, streams e sinais de fit.
            </p>
          </div>
          <Link
            href="/radar-music"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Ver ranking completo
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.trackId}
              className="rounded-[24px] border border-white/10 bg-white/5 p-4 transition duration-300 hover:bg-white/10"
            >
              <div className="grid gap-4 laptop:grid-cols-[72px_1fr_auto] laptop:items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 text-3xl font-semibold tracking-tight text-white/92">
                    {row.rank}
                  </div>
                  <StatusBadge tone={movementTone(row)}>{movementLabel(row)}</StatusBadge>
                </div>

                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className="h-16 w-16 shrink-0 rounded-[20px] border border-white/10 bg-muted shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
                    style={coverStyle(row.coverUrl)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-semibold">{row.name}</h3>
                      {row.intelligenceTags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/58"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 truncate text-sm text-white/70">{row.artists}</p>
                    <div className="mt-3 h-1.5 w-full max-w-xl overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          row.movement.type === "up"
                            ? "bg-emerald-400"
                            : row.movement.type === "down"
                              ? "bg-red-400"
                              : row.movement.type === "new" || row.movement.type === "reentry"
                                ? "bg-violet-400"
                                : "bg-white/55",
                        )}
                        style={{ width: rankBarWidth(row.rank) }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                      Streams
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {formatCount(row.dailyStreams)}
                    </div>
                  </div>
                  <Link
                    href={row.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-white transition hover:bg-black/35"
                  >
                    Abrir
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Container>
  );
}
