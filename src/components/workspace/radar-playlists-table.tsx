import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import type { RadarPlaylistRow } from "@/types/workspace";
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

export default function RadarPlaylistsTable({
  rows,
  title,
  description,
}: {
  rows: RadarPlaylistRow[];
  title: string;
  description: string;
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
        <table className="min-w-[980px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Musica</th>
              <th className="px-4 py-3">Artistas</th>
              <th className="px-4 py-3">Playlists</th>
              <th className="px-4 py-3">Popularidade</th>
              <th className="px-4 py-3">Repeticao</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Acao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma faixa encontrada nessa leitura.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.trackId} className="hover:bg-muted/10">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-xl bg-muted"
                        style={coverStyle(row.coverUrl)}
                      />
                      <div className="font-semibold">{row.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm">{row.artists}</td>
                  <td className="px-4 py-4 text-sm">{row.playlistsLabel}</td>
                  <td className="px-4 py-4 text-sm font-medium">
                    {row.popularity}
                  </td>
                  <td className="px-4 py-4 text-sm">{row.repetitionLabel}</td>
                  <td className="px-4 py-4">
                    <StatusBadge tone={row.status.tone}>
                      {row.status.label}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={row.actionHref}
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
