import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import type { DecisionTrack, RadarMusicRow } from "@/types/workspace";
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

function formatPeakLabel() {
  return "—";
}

function formatDaysOnChart(value: number) {
  return `${value} dias`;
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
    <Container className="border-b border-border py-6">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Chart principal BR
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Ranking do radar</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Leitura operacional cruzando Spotify Charts, TikTok Brasil e decisao editorial da conta.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-border bg-card/60 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.9)]">
        <table className="min-w-[1180px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Pos.</th>
              <th className="px-4 py-3">Movimento</th>
              <th className="px-4 py-3">Musica</th>
              <th className="px-4 py-3">Artistas</th>
              <th className="px-4 py-3">Streams 24h</th>
              <th className="px-4 py-3">Peak</th>
              <th className="px-4 py-3">Dias</th>
              <th className="px-4 py-3">Oportunidade</th>
              <th className="px-4 py-3">Acao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma faixa encontrada para esse filtro agora.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const decisionTrack = decisionByTrackId.get(row.trackId);

                return (
                  <tr key={row.trackId} className="hover:bg-muted/10">
                    <td className="px-4 py-3 align-top">
                      <div className="text-2xl font-semibold tracking-tight text-white">
                        #{row.rank}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <StatusBadge
                          tone={getMovementTone(row)}
                          className="min-w-[70px] justify-center"
                        >
                          {getMovementValue(row)}
                        </StatusBadge>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-12 w-12 shrink-0 rounded-xl border border-border bg-muted shadow-lg"
                          style={coverStyle(row.coverUrl)}
                        />
                        <div className="min-w-0 space-y-1">
                          <div>
                            <div className="truncate font-semibold">{row.name}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {row.tiktokViral && row.tiktokRank !== null ? (
                              <StatusBadge tone="blue">TikTok #{row.tiktokRank}</StatusBadge>
                            ) : null}
                            {row.previousRank === null ? (
                              <StatusBadge tone="purple">NEW</StatusBadge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="max-w-[220px] text-sm text-muted-foreground">
                        {row.artists}
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
                    <td className="px-4 py-3 align-top text-sm text-muted-foreground">
                      {formatPeakLabel()}
                    </td>
                    <td className="px-4 py-3 align-top text-sm">{formatDaysOnChart(row.daysOnRadar)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm font-medium">
                        {decisionTrack?.decisionScore ?? row.opportunityScore}/100
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
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
                        {row.tiktokViral ? (
                          <StatusBadge
                            tone="blue"
                            className="normal-case tracking-[0.04em]"
                          >
                            Viral no TikTok
                          </StatusBadge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-2">
                        {decisionTrack?.suggestedPlaylistName ? (
                          <div className="text-xs text-muted-foreground">
                            Boa para {decisionTrack.suggestedPlaylistName}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {decisionTrack?.accountFitContext ?? "Abrir e avaliar"}
                          </div>
                        )}
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
                            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-primary hover:bg-muted/40"
                          >
                            Abrir
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
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
