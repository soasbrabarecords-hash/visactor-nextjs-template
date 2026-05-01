import Link from "next/link";
import { ExternalLink, Radio, Sparkles } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import type { PrimaryAction } from "@/types/workspace";
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

export default function PrimaryActionCard({
  action,
}: {
  action: PrimaryAction;
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Acao principal do dia
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Decisao numero um</h2>
      </div>

      {action.track ? (
        <article className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#0a0f0d] text-white shadow-[0_28px_70px_rgba(0,0,0,0.26)]">
          <div
            className="absolute inset-0 opacity-30"
            style={coverStyle(action.track.coverUrl)}
          />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(6,8,8,0.96),rgba(6,8,8,0.84)_50%,rgba(6,8,8,0.7))]" />

          <div className="relative grid gap-6 p-6 laptop:grid-cols-[132px_1fr_auto] laptop:items-center laptop:p-8">
            <div
              className="h-32 w-32 rounded-[26px] border border-white/10 bg-muted shadow-[0_18px_36px_rgba(0,0,0,0.35)]"
              style={coverStyle(action.track.coverUrl)}
            />

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone="green">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Adicionar agora
                </StatusBadge>
                <StatusBadge tone={action.track.movement.tone}>
                  {action.track.movement.icon} {action.track.chartDeltaLabel}
                </StatusBadge>
                <StatusBadge tone="yellow">
                  Score {action.track.decisionScore}
                </StatusBadge>
              </div>
              <h3 className="mt-5 text-3xl font-semibold tracking-tight laptop:text-4xl">
                {action.track.name}
              </h3>
              <p className="mt-2 text-lg text-white/70">{action.track.artists}</p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
                {action.reason}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75">
                  {action.track.accountFitContext}
                </div>
                {action.track.suggestedPlaylistName ? (
                  <div className="rounded-full border border-[#1ed760]/20 bg-[#1ed760]/12 px-3 py-1.5 text-xs text-[#a5f2bd]">
                    Boa para {action.track.suggestedPlaylistName}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <SpotifyPlaylistAddButton
                spotifyTrackId={action.track.spotifyTrackId}
                suggestedPlaylistName={action.track.suggestedPlaylistName}
                label="Adicionar agora"
              />
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10"
              >
                <Link href={action.track.spotifyUrl} target="_blank" rel="noreferrer">
                  <Radio className="mr-1 h-4 w-4" />
                  Abrir Spotify
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </article>
      ) : (
        <article className="rounded-[28px] border border-border bg-card/80 p-6 text-sm text-muted-foreground">
          Ainda nao existe uma faixa com prioridade maxima definida para hoje.
        </article>
      )}
    </Container>
  );
}
