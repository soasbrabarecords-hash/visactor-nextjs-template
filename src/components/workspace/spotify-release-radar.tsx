"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  ExternalLink,
  Loader2,
  Music2,
  Pause,
  Play,
  Radio,
  Sparkles,
  Volume2,
  Waves,
} from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import SpotifyPlaylistAddButton from "@/components/workspace/spotify-playlist-add-button";
import StatusBadge from "@/components/workspace/status-badge";
import { cn } from "@/lib/utils";
import type { SpotifyReleaseRadarPageData } from "@/lib/spotify-release-radar-data";

type RadarOpportunity = SpotifyReleaseRadarPageData["opportunities"][number];

type WebPlaybackTrack = {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    images: Array<{ url: string }>;
  };
};

type WebPlaybackState = {
  paused: boolean;
  track_window: {
    current_track: WebPlaybackTrack;
  };
};

type PlayerReadyPayload = {
  device_id: string;
};

type PlayerErrorPayload = {
  message: string;
};

type SpotifyPlayerInstance = {
  addListener: <TPayload = unknown>(
    event: string,
    listener: (payload: TPayload) => void,
  ) => boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  togglePlay: () => Promise<void>;
  activateElement?: () => Promise<void> | void;
};

type SpotifyPlayerConstructor = new (config: {
  name: string;
  getOAuthToken: (callback: (token: string) => void) => void;
  volume: number;
}) => SpotifyPlayerInstance;

