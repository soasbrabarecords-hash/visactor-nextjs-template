import Link from "next/link";
import { ArrowUpRight, Flame } from "lucide-react";
import Container from "@/components/container";
import type { RadarMusicRow } from "@/types/workspace";
import SpotifyPlaylistAddButton from "./spotify-playlist-add-button";
import { getRadarTrendSignal } from "./radar-music-trend-helpers";
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

function getMovementLabel(track: RadarMusicRow) {
  if (track.rankChange === null) {
    return track.movement.label;
  }

  if (track.rankChange > 0) {
    return `+${track.rankChange} no chart`;
  }

  if (track.rankChange < 0) {
    return `${track.rankChange} no chart`;
  }

  return "Estavel no chart";
}

export default function RadarMusicTikTokStrip({
  snapshotDate,
  tracks,
}: {
  snapshotDate: string | null;
  tracks: RadarMusicRow[];
}) {
  if (tracks.length === 0) {
    return null;
  }

  return (
    <Container className="border-b border-border/70 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="blue">
              <Flame className="mr-1 h-3.5 w-3.5" />
              TikTok viral
            </StatusBadge>
            {snapshotDate ? (
              <StatusBadge tone="slate">{snapshotDate}</StatusBadge>
            ) : null}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">TikTok puxando no radar</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Faixas que ja aparecem no teu radar e tambem estao no viral publico do TikTok.
          </p>
        </div>
      </div>

      <div className="grid gap-3 laptop:grid-cols-2 xl:grid-cols-4">
        {tracks.slice(0, 4).map((track) => {
          const signal = getRadarTrendSignal(track);

          return (
            <article
              key={`tiktok-${track.trackId}`}
              className="relative overflow-hidden rounded-[22px] border border-sky-500/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.12),rgba(10,14,18,0.96))] p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.18)]"
            >
              <div
                className="absolute inset-0 opacity-[0.14]"
                style={coverStyle(track.coverUrl)}
              />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="blue" className="px-2 py-0.5 text-[10px]">
                        TikTok #{track.tiktokRank ?? "—"}
                      </StatusBadge>
                      <StatusBadge tone={signal.tone} className="px-2 py-0.5 text-[10px]">
                        {signal.label}
                      </StatusBadge>
                    </div>
                    <h3 className="mt-3 truncate text-base font-semibold">{track.name}</h3>
                    <p className="truncate text-xs text-white/60">{track.artists}</p>
                  </div>
                  <div
                    className="h-12 w-12 shrink-0 rounded-2xl border border-white/10 bg-white/5"
                    style={coverStyle(track.coverUrl)}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-white/65">
                    {signal.helper} · {getMovementLabel(track)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <SpotifyPlaylistAddButton
                      spotifyTrackId={track.spotifyTrackId}
                      suggestedPlaylistName={null}
                      compact
                      className="h-8 w-8 rounded-full border-white/10 bg-white/5 px-0 text-white"
                    />
                    <Link
                      href={track.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Container>
  );
}
