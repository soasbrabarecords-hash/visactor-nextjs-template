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

export default function RadarMusicTable({
  rows,
}: {
  rows: RadarMusicRow[];
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

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
        <table className="min-w-[1240px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Mov.</th>
              <th className="px-4 py-3">Musica</th>
              <th className="px-4 py-3">Artista</th>
              <th className="px-4 py-3">Album</th>
              <th className="px-4 py-3">Popularidade</th>
              <th className="px-4 py-3">Rank ant.</th>
              <th className="px-4 py-3">Variacao</th>
              <th className="px-4 py-3">Dias</th>
              <th className="px-4 py-3">Oportunidade</th>
              <th className="px-4 py-3">Spotify</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma faixa encontrada para esse filtro agora.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.trackId} className="hover:bg-muted/10">
                  <td className="px-4 py-4 text-lg font-semibold">{row.rank}</td>
                  <td className="px-4 py-4">
                    <StatusBadge tone={row.movement.tone}>
                      {row.movement.valueLabel} {formatRankChange(row.rankChange)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-xl bg-muted"
                        style={coverStyle(row.coverUrl)}
                      />
                      <div>
                        <div className="font-semibold">{row.name}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {row.statusTags.slice(0, 2).map((tag) => (
                            <StatusBadge
                              key={tag}
                              tone={
                                tag === "Nova"
                                  ? "purple"
                                  : tag === "Mover"
                                    ? "green"
                                    : tag === "Recorrente"
                                      ? "blue"
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
                  <td className="px-4 py-4 text-sm">{row.artists}</td>
                  <td className="px-4 py-4 text-sm">{row.albumName}</td>
                  <td className="px-4 py-4 text-sm font-medium">
                    {row.popularity}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {row.previousRank ?? "NEW"}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium">
                    {formatRankChange(row.rankChange)}
                  </td>
                  <td className="px-4 py-4 text-sm">{row.daysOnRadar}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
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
                        <StatusBadge key={item.label} tone={item.tone}>
                          {item.label}
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
