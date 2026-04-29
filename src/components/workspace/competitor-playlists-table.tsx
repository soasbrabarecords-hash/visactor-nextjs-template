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

function getDiagnosis(row: PlaylistBaseRow) {
  if (row.playlist.score >= 80) {
    return {
      label: "Referencia forte",
      tone: "green" as const,
      note: "Boa base para estudar posicionamento, capa e repertorio.",
    };
  }

  if (row.playlist.score >= 55) {
    return {
      label: "Observar",
      tone: "yellow" as const,
      note: "Tem sinais uteis, mas ainda precisa comparacao por repertorio.",
    };
  }

  return {
    label: "Baixa ameaca",
    tone: "slate" as const,
    note: "Use como contraste para entender o que evitar.",
  };
}

export default function CompetitorPlaylistsTable({
  rows,
}: {
  rows: PlaylistBaseRow[];
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Playlists concorrentes
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Mapa de concorrencia</h2>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
        <table className="min-w-[980px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Playlist</th>
              <th className="px-4 py-3">Followers</th>
              <th className="px-4 py-3">Tracks</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Leitura</th>
              <th className="px-4 py-3">Abrir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Adicione playlists concorrentes para iniciar a leitura.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const diagnosis = getDiagnosis(row);

                return (
                  <tr key={row.playlist.id} className="hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-11 w-11 shrink-0 rounded-lg bg-muted"
                          style={coverStyle(row.playlist.coverUrl)}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {row.playlist.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Concorrente monitorado
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{row.followersLabel}</td>
                    <td className="px-4 py-3 text-sm">{row.tracksLabel}</td>
                    <td className="px-4 py-3 text-sm font-semibold">
                      {row.scoreLabel}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <StatusBadge tone={diagnosis.tone}>
                          {diagnosis.label}
                        </StatusBadge>
                        <div className="max-w-[320px] text-xs text-muted-foreground">
                          {diagnosis.note}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/playlists/${row.playlist.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-primary hover:bg-muted/30"
                      >
                        Analise
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Container>
  );
}
