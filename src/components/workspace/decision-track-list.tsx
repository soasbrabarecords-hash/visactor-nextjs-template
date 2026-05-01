import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import { cn } from "@/lib/utils";
import type { DecisionTrack } from "@/types/workspace";
import StatusBadge from "./status-badge";

const toneCardClasses = {
  green: "border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(10,13,11,0.96))] text-white",
  yellow: "border-amber-500/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.12),rgba(13,11,9,0.96))] text-white",
  red: "border-red-500/20 bg-[linear-gradient(180deg,rgba(248,113,113,0.12),rgba(13,9,9,0.96))] text-white",
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

export default function DecisionTrackList({
  title,
  description,
  tracks,
  tone,
}: {
  title: string;
  description: string;
  tracks: DecisionTrack[];
  tone: "green" | "yellow" | "red";
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="grid gap-4 desktop:grid-cols-3">
        {tracks.length === 0 ? (
          <article className="rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted-foreground desktop:col-span-3">
            Nenhuma faixa disponivel nesta fila agora.
          </article>
        ) : (
          tracks.map((track) => (
            <article
              key={track.trackId}
              className={cn(
                "overflow-hidden rounded-[26px] border p-4 shadow-[0_18px_42px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-0.5",
                toneCardClasses[tone],
              )}
            >
              <div className="flex gap-4">
                <div
                  className="h-20 w-20 rounded-[22px] border border-white/10 bg-muted shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
                  style={coverStyle(track.coverUrl)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold">{track.name}</div>
                      <div className="truncate text-sm text-white/70">
                        {track.artists}
                      </div>
                    </div>
                    <StatusBadge tone={tone}>{track.movement.label}</StatusBadge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge tone={track.movement.tone}>
                      {track.movement.icon} {track.chartDeltaLabel}
                    </StatusBadge>
                    <StatusBadge tone={track.lowSaturation ? "green" : "blue"}>
                      {track.lowSaturation ? "Baixa saturacao" : "Radar quente"}
                    </StatusBadge>
                    {track.suggestedPlaylistName ? (
                      <StatusBadge tone="purple">
                        Boa para {track.suggestedPlaylistName}
                      </StatusBadge>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-white/75">
                {track.accountFitContext}
              </p>

              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    "h-full rounded-full",
                    tone === "green"
                      ? "bg-emerald-400"
                      : tone === "yellow"
                        ? "bg-amber-400"
                        : "bg-red-400",
                  )}
                  style={{ width: `${Math.max(18, track.decisionScore)}%` }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-white/70">
                <span>Score {track.decisionScore}</span>
                <Link
                  href={track.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-white transition hover:bg-black/35"
                >
                  Abrir
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </Container>
  );
}
