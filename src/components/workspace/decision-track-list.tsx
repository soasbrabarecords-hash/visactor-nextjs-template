import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
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
              className="rounded-2xl border border-border bg-card/70 p-4"
            >
              <div className="flex gap-4">
                <div
                  className="h-16 w-16 rounded-2xl bg-muted"
                  style={coverStyle(track.coverUrl)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{track.name}</div>
                      <div className="truncate text-sm text-muted-foreground">
                        {track.artists}
                      </div>
                    </div>
                    <StatusBadge tone={tone}>{track.movement.label}</StatusBadge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge tone={track.movement.tone}>
                      {track.movement.icon} {track.chartDeltaLabel}
                    </StatusBadge>
                    <StatusBadge tone={track.lowSaturation ? "green" : "blue"}>
                      {track.lowSaturation ? "Baixa saturacao" : "Radar quente"}
                    </StatusBadge>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>Score {track.decisionScore}</span>
                <Link
                  href={track.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
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