declare global {
  interface Window {
    Spotify?: {
      Player: SpotifyPlayerConstructor;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const WEB_PLAYER_NAME = "SO AS BRABA Web Player";

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

async function getPlaybackAccessToken() {
  const response = await fetch("/api/spotify/playback/token", {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    accessToken?: string;
    message?: string;
  };

  if (!response.ok || !payload.accessToken) {
    throw new Error(
      payload.message?.trim() ||
        "Nao foi possivel autorizar o player web do Spotify.",
    );
  }

  return payload.accessToken;
}

function getPlayButtonLabel({
  track,
  currentTrackId,
  isPaused,
  loadingTrackId,
}: {
  track: RadarOpportunity;
  currentTrackId: string | null;
  isPaused: boolean;
  loadingTrackId: string | null;
}) {
  if (loadingTrackId === track.id) {
    return "Abrindo...";
  }

  if (currentTrackId === track.spotifyTrackId) {
    return isPaused ? "Retomar aqui" : "Tocando aqui";
  }

  return "Ouvir aqui";
}

export default function SpotifyReleaseRadar({
  data,
}: {
  data: SpotifyReleaseRadarPageData;
}) {
  const connectHref = "/api/spotify/auth/login?next=/novidades";
  const [player, setPlayer] = useState<SpotifyPlayerInstance | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState("Carregando player web...");
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<RadarOpportunity | null>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [isTogglingPlayback, setIsTogglingPlayback] = useState(false);

  useEffect(() => {
    if (!data.connected) {
      return;
    }

    let cancelled = false;
    let playerInstance: SpotifyPlayerInstance | null = null;

    function applyPlaybackState(state: WebPlaybackState | null) {
      if (!state) {
        return;
      }

      const sdkTrack = state.track_window.current_track;

      setCurrentTrackId(sdkTrack.id ?? null);
      setIsPaused(state.paused);

      const matchedTrack =
        data.opportunities.find((track) => track.spotifyTrackId === sdkTrack.id) ?? null;

      if (matchedTrack) {
        setCurrentTrack(matchedTrack);
        return;
      }

      setCurrentTrack((current) =>
        current
          ? current
          : {
              id: sdkTrack.id ?? "spotify-current-track",
              spotifyTrackId: sdkTrack.id ?? "",
              name: sdkTrack.name,
              artists: sdkTrack.artists.map((artist) => artist.name).join(", "),
              coverUrl: sdkTrack.album.images?.[0]?.url ?? null,
              spotifyUrl: "#",
              popularity: 0,
              releaseName: "Playback atual",
              releaseDateLabel: "Spotify Web Player",
              freshnessLabel: "Agora",
              genreLabel: "Spotify",
              scoreLabel: "Player",
              fitLabel: "Playback",
              fitTone: "blue",
              signals: [],
              playlistNames: [],
              suggestedPlaylistName: null,
              reason: "Faixa em reproducao no player web do Spotify.",
            },
      );
    }

    async function initializePlayer() {
      const SpotifySDK = window.Spotify;

      if (!SpotifySDK?.Player || cancelled) {
        return;
      }

      setPlayerStatus("Conectando player web ao navegador...");

      playerInstance = new SpotifySDK.Player({
        name: WEB_PLAYER_NAME,
        volume: 0.8,
        getOAuthToken: (callback) => {
          void (async () => {
            try {
              const accessToken = await getPlaybackAccessToken();
              callback(accessToken);
            } catch (error) {
              if (!cancelled) {
                setPlayerError(
                  error instanceof Error
                    ? error.message
                    : "Nao foi possivel autorizar o Spotify Player.",
                );
              }
            }
          })();
        },
      });

      playerInstance.addListener<PlayerReadyPayload>("ready", ({ device_id }) => {
        if (cancelled) {
          return;
        }

        setDeviceId(device_id);
        setPlayerStatus("Player pronto. Clique em ouvir aqui para tocar no sistema.");
        setPlayerError(null);
      });

      playerInstance.addListener("not_ready", () => {
        if (cancelled) {
          return;
        }

        setDeviceId(null);
        setPlayerStatus("Player offline no navegador. Tente recarregar a pagina.");
      });

      playerInstance.addListener("player_state_changed", (state: WebPlaybackState | null) => {
        if (cancelled) {
          return;
        }

        applyPlaybackState(state);
      });

      playerInstance.addListener<PlayerErrorPayload>("initialization_error", ({ message }) => {
        if (cancelled) {
          return;
        }

        setPlayerError(message);
      });

      playerInstance.addListener<PlayerErrorPayload>("authentication_error", ({ message }) => {
        if (cancelled) {
          return;
        }

        setPlayerError(`${message} Reconecte o Spotify para renovar as permissoes do player.`);
      });

      playerInstance.addListener<PlayerErrorPayload>("account_error", ({ message }) => {
        if (cancelled) {
          return;
        }

        setPlayerError(`${message} O player completo no navegador exige Spotify Premium.`);
      });

      playerInstance.addListener<PlayerErrorPayload>("playback_error", ({ message }) => {
        if (cancelled) {
          return;
        }

        setPlayerError(message);
      });

      const connected = await playerInstance.connect();

      if (!connected && !cancelled) {
        setPlayerError("O Spotify nao conseguiu conectar o player web neste navegador.");
      }

      if (!cancelled) {
        setPlayer(playerInstance);
      }
    }

    if (window.Spotify?.Player) {
      void initializePlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = () => {
        void initializePlayer();
      };

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://sdk.scdn.co/spotify-player.js"]',
      );

      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      playerInstance?.disconnect();
    };
  }, [data.connected, data.opportunities]);

  async function handlePlayTrack(track: RadarOpportunity) {
    if (!player || !deviceId) {
      setPlayerError(
        "O player ainda esta inicializando. Espere alguns segundos e tente novamente.",
      );
      return;
    }

    setLoadingTrackId(track.id);
    setPlayerError(null);

    try {
      await player.activateElement?.();

      const response = await fetch("/api/spotify/playback/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId,
          spotifyTrackId: track.spotifyTrackId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.message?.trim() ||
            "Nao foi possivel iniciar a musica dentro do sistema.",
        );
      }

      setCurrentTrack(track);
      setCurrentTrackId(track.spotifyTrackId);
      setIsPaused(false);
      setPlayerStatus(`Tocando ${track.name} no player web.`);
    } catch (error) {
      setPlayerError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel iniciar a musica dentro do sistema.",
      );
    } finally {
      setLoadingTrackId(null);
    }
  }

  async function handleTogglePlayback() {
    if (!player) {
      return;
    }

    setIsTogglingPlayback(true);

    try {
      await player.togglePlay();
    } catch (error) {
      setPlayerError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel alternar o playback.",
      );
    } finally {
      setIsTogglingPlayback(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_18%),radial-gradient(circle_at_80%_18%,rgba(34,197,94,0.12),transparent_20%),linear-gradient(180deg,#03111f_0%,#020617_100%)]">
      <section className="border-b border-white/8">
        <Container className="py-8">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.8)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.16),transparent_32%)]" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="blue">Novidades da conta</StatusBadge>
                  <StatusBadge tone="green">
                    {data.accountSummary.playlistCount} playlists lidas
                  </StatusBadge>
                  <StatusBadge tone="purple">
                    {data.accountSummary.followedArtistsCount} artistas seguidos
                  </StatusBadge>
                </div>

                <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white">
                  Uma leitura editorial do que voce mais ouve, do que seus artistas soltaram
                  agora e do que ainda esta faltando nas playlists.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                  A pagina cruza top artistas, top faixas, artistas seguidos e a estrutura
                  real das suas playlists para apontar releases com gap de curadoria.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    asChild
                    className="rounded-full bg-[#1ed760] px-5 font-semibold text-black hover:bg-[#35e26c]"
                  >
                    <a href={connectHref}>
                      <Music2 className="h-4 w-4" />
                      {data.connected ? "Reconectar Spotify" : "Conectar Spotify"}
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-white/10 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link href="/curadoria">
                      Abrir curadoria
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                {data.message ? (
                  <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    {data.message}
                  </div>
                ) : null}
              </div>
            </article>

            <article className="rounded-[30px] border border-white/10 bg-black/20 p-6">
              <div className="flex items-center gap-2 text-white/72">
                <Waves className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.22em]">
                  Leitura da base
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {data.metrics.map((metric) => (
                  <div
                    key={metric.title}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-white/42">
                      {metric.title}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {metric.value}
                    </div>
                    <p className="mt-1 text-sm text-white/58">{metric.helper}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-white/65">
                <div className="text-xs uppercase tracking-[0.18em] text-white/42">
                  DNA atual
                </div>
                <p className="mt-2">
                  {data.accountSummary.dominantGenreLabel
                    ? `${data.accountSummary.dominantGenreLabel} puxa a frente da conta agora.`
                    : "Ainda sem genero dominante claro nas playlists lidas."}
                </p>
                <p className="mt-2">
                  {data.accountSummary.trackCount > 0
                    ? `${data.accountSummary.trackCount} faixas unicas mapeadas para comparar novidades com a sua base.`
                    : "Quando houver playlists proprias lidas, o painel passa a marcar o que ja entrou e o que ainda esta faltando."}
                </p>
              </div>
            </article>
          </div>
        </Container>
      </section>

      {!data.connected ? (
        <Container className="py-10">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/8">
              <Radio className="h-6 w-6 text-white/72" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-white">
              Conecte o Spotify para ativar essa leitura
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/62">
              Assim que a conta estiver conectada, a pagina passa a puxar artistas seguidos,
              top artistas, top faixas e comparar cada release com suas playlists.
            </p>
          </div>
        </Container>
      ) : (
        <>
          <Container className="py-8">
            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2">
                  <StatusBadge tone="blue">Top artistas</StatusBadge>
                  <span className="text-xs uppercase tracking-[0.18em] text-white/42">
                    media janela de escuta
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {data.topArtists.length > 0 ? (
                    data.topArtists.slice(0, 6).map((artist) => (
                      <article
                        key={artist.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3"
                      >
                        <div
                          className="h-14 w-14 rounded-2xl bg-white/6"
                          style={coverStyle(artist.imageUrl)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-white">
                            {artist.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {artist.sources.map((source) => (
                              <span
                                key={source}
                                className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/58"
                              >
                                {source}
                              </span>
                            ))}
                          </div>
                        </div>
                        <a
                          href={artist.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-white/55">
                      Ainda nao foi possivel ler seus top artistas.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2">
                  <StatusBadge tone="purple">Top faixas</StatusBadge>
                  <span className="text-xs uppercase tracking-[0.18em] text-white/42">
                    o que mais conversa com sua escuta
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {data.topTracks.length > 0 ? (
                    data.topTracks.slice(0, 6).map((track) => (
                      <article
                        key={track.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3"
                      >
                        <div
                          className="h-14 w-14 rounded-2xl bg-white/6"
                          style={coverStyle(track.coverUrl)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-white">{track.name}</div>
                          <div className="truncate text-sm text-white/58">{track.artists}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-white/42">
                            {track.playlistNames.length > 0
                              ? `Ja esta em ${track.playlistNames[0]}${track.playlistNames.length > 1 ? ` +${track.playlistNames.length - 1}` : ""}`
                              : "Ainda fora da base"}
                          </div>
                        </div>
                        <a
                          href={track.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-white/55">
                      Ainda nao foi possivel ler suas top faixas.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </Container>

          <Container className="pb-8">
            <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={playerError ? "red" : "green"}>
                      Player Web
                    </StatusBadge>
                    <StatusBadge tone={deviceId ? "blue" : "yellow"}>
                      {deviceId ? "Pronto no navegador" : "Inicializando"}
                    </StatusBadge>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    Player embutido para ouvir as oportunidades direto aqui
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/62">
                    Esse modo usa o Spotify Web Playback SDK. Para tocar a musica completa
                    dentro do sistema, a conta precisa estar reconectada com as novas permissoes
                    e ser Premium.
                  </p>
                </div>
                <a
                  href={connectHref}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Atualizar permissoes
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <article className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-sm text-white/68">
                    <Volume2 className="h-4 w-4" />
                    {playerStatus}
                  </div>

                  {playerError ? (
                    <div className="mt-4 flex gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>{playerError}</div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] p-3">
                    <div
                      className="h-20 w-20 shrink-0 rounded-[20px] bg-white/6"
                      style={coverStyle(currentTrack?.coverUrl ?? null)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                        Agora no player
                      </div>
                      <div className="mt-2 truncate text-lg font-semibold text-white">
                        {currentTrack?.name ?? "Escolha uma faixa da lista abaixo"}
                      </div>
                      <div className="truncate text-sm text-white/58">
                        {currentTrack?.artists ?? "O player web vai assumir a musica aqui."}
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.14em] text-white/42">
                        {currentTrack
                          ? isPaused
                            ? "Em pausa"
                            : "Tocando agora"
                          : "Aguardando sua primeira escolha"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleTogglePlayback}
                      disabled={!currentTrack || !player || isTogglingPlayback}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#1ed760] text-black transition-colors hover:bg-[#35e26c] disabled:cursor-not-allowed disabled:bg-[#1ed760]/35"
                    >
                      {isTogglingPlayback ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : isPaused ? (
                        <Play className="h-5 w-5 fill-current" />
                      ) : (
                        <Pause className="h-5 w-5 fill-current" />
                      )}
                    </button>
                  </div>
                </article>

                <article className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone="yellow">Releases recentes</StatusBadge>
                    <StatusBadge tone="blue">
                      {data.releases.length} encontrados
                    </StatusBadge>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-white">
                    O que os artistas do seu ecossistema acabaram de soltar
                  </h3>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    {data.releases.map((release) => (
                      <article
                        key={release.id}
                        className="group rounded-[24px] border border-white/8 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="h-20 w-20 rounded-[22px] bg-white/6"
                            style={coverStyle(release.coverUrl)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                              {release.artistName}
                            </div>
                            <h4 className="mt-1 line-clamp-2 text-lg font-semibold text-white">
                              {release.title}
                            </h4>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <StatusBadge tone="purple">{release.typeLabel}</StatusBadge>
                              <StatusBadge tone="green">{release.freshnessLabel}</StatusBadge>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/65">
                          <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">
                              Data
                            </div>
                            <div className="mt-1 text-white/82">{release.releaseDateLabel}</div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">
                              Gap
                            </div>
                            <div className="mt-1 text-white/82">
                              {release.tracksOutsidePlaylists} fora da base
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">
                            Melhor pista
                          </div>
                          <div className="mt-1 text-sm text-white/70">
                            {release.bestOpportunityName ?? "Nenhuma faixa livre agora"}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {release.signals.map((signal) => (
                            <span
                              key={signal}
                              className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/58"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>

                        <a
                          href={release.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white/68 transition-colors hover:text-white"
                        >
                          Abrir release
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </article>
                    ))}
                  </div>
                </article>
              </div>
            </section>
          </Container>

          <Container className="pb-10">
            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/8 px-5 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="green">Oportunidades</StatusBadge>
                  <StatusBadge tone="yellow">
                    {data.opportunities.length} faixas fora da base
                  </StatusBadge>
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  Faixas com potencial real para entrar nas playlists
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/62">
                  Agora voce consegue testar o som direto aqui antes de decidir se vai entrar
                  na base. A ordem prioriza artista seguido, peso na sua escuta, recencia do
                  release e encaixe com o DNA das playlists.
                </p>
              </div>

              <div className="divide-y divide-white/8">
                {data.opportunities.length > 0 ? (
                  data.opportunities.map((track) => (
                    <article
                      key={track.id}
                      className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_auto]"
                    >
                      <div className="flex gap-3">
                        <div
                          className="h-16 w-16 shrink-0 rounded-2xl bg-white/6"
                          style={coverStyle(track.coverUrl)}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate text-lg font-semibold text-white">
                              {track.name}
                            </h4>
                            <StatusBadge tone={track.fitTone}>{track.fitLabel}</StatusBadge>
                            <StatusBadge tone="blue">{track.scoreLabel}</StatusBadge>
                          </div>
                          <div className="truncate text-sm text-white/62">{track.artists}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/58">
                              {track.releaseName}
                            </span>
                            <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/58">
                              {track.freshnessLabel}
                            </span>
                            <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/58">
                              {track.genreLabel}
                            </span>
                            {track.signals.map((signal) => (
                              <span
                                key={signal}
                                className="rounded-full border border-emerald-400/18 bg-emerald-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-emerald-200"
                              >
                                {signal}
                              </span>
                            ))}
                          </div>
                          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58">
                            {track.reason}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm text-white/64 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">
                            Sugestao de playlist
                          </div>
                          <div
                            className={cn(
                              "mt-1 font-medium",
                              track.suggestedPlaylistName ? "text-white" : "text-white/52",
                            )}
                          >
                            {track.suggestedPlaylistName ?? "Escolha manual"}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">
                            Release
                          </div>
                          <div className="mt-1 text-white/82">{track.releaseDateLabel}</div>
                        </div>
                      </div>

                      <div className="flex flex-col items-stretch gap-3 lg:min-w-[230px]">
                        <button
                          type="button"
                          onClick={() => void handlePlayTrack(track)}
                          disabled={loadingTrackId === track.id}
                          className={cn(
                            "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                            currentTrackId === track.spotifyTrackId && !isPaused
                              ? "bg-[#1ed760] text-black hover:bg-[#35e26c]"
                              : "border border-white/10 bg-white/5 text-white hover:bg-white/10",
                            loadingTrackId === track.id
                              ? "cursor-wait opacity-80"
                              : "",
                          )}
                        >
                          {loadingTrackId === track.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : currentTrackId === track.spotifyTrackId && !isPaused ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4 fill-current" />
                          )}
                          {getPlayButtonLabel({
                            track,
                            currentTrackId,
                            isPaused,
                            loadingTrackId,
                          })}
                        </button>

                        <SpotifyPlaylistAddButton
                          spotifyTrackId={track.spotifyTrackId}
                          suggestedPlaylistName={track.suggestedPlaylistName}
                          label="Adicionar agora"
                          className="w-full rounded-full bg-[#1ed760] px-5 font-semibold text-black hover:bg-[#35e26c]"
                        />

                        <a
                          href={track.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/72 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          Abrir no Spotify
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/8">
                      <Sparkles className="h-6 w-6 text-white/72" />
                    </div>
                    <h4 className="mt-4 text-xl font-semibold text-white">
                      Nenhuma oportunidade livre forte agora
                    </h4>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/58">
                      Isso normalmente significa que as novidades lidas ja entraram na base ou
                      ainda nao bateram o fit necessario para virar prioridade.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </Container>
        </>
      )}
    </div>
  );
}
