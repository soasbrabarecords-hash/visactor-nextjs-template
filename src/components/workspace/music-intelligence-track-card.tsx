import { ArrowUpRight, Disc3, Plus, Radio, ShieldAlert } from "lucide-react";
import Link from "next/link";
import SpotifyPlaylistAddButton from "@/components/workspace/spotify-playlist-add-button";
import type { MusicIntelligenceTrack } from "@/types/music-intelligence";

type MusicIntelligenceTrackCardProps = {
  track: MusicIntelligenceTrack;
  accent: "emerald" | "amber" | "rose" | "sky";
};

const ACCENTS = {
  emerald: {
    badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    bar: "bg-emerald-400",
  },
  amber: {
    badge: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
    bar: "bg-amber-400",
  },
  rose: {
    badge: "bg-rose-400/10 text-rose-300 ring-rose-400/20",
    bar: "bg-rose-400",
  },
  sky: {
    badge: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
    bar: "bg-sky-400",
  },
} as const;

function movementLabel(track: MusicIntelligenceTrack) {
  const market = track.primaryCountry === "GLOBAL" ? "Global" : "BR";

  if (track.isNewEntry) {
    return `Nova entrada · ${market}`;
  }

  if (track.movement7d === null || track.movement7d === 0) {
    return `Estável em 7d · ${market}`;
  }

  return track.movement7d > 0
    ? `↑ ${track.movement7d} em 7d · ${market}`
    : `↓ ${Math.abs(track.movement7d)} em 7d · ${market}`;
}

function positionLabel(track: MusicIntelligenceTrack) {
  const positions = (["BR", "GLOBAL"] as const).flatMap((country) => {
    const position = track.positions[country];
    return position
      ? [`${country === "GLOBAL" ? "Global" : "BR"} #${position}`]
      : [];
  });

  return positions.length > 0
    ? positions.join(" · ")
    : `#${track.currentPosition}`;
}

export function MusicIntelligenceTrackCard({
  track,
  accent,
}: MusicIntelligenceTrackCardProps) {
  const accentClasses = ACCENTS[accent];
  const coverStyle = track.coverUrl
    ? {
        backgroundImage: `linear-gradient(145deg, rgba(5,8,14,0.08), rgba(5,8,14,0.42)), url(${track.coverUrl})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : undefined;

  return (
    <article className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 transition duration-200 hover:border-white/[0.13] hover:bg-white/[0.045]">
      <div className="flex min-w-0 items-start gap-3">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.055] text-white/25 ring-1 ring-inset ring-white/10"
          style={coverStyle}
        >
          {track.coverUrl ? null : <Disc3 className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-semibold text-white">
                {track.name}
              </h3>
              <p className="mt-0.5 truncate text-[11px] text-white/60">
                {track.artists}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] uppercase tracking-[0.12em] text-white/55">
                Score
              </div>
              <div className="text-base font-semibold tabular-nums text-white">
                {track.scores.opportunityScore}
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] ring-1 ring-inset ${accentClasses.badge}`}
            >
              {movementLabel(track)}
            </span>
            <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] text-white/55 ring-1 ring-inset ring-white/[0.07]">
              {positionLabel(track)}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-[11px] leading-[1.55] text-white/60">
        {track.explanation}
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.1em] text-white/55">
            <span>
              {track.action === "review"
                ? "Risco de ciclo"
                : "Opportunity score"}
            </span>
            <span>
              {track.action === "review"
                ? track.scores.saturationRisk
                : track.scores.opportunityScore}
              %
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${accentClasses.bar}`}
              style={{
                width: `${
                  track.action === "review"
                    ? track.scores.saturationRisk
                    : track.scores.opportunityScore
                }%`,
              }}
            />
          </div>
        </div>

        {track.action === "review" ? (
          <span
            aria-label="Faixa marcada para revisão"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-400/[0.07] text-rose-300/55 ring-1 ring-inset ring-rose-400/10"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
          </span>
        ) : track.spotifyTrackId ? (
          <SpotifyPlaylistAddButton
            spotifyTrackId={track.spotifyTrackId}
            suggestedPlaylistName={track.suggestedPlaylistName}
            ariaLabel={`Adicionar ${track.name} a uma playlist`}
            compact
            className="h-8 w-8 shrink-0 rounded-full border-white/[0.08] bg-white/[0.05] px-0 text-white shadow-none hover:bg-white/10"
          />
        ) : (
          <span
            aria-label="Ação de playlist indisponível"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.035] text-white/20 ring-1 ring-inset ring-white/[0.06]"
          >
            <Plus className="h-3.5 w-3.5" />
          </span>
        )}
        {track.spotifyUrl ? (
          <Link
            href={track.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Abrir ${track.name} no Spotify`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span
            aria-label="Link do Spotify indisponível"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/20"
          >
            <Radio className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </article>
  );
}
