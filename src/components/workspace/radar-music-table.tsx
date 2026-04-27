import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import type { RadarMusicRow } from "@/types/workspace";
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

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function formatSignedCount(value: number) {
  const roundedValue = Math.round(value);

  if (roundedValue > 0) {
    return `+${formatCount(roundedValue)}`;
  }

  if (roundedValue < 0) {
    return `-${formatCount(Math.abs(roundedValue))}`;
  }

  return "0";
}

function getMovementValue(row: RadarMusicRow) {
  if (row.previousRank === null || row.rankChange === null) {
    return "NEW";
  }

  if (row.rankChange > 0) {
    return `↑ ${row.rankChange}`;
  }

  if (row.rankChange < 0) {
    return `↓ ${Math.abs(row.rankChange)}`;
  }

  return "—";
}

function getMovementTone(row: RadarMusicRow) {
  if (row.previousRank === null || row.rankChange === null) {
    return "purple";
  }

  if (row.rankChange > 0) {
    return "green";
  }

  if (row.rankChange < 0) {
    return "red";
  }

  return "slate";
}

function formatDailyStreams(value: number | null) {
  return value === null ? "Sem dado de streams" : formatCount(value);
}

function formatPeakLabel() {
  return "Pico —";
}

function formatDaysOnChart(value: number) {
  return `${value} dias`;
}

function getOpportunityTags(row: RadarMusicRow) {
  const tags: string[] = [];

  if (row.previousRank === null) {
    tags.push("Nova entrada");
  }

  if (row.lowSaturation) {
    tags.push("Baixa saturacao");
  }

  if (row.popularity >= 85) {
    tags.push("Hit forte");
  }

  if (row.rankChange !== null && row.rankChange > 0) {
    tags.push("Subindo");
  }

  return tags.slice(0, 2);
}

export default function RadarMusicTable({
  rows,
}: {
  rows: RadarMusicRow[];
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Chart principal BR
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Ranking do radar</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Leitura editorial inspirada em Spotify Charts: posicao, movimento,
          streams, pico, permanencia e oportunidade de curadoria.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-border bg-card/60 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.9)]">
        <table className="min-w-[980px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Pos.</th>
              <th className="px-4 py-3">Movimento</th>
              <th className="px-4 py-3">Musica</th>
              <th className="px-4 py-3">Streams 24h</th>
              <th className="px-4 py-3">Peak</th>
              <th className="px-4 py-3">Dias</th>
              <th className="px-4 py-3">Oportunidade</th>
              <th className="px-4 py-3">Crescimento</th>
              <th className="px-4 py-3">Spotify</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma faixa encontrada para esse filtro agora.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.trackId} className="hover:bg-muted/10">
                  <td className="px-4 py-3">
                    <div className="text-2xl font-semibold tracking-tight">
                      #{row.rank}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <StatusBadge
                        tone={getMovementTone(row)}
                        className="min-w-[74px] justify-center"
                      >
                        {getMovementValue(row)}
                      </StatusBadge>
                      <div className="text-xs text-muted-foreground">
                        {row.previousRank === null ? "Entrada nova" : `Antes #${row.previousRank}`}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-xl border border-border bg-muted shadow-lg"
                        style={coverStyle(row.coverUrl)}
                      />
                      <div className="min-w-0 space-y-1">
                        <div>
                          <div className="truncate font-semibold">{row.name}</div>
                          <div className="truncate text-sm text-muted-foreground">
                            {row.artists}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.previousRank === null ? (
                            <StatusBadge tone="purple">NEW</StatusBadge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className={row.dailyStreams === null ? "text-muted-foreground" : ""}>
                      {formatDailyStreams(row.dailyStreams)}
                    </div>
                    <div
                      className={`mt-1 text-xs ${row.streamRank === null ? "text-muted-foreground" : "text-slate-300"}`}
                    >
                      {row.dailyStreams === null
                        ? "Sem dado de streams"
                        : row.streamRank === null
                          ? "Rank streams indisponivel"
                          : `#${row.streamRank} por streams`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatPeakLabel()}
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDaysOnChart(row.daysOnRadar)}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">
                      {row.opportunityScore}/100
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getOpportunityTags(row).map((tag) => (
                        <StatusBadge
                          key={tag}
                          tone={
                            tag === "Subindo" || tag === "Hit forte"
                              ? "green"
                              : tag === "Nova entrada"
                                ? "purple"
                                : "yellow"
                          }
                          className="normal-case tracking-[0.04em]"
                        >
                          {tag}
                        </StatusBadge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div
                      className={
                        row.previousRank === null || row.rankChange === null
                          ? "text-violet-300"
                          : row.rankChange > 0
                            ? "text-emerald-300"
                            : row.rankChange < 0
                              ? "text-red-300"
                              : "text-slate-300"
                      }
                    >
                      {getMovementValue(row)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.dailyStreams === null
                        ? "Sem dado de streams"
                        : row.streamGrowth === null
                          ? row.streamVelocityLabel
                          : `${formatSignedCount(row.streamGrowth)} streams`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={row.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-primary hover:bg-muted/40"
                    >
                      Abrir
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Container>
  );
}
