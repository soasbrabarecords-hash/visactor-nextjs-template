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
      <section className="rounded-[32px] border border-white/70 bg-white/[0.66] p-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.035] dark:shadow-[0_24px_90px_rgba(0,0,0,0.28)] tablet:p-5">
        <div className="mb-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Repertorio em movimento
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-border/80 bg-background/[0.72] shadow-inner shadow-slate-950/[0.03] dark:border-white/10 dark:bg-black/[0.18]">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full divide-y divide-border/70 text-left">
          <thead className="bg-muted/35 dark:bg-white/[0.035]">
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
                <tr
                  key={row.trackId}
                  className="transition-colors hover:bg-sky-500/[0.055] dark:hover:bg-white/[0.035]"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-2xl border border-border/70 bg-muted shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-white/10"
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
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3.5 py-2 text-sm font-medium text-primary shadow-sm transition hover:-translate-y-0.5 hover:bg-primary/[0.08] dark:border-white/10 dark:bg-white/[0.035]"
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
      </div>
      </section>
    </Container>
  );
}
