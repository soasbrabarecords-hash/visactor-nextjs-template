import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import type { RadarMusicRow } from "@/types/workspace";
import StatusBadge from "./status-badge";

function formatCount(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
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

export default function DashboardTopTracksTable({
  rows,
}: {
  rows: RadarMusicRow[];
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Top 10 Brasil
          </div>
          <h2 className="mt-2 text-2xl font-semibold">O que esta bombando agora</h2>
        </div>
        <Link
          href="/radar-music"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-primary hover:bg-muted/30"
        >
          Ver mais
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
        <table className="min-w-[760px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Pos.</th>
              <th className="px-4 py-3">Mov.</th>
              <th className="px-4 py-3">Track</th>
              <th className="px-4 py-3">Artistas</th>
              <th className="px-4 py-3 text-right">Streams</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.trackId} className="hover:bg-muted/10">
                <td className="px-4 py-3 text-xl font-semibold">#{row.rank}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={movementTone(row)}>
                    {movementLabel(row)}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 font-semibold">{row.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {row.artists}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium">
                  {formatCount(row.dailyStreams)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Container>
  );
}
