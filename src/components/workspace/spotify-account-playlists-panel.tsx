"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, LogOut, Music2, RefreshCw } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import StatusBadge from "./status-badge";

type SpotifyAccountPlaylist = {
  id: string;
  name: string;
  ownerName: string;
  imageUrl: string | null;
  tracksTotal: number;
  spotifyUrl: string;
  isPublic: boolean;
  isCollaborative: boolean;
};

type SpotifyPlaylistsResponse =
  | {
      connected: true;
      playlists: SpotifyAccountPlaylist[];
    }
  | {
      connected: false;
      playlists: [];
      message: string;
    };

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

export default function SpotifyAccountPlaylistsPanel({
  eyebrow = "Spotify na curadoria",
  title = "Playlists da conta",
  description = "Conecte o Spotify para puxar suas playlists e usar o Radar Music como base de decisao editorial.",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  const [data, setData] = useState<SpotifyPlaylistsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPlaylists = useCallback(() => {
    startTransition(async () => {
      setError(null);

      try {
        const response = await fetch("/api/spotify/me/playlists", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Nao foi possivel carregar as playlists do Spotify.");
        }

        const payload = (await response.json()) as SpotifyPlaylistsResponse;
        setData(payload);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Nao foi possivel carregar as playlists do Spotify.",
        );
      }
    });
  }, [startTransition]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const playlists = data?.connected ? data.playlists : [];

  return (
    <Container className="border-b border-border py-6">
      <div className="grid gap-4 laptop:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-2xl border border-border bg-card/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {eyebrow}
              </div>
              <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
            <StatusBadge tone={data?.connected ? "green" : "blue"}>
              {data?.connected ? "Conectado" : "Conectar"}
            </StatusBadge>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <a href="/api/spotify/auth/login">
                <Music2 className="h-4 w-4" />
                Conectar Spotify
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={loadPlaylists}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Atualizar
            </Button>
            {data?.connected ? (
              <Button asChild variant="outline">
                <a href="/api/spotify/auth/logout">
                  <LogOut className="h-4 w-4" />
                  Desconectar
                </a>
              </Button>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 text-sm text-red-400">{error}</p>
          ) : null}
          {data && !data.connected ? (
            <p className="mt-4 text-sm text-muted-foreground">{data.message}</p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-border bg-card/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Playlists importadas
              </div>
              <h3 className="mt-2 text-xl font-semibold">
                {data?.connected
                  ? `${formatCount(playlists.length)} playlists encontradas`
                  : "Aguardando conexao"}
              </h3>
            </div>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </div>

          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {playlists.length > 0 ? (
              playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/40 px-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="h-12 w-12 shrink-0 rounded-lg bg-muted"
                      style={coverStyle(playlist.imageUrl)}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{playlist.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCount(playlist.tracksTotal)} tracks · {playlist.ownerName}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {playlist.isCollaborative ? (
                      <StatusBadge tone="purple">Collab</StatusBadge>
                    ) : playlist.isPublic ? (
                      <StatusBadge tone="green">Publica</StatusBadge>
                    ) : (
                      <StatusBadge tone="slate">Privada</StatusBadge>
                    )}
                    <Link
                      href={playlist.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-primary hover:bg-muted/40"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-border bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
                Conecte o Spotify para listar as playlists da conta aqui.
              </div>
            )}
          </div>
        </article>
      </div>
    </Container>
  );
}
