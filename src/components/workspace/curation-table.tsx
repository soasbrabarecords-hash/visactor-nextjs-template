import type { ComponentProps } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import type { DecisionTrack } from "@/types/workspace";
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

function getActionVariant(
  action: DecisionTrack["recommendedAction"],
): ComponentProps<typeof Button>["variant"] {
  switch (action) {
    case "add":
      return "default";
    case "observe":
      return "secondary";
    case "remove":
      return "destructive";
    default:
      return "outline";
  }
}

function getSuggestedPlaylistLabel(row: DecisionTrack) {
  if (row.alreadyInPlaylists) {
    return "Playlist onde ja aparece";
  }

  if (row.fitLabel === "Fit alto") {
    return "Playlist principal do nicho";
  }

  if (row.lowSaturation) {
    return "Playlist de descoberta";
  }

  if (row.recurring) {
    return "Playlist de manutencao";
  }

  return "Testar em playlist menor";
}

export default function CurationTable({
  rows,
}: {
  rows: DecisionTrack[];
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Mesa de decisao
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Fila de curadoria</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Priorize o que entra, o que fica em observacao e o que pede ajuste
          usando score de decisao, fit e comportamento no radar.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
        <table className="min-w-[1220px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Faixa</th>
              <th className="px-4 py-3">Movimento</th>
              <th className="px-4 py-3">Popularidade</th>
              <th className="px-4 py-3">Chart</th>
              <th className="px-4 py-3">Fit</th>
              <th className="px-4 py-3">Playlist sugerida</th>
              <th className="px-4 py-3">Ja na base</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma recomendacao disponivel agora.
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
                      <div>
                        <div className="font-semibold">{row.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {row.artists}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge tone={row.movement.tone}>
                      {row.movement.icon} {row.movement.label}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium">
                    {row.popularity}
                  </td>
                  <td className="px-4 py-4 text-sm">{row.chartDeltaLabel}</td>
                  <td className="px-4 py-4">
                    <StatusBadge
                      tone={
                        row.fitLabel === "Fit alto"
                          ? "green"
                          : row.fitLabel === "Fit medio"
                            ? "yellow"
                            : "slate"
                      }
                    >
                      {row.fitLabel}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {getSuggestedPlaylistLabel(row)}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge tone={row.alreadyInPlaylists ? "blue" : "purple"}>
                      {row.alreadyInPlaylists ? "Ja aparece" : "Nova para a base"}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold">
                    <div>{row.decisionScore}</div>
                    <div className="mt-2 flex max-w-[260px] flex-wrap gap-2">
                      {row.scoreBreakdown.map((item) => (
                        <StatusBadge key={`${row.trackId}-${item.label}`} tone={item.tone}>
                          {item.label}
                        </StatusBadge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant={getActionVariant("add")}>
                        Adicionar
                      </Button>
                      <Button size="sm" variant={getActionVariant("observe")}>
                        Observar
                      </Button>
                      <Button size="sm" variant={getActionVariant("ignore")}>
                        Ignorar
                      </Button>
                      <Button size="sm" variant={getActionVariant("remove")}>
                        Remover
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={row.spotifyUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
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
