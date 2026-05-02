import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import type { DecisionTrack, RadarMusicRow } from "@/types/workspace";
import { cn } from "@/lib/utils";
import SpotifyPlaylistAddButton from "./spotify-playlist-add-button";
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

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function getMovementValue(row: RadarMusicRow) {
  if (row.previousRank === null || row.rankChange === null) {
    return "NEW";
  }

  if (row.rankChange > 0) {
    return `↑ ${row.rankChange}`;
  }

  if (row.rankChange < 0) {
    return `↓ ${Math.abs(row.rankChange)}`;
  }

  return "—";
}

function getMovementTone(row: RadarMusicRow) {
  if (row.previousRank === null || row.rankChange === null) {
    return "purple";
  }

  if (row.rankChange > 0) {
    return "green";
  }

  if (row.rankChange < 0) {
    return "red";
  }

  return "slate";
}

function formatDailyStreams(value: number | null) {
  return value === null ? "Sem dado de streams" : formatCount(value);
}

function getOpportunityTags(row: RadarMusicRow) {
  const tags: string[] = [];

  if (row.previousRank === null) {
    tags.push("Nova entrada");
  }

  if (row.lowSaturation) {
    tags.push("Baixa saturacao");
  }

  if (row.popularity >= 85) {
    tags.push("Hit forte");
  }

  if (row.rankChange !== null && row.rankChange > 0) {
    tags.push("Subindo");
  }

  return tags.slice(0, 2);
}

export default function RadarMusicTable({
  rows,
  decisionTracks,
}: {
  rows: RadarMusicRow[];
  decisionTracks: DecisionTrack[];
}) {
  const decisionByTrackId = new Map(
    decisionTracks.map((track) => [track.trackId, track]),
  );

  return (
    <Container className="border-b border-border/70 py-6">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
          Mesa completa
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-white">Fila completa de decisão</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Menos coluna fria, mais leitura direta de fit, momentum e ação.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_24px_60px_-36px_rgba(15,23,42,0.9)]">
        <table className="min-w-[1080px] w-full divide-y divide-white/10 text-left">
          <thead className="bg-white/[0.03]">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Pos.</th>
              <th className="px-4 py-3">Mov.</th>
              <th className="px-4 py-3">Faixa</th>
              <th className="px-4 py-3">Streams</th>
              <th className="px-4 py-3">Decisão</th>
              <th className="px-4 py-3">TikTok</th>
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
                  Nenhuma faixa encontrada para esse filtro agora.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const decisionTrack = decisionByTrackId.get(row.trackId);

                return (
                  <tr key={row.trackId} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 align-top">
                      <div className="text-2xl font-semibold tracking-tight text-white">
                        #{row.rank}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div
                        className={cn(
                          "inline-flex min-w-[64px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                          row.previousRank === null || row.rankChange === null
                            ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                            : row.rankChange > 0
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : row.rankChange < 0
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                : "border-white/10 bg-white/5 text-white/45",
                        )}
                      >
                        {getMovementValue(row)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-12 w-12 shrink-0 rounded-xl border border-border bg-muted shadow-lg"
                          style={coverStyle(row.coverUrl)}
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="truncate font-semibold">{row.name}</div>
                          <div className="max-w-[300px] truncate text-sm text-muted-foreground">
                            {row.artists}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {getOpportunityTags(row).map((tag) => (
                              <StatusBadge
                                key={tag}
                                tone={
                                  tag === "Subindo" || tag === "Hit forte"
                                    ? "green"
                                    : tag === "Nova entrada"
                                      ? "purple"
                                      : "yellow"
                                }
                                className="normal-case tracking-[0.04em]"
                              >
                                {tag}
                              </StatusBadge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm font-medium">
                      <div className={row.dailyStreams === null ? "text-muted-foreground" : ""}>
                        {formatDailyStreams(row.dailyStreams)}
                      </div>
                      <div
                        className={`mt-1 text-xs ${row.streamRank === null ? "text-muted-foreground" : "text-slate-300"}`}
                      >
                        {row.dailyStreams === null
                          ? "Sem dado de streams"
                          : row.streamRank === null
                            ? "—"
                            : `#${row.streamRank} por streams`}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm font-medium">
                        {decisionTrack?.decisionScore ?? row.opportunityScore}/100
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {decisionTrack?.fitLabel ?? row.fitLabel}
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <div>{decisionTrack?.accountFitContext ?? "Abrir e avaliar"}</div>
                        {decisionTrack?.suggestedPlaylistName ? (
                          <div className="text-violet-300">
                            Boa para {decisionTrack.suggestedPlaylistName}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-2">
                        {row.tiktokViral ? (
                          <StatusBadge tone="blue">
                            TikTok {row.tiktokRank !== null ? `#${row.tiktokRank}` : "viral"}
                          </StatusBadge>
                        ) : (
                          <div className="text-xs text-muted-foreground">Sem cruzamento agora</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {row.tiktokMovementLabel ?? `${row.daysOnRadar} dias no radar`}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <SpotifyPlaylistAddButton
                          spotifyTrackId={decisionTrack?.spotifyTrackId ?? row.spotifyTrackId}
                          suggestedPlaylistName={decisionTrack?.suggestedPlaylistName ?? null}
                          label="Add"
                          compact
                        />
                        <Link
                          href={row.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
                        >
                          Abrir
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
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
