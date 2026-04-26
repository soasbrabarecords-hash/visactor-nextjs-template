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

function formatRankChange(value: number | null) {
  if (value === null) {
    return "NEW";
  }

  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function formatPopularityChange(value: number | null) {
  if (value === null) {
    return "NEW";
  }

  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function getMovementValue(row: RadarMusicRow) {
  if (row.rankChange === null) {
    return row.movement.valueLabel;
  }

  return `${row.movement.valueLabel} ${formatRankChange(row.rankChange)}`;
}

export default function RadarMusicTable({
  rows,
  selectedGenreLabel,
}: {
  rows: RadarMusicRow[];
  selectedGenreLabel: string;
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Chart principal
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Ranking do radar</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Tabela principal para leitura de posicao, movimento, persistencia e
          oportunidade, com linguagem de chart musical real.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-border bg-card/60 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.9)]">
        <table className="min-w-[1240px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Mov.</th>
              <th className="px-4 py-3">Musica</th>
              <th className="px-4 py-3">Artista</th>
              <th className="px-4 py-3">Genero</th>
              <th className="px-4 py-3">Popularidade</th>
              <th className="px-4 py-3">Pop Δ</th>
              <th className="px-4 py-3">Dias</th>
              <th className="px-4 py-3">Sat.</th>
              <th className="px-4 py-3">Oportunidade</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Spotify</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma faixa encontrada para esse filtro agora.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.trackId} className="hover:bg-muted/10">
                  <td className="px-4 py-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background/60 text-lg font-semibold">
                      {row.rank}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <StatusBadge tone={row.movement.tone} className="min-w-[88px] justify-center">
                        {getMovementValue(row)}
                      </StatusBadge>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {row.movement.label}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-14 w-14 rounded-2xl border border-border bg-muted shadow-lg"
                        style={coverStyle(row.coverUrl)}
                      />
                      <div className="space-y-2">
                        <div>
                          <div className="font-semibold">{row.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {row.artists}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedGenreLabel !== "Todos os generos" ? (
                            <StatusBadge tone="blue">{selectedGenreLabel}</StatusBadge>
                          ) : null}
                          {row.intelligenceTags.slice(0, 2).map((tag) => (
                            <StatusBadge
                              key={tag}
                              tone={
                                tag === "Nova entrada" || tag === "Reentrada"
                                  ? "purple"
                                  : tag === "Subindo" || tag === "Explodindo"
                                    ? "green"
                                    : tag === "Recorrente"
                                      ? "blue"
                                      : tag === "Caindo" || tag === "Evitar agora"
                                        ? "red"
                                      : "yellow"
                              }
                            >
                              {tag}
                            </StatusBadge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <div className="max-w-[220px] leading-6">{row.artists}</div>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <StatusBadge tone="blue">{row.genre}</StatusBadge>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium">
                    {row.popularity}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium">
                    <span
                      className={
                        row.popularityChange === null
                          ? "text-violet-300"
                          : row.popularityChange > 0
                            ? "text-emerald-300"
                            : row.popularityChange < 0
                              ? "text-red-300"
                              : "text-slate-300"
                      }
                    >
                      {formatPopularityChange(row.popularityChange)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm">{row.daysOnRadar}</td>
                  <td className="px-4 py-4 text-sm">{row.saturationCount}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(0, Math.min(row.opportunityScore, 100))}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {row.opportunityScore}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.scoreBreakdown.map((item) => (
                        <StatusBadge key={item.label} tone={item.tone} className="normal-case tracking-[0.04em]">
                          {item.label}
                        </StatusBadge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex max-w-[220px] flex-wrap gap-2">
                      {row.intelligenceTags.slice(0, 4).map((tag) => (
                        <StatusBadge
                          key={tag}
                          tone={
                            tag === "Subindo" || tag === "Explodindo" || tag === "Teste editorial"
                              ? "green"
                              : tag === "Caindo" || tag === "Evitar agora"
                                ? "red"
                                : tag === "Nova entrada" || tag === "Reentrada"
                                  ? "purple"
                                  : tag === "Recorrente"
                                    ? "blue"
                                    : "yellow"
                          }
                          className="normal-case tracking-[0.04em]"
                        >
                          {tag}
                        </StatusBadge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={row.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
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
