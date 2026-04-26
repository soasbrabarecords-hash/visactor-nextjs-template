import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import type { PlaylistBaseRow } from "@/types/workspace";
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

export default function BasePlaylistsTable({
  rows,
}: {
  rows: PlaylistBaseRow[];
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Painel operacional
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Base de playlists</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Cadastro, saude da base e acompanhamento das playlists monitoradas,
          com foco operacional em vez de leitura de chart.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
        <table className="min-w-[1080px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Playlist</th>
              <th className="px-4 py-3">Seguidores</th>
              <th className="px-4 py-3">Crescimento</th>
              <th className="px-4 py-3">Tracks</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Ultima atualizacao</th>
              <th className="px-4 py-3">Abrir analise</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma playlist encontrada na base ainda.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.playlist.id} className="hover:bg-muted/10">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-xl bg-muted"
                        style={coverStyle(row.playlist.coverUrl)}
                      />
                      <div>
                        <div className="font-semibold">{row.playlist.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Playlist monitorada
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium">
                    {row.followersLabel}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge tone={row.growthTone}>{row.growthLabel}</StatusBadge>
                  </td>
                  <td className="px-4 py-4 text-sm">{row.tracksLabel}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(0, Math.min(row.playlist.score, 100))}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{row.scoreLabel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm">{row.lastUpdatedLabel}</td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/playlists/${row.playlist.id}`}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Abrir analise
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
