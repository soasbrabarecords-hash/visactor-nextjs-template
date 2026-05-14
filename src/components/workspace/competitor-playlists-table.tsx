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
    label: "Baixo sinal",
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
      <section className="rounded-[32px] border border-white/70 bg-white/[0.66] p-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.035] dark:shadow-[0_24px_90px_rgba(0,0,0,0.28)] tablet:p-5">
        <div className="mb-5 flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Playlists Analytics
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Mapa de performance
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Uma visao objetiva das playlists monitoradas para comparar forca,
              repertorio e oportunidade.
            </p>
          </div>
          <StatusBadge tone="blue">Benchmark ativo</StatusBadge>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-border/80 bg-background/[0.72] shadow-inner shadow-slate-950/[0.03] dark:border-white/10 dark:bg-black/[0.18]">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full divide-y divide-border/70 text-left">
          <thead className="bg-muted/35 dark:bg-white/[0.035]">
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
                  Adicione playlists para iniciar a leitura de mercado.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const diagnosis = getDiagnosis(row);

                return (
                  <tr
                    key={row.playlist.id}
                    className="transition-colors hover:bg-emerald-500/[0.055] dark:hover:bg-white/[0.035]"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-12 w-12 shrink-0 rounded-2xl border border-border/70 bg-muted shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-white/10"
                          style={coverStyle(row.playlist.coverUrl)}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {row.playlist.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Playlist monitorada
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm">{row.followersLabel}</td>
                    <td className="px-4 py-3.5 text-sm">{row.tracksLabel}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold">
                      {row.scoreLabel}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <StatusBadge tone={diagnosis.tone}>
                          {diagnosis.label}
                        </StatusBadge>
                        <div className="max-w-[320px] text-xs text-muted-foreground">
                          {diagnosis.note}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/playlists/${row.playlist.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3.5 py-2 text-sm font-medium text-primary shadow-sm transition hover:-translate-y-0.5 hover:bg-primary/[0.08] dark:border-white/10 dark:bg-white/[0.035]"
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
      </div>
      </section>
    </Container>
  );
}
