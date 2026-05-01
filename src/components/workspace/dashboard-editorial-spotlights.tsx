import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import { cn } from "@/lib/utils";
import type { DashboardEditorialSpotlight } from "@/types/workspace";
import SpotifyPlaylistAddButton from "./spotify-playlist-add-button";
import StatusBadge from "./status-badge";

const toneRingClasses = {
  green: "border-emerald-500/25 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(8,12,10,0.94))]",
  red: "border-red-500/25 bg-[linear-gradient(180deg,rgba(248,113,113,0.16),rgba(12,8,8,0.94))]",
  blue: "border-sky-500/25 bg-[linear-gradient(180deg,rgba(56,189,248,0.16),rgba(8,11,14,0.94))]",
  purple: "border-violet-500/25 bg-[linear-gradient(180deg,rgba(167,139,250,0.16),rgba(11,8,14,0.94))]",
  yellow: "border-amber-500/25 bg-[linear-gradient(180deg,rgba(251,191,36,0.18),rgba(14,11,8,0.94))]",
  slate: "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(10,10,12,0.94))]",
} as const;

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

function getDecisionLine(spotlight: DashboardEditorialSpotlight) {
  if (spotlight.suggestedPlaylistName) {
    return `Entrar em ${spotlight.suggestedPlaylistName}`;
  }

  if (spotlight.tone === "red") {
    return "Revisar agora";
  }

  if (spotlight.tone === "yellow") {
    return "Observar de perto";
  }

  return "Adicionar agora";
}

function getFocusStat(spotlight: DashboardEditorialSpotlight) {
  return spotlight.stats[0] ?? spotlight.badge;
}

export default function DashboardEditorialSpotlights({
  spotlights,
}: {
  spotlights: DashboardEditorialSpotlight[];
}) {
  if (spotlights.length === 0) {
    return null;
  }

  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Curadoria editorial
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Leituras que merecem acao</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Cards mais diretos para decidir rapido o que entra, o que observa e o que revisa.
        </p>
      </div>

      <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
        {spotlights.map((spotlight) => (
          <article
            key={`${spotlight.title}-${spotlight.trackName}`}
            className={cn(
              "group relative flex min-h-[300px] flex-col overflow-hidden rounded-[26px] border p-5 text-white shadow-[0_18px_42px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-1",
              toneRingClasses[spotlight.tone],
            )}
          >
            <div
              className="absolute inset-0 opacity-20 transition duration-300 group-hover:opacity-30"
              style={coverStyle(spotlight.coverUrl)}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,9,0.06),rgba(5,7,9,0.92))]" />

            <div className="relative flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-white/50">
                  {spotlight.title}
                </div>
                <StatusBadge tone={spotlight.tone}>{spotlight.badge}</StatusBadge>
              </div>
              <div
                className="h-16 w-16 shrink-0 rounded-2xl border border-white/10 bg-muted shadow-[0_12px_24px_rgba(0,0,0,0.25)]"
                style={coverStyle(spotlight.coverUrl)}
              />
            </div>

            <div className="relative mt-6 min-w-0">
              <h3 className="truncate text-xl font-semibold">{spotlight.trackName}</h3>
              <p className="truncate text-sm text-white/68">
                {spotlight.artists}
              </p>
            </div>

            <div className="relative mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                Decisao
              </div>
              <div className="mt-2 text-base font-semibold text-white">
                {getDecisionLine(spotlight)}
              </div>
              <div className="mt-2 text-sm text-white/65">
                {getFocusStat(spotlight)}
              </div>
            </div>

            <div className="relative mt-auto flex flex-wrap gap-2 pt-6">
              <SpotifyPlaylistAddButton
                spotifyTrackId={spotlight.spotifyTrackId}
                suggestedPlaylistName={spotlight.suggestedPlaylistName}
                label="Add playlist"
                compact
              />
              <Link
                href={spotlight.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-sm font-medium text-white transition hover:bg-black/40"
              >
                Abrir no Spotify
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </Container>
  );
}
