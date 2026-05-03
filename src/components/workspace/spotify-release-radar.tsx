import Link from "next/link";
import {
  ArrowUpRight,
  ExternalLink,
  Music2,
  Radio,
  Sparkles,
  Waves,
} from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import SpotifyPlaylistAddButton from "@/components/workspace/spotify-playlist-add-button";
import StatusBadge from "@/components/workspace/status-badge";
import { cn } from "@/lib/utils";
import type { SpotifyReleaseRadarPageData } from "@/lib/spotify-release-radar-data";

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

export default function SpotifyReleaseRadar({
  data,
}: {
  data: SpotifyReleaseRadarPageData;
}) {
  const connectHref = data.needsReconnect
    ? "/api/spotify/auth/login?next=/novidades"
    : "/api/spotify/auth/login?next=/novidades";

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
                    <StatusBadge tone="yellow">Releases recentes</StatusBadge>
                    <StatusBadge tone="blue">
                      {data.releases.length} encontrados
                    </StatusBadge>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    O que os artistas do seu ecossistema acabaram de soltar
                  </h3>
                </div>
                <Link
                  href="/radar-music"
                  className="text-sm font-medium text-white/60 transition-colors hover:text-white"
                >
                  Cruzar com Radar Music
                </Link>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.releases.map((release) => (
                  <article
                    key={release.id}
                    className="group rounded-[24px] border border-white/8 bg-black/20 p-4"
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
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">
                          Data
                        </div>
                        <div className="mt-1 text-white/82">{release.releaseDateLabel}</div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
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
                  A ordem prioriza artista seguido, peso na sua escuta, recencia do release e
                  encaixe com o DNA das playlists.
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

                      <div className="flex flex-col items-stretch gap-3 lg:min-w-[210px]">
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
