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
  return "—";
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
      <div className="mb-4">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Chart principal BR
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Ranking do radar</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Leitura editorial do Spotify Charts BR com foco em movimento, streams e oportunidade.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-border bg-card/60 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.9)]">
        <table className="min-w-[1080px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Pos.</th>
              <th className="px-4 py-3">Movimento</th>
              <th className="px-4 py-3">Musica</th>
              <th className="px-4 py-3">Artistas</th>
              <th className="px-4 py-3">Streams 24h</th>
              <th className="px-4 py-3">Peak</th>
              <th className="px-4 py-3">Dias</th>
              <th className="px-4 py-3">Oportunidade</th>
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
                  <td className="px-4 py-3 align-top">
                    <div className="text-2xl font-semibold tracking-tight text-white">
                      #{row.rank}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <StatusBadge
                        tone={getMovementTone(row)}
                        className="min-w-[70px] justify-center"
                      >
                        {getMovementValue(row)}
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 shrink-0 rounded-xl border border-border bg-muted shadow-lg"
                        style={coverStyle(row.coverUrl)}
                      />
                      <div className="min-w-0 space-y-1">
                        <div>
                          <div className="truncate font-semibold">{row.name}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.previousRank === null ? (
                            <StatusBadge tone="purple">NEW</StatusBadge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="max-w-[220px] text-sm text-muted-foreground">
                      {row.artists}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-sm font-medium">
                    <div className={row.dailyStreams === null ? "text-muted-foreground" : ""}>
                      {formatDailyStreams(row.dailyStreams)}
                    </div>
                    <div
                      className={`mt-1 text-xs ${row.streamRank === null ? "text-muted-foreground" : "text-slate-300"}`}
                    >
                      {row.dailyStreams === null
                        ? "Sem dado de streams"
                        : row.streamRank === null
                          ? "—"
                          : `#${row.streamRank} por streams`}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-muted-foreground">
                    {formatPeakLabel()}
                  </td>
                  <td className="px-4 py-3 align-top text-sm">{formatDaysOnChart(row.daysOnRadar)}</td>
                  <td className="px-4 py-3 align-top">
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
                  <td className="px-4 py-3 align-top">
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
