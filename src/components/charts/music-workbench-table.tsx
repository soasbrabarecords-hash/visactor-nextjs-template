"use client";

import { useState } from "react";
import { ExternalLink, SlidersHorizontal } from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";
import Container from "@/components/container";
import { cn } from "@/lib/utils";
import type { MusicWorkbenchTrack } from "@/types/music-charts";

type WorkbenchFilter =
  | "all"
  | "movers"
  | "new"
  | "recurring"
  | "low-saturation"
  | "high-traction"
  | "explicit";

const FILTERS: Array<{
  value: WorkbenchFilter;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "movers", label: "Movers" },
  { value: "new", label: "Novas" },
  { value: "recurring", label: "Recorrentes" },
  { value: "low-saturation", label: "Baixa saturacao" },
  { value: "high-traction", label: "Alta tracao" },
  { value: "explicit", label: "Explicit" },
];

function getVisibleTracks(
  tracks: MusicWorkbenchTrack[],
  filter: WorkbenchFilter,
) {
  switch (filter) {
    case "movers":
      return tracks.filter((track) => track.isMover);
    case "new":
      return tracks.filter((track) => track.isNewEntry);
    case "recurring":
      return tracks.filter((track) => track.isRecurring);
    case "low-saturation":
      return tracks.filter((track) => track.lowSaturation);
    case "high-traction":
      return tracks.filter((track) => track.highTraction);
    case "explicit":
      return tracks.filter((track) => track.explicit);
    default:
      return tracks;
  }
}

function getScoreBarClass(score: number) {
  if (score >= 80) {
    return "bg-emerald-500";
  }

  if (score >= 65) {
    return "bg-primary";
  }

  return "bg-amber-500";
}

export default function MusicWorkbenchTable({
  tracks,
  title = "Workbench de Curadoria",
  description = "Mesa de trabalho para filtrar o radar, priorizar faixas e decidir rapidamente o que merece entrar, testar ou acompanhar.",
  emptyMessage = "Sem sinal suficiente para montar o workbench deste recorte agora.",
}: {
  tracks: MusicWorkbenchTrack[];
  title?: string;
  description?: string;
  emptyMessage?: string;
}) {
  const [activeFilter, setActiveFilter] = useState<WorkbenchFilter>("all");
  const visibleTracks = getVisibleTracks(tracks, activeFilter);

  return (
    <Container className="py-4">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 laptop:flex-row laptop:items-end laptop:justify-between">
          <div>
            <ChartTitle title={title} icon={SlidersHorizontal} />
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            Mostrando {visibleTracks.length} de {tracks.length} faixas no radar.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                activeFilter === filter.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted/30",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full divide-y divide-border text-left">
            <thead className="bg-muted/30">
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Faixa</th>
                <th className="px-4 py-3 font-medium">Popularidade</th>
                <th className="px-4 py-3 font-medium">Recorrencia</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Oportunidade</th>
                <th className="px-4 py-3 font-medium">Tags</th>
                <th className="px-4 py-3 font-medium">Spotify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleTracks.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                visibleTracks.map((track) => (
                  <tr key={track.id}>
                    <td className="px-4 py-4 text-sm font-medium text-muted-foreground">
                      {track.rank}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {track.coverUrl ? (
                          <div
                            className="h-12 w-12 shrink-0 rounded-xl"
                            style={{
                              backgroundImage: `url(${track.coverUrl})`,
                              backgroundPosition: "center",
                              backgroundSize: "cover",
                            }}
                          />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-xl bg-muted" />
                        )}

                        <div className="min-w-0">
                          <div className="font-medium">{track.name}</div>
                          <div className="truncate text-sm text-muted-foreground">
                            {track.artists}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {track.albumName} · {track.durationLabel}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.max(0, Math.min(track.popularity, 100))}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {track.popularity}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium">
                        {track.signalCount} sinais
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {track.tractionLabel}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="inline-flex rounded-full border border-border px-2.5 py-1 text-xs font-medium">
                        {track.sourceLabel}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              getScoreBarClass(track.opportunityScore),
                            )}
                            style={{
                              width: `${Math.max(0, Math.min(track.opportunityScore, 100))}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {track.opportunityScore}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {track.saturationLabel}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-[240px] flex-wrap gap-1.5">
                        {track.tags.map((tag) => (
                          <span
                            key={`${track.id}-${tag}`}
                            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={track.spotifyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Abrir
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Container>
  );
}
