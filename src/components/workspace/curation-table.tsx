"use client";

import { detectGenre, type TrackGenre } from "@/lib/genre-detection";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ExternalLink,
  Flame,
  Loader2,
  Music2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import {
  getSpotifyAccountPlaylistsClient,
  type SpotifyAccountPlaylistClient,
  type SpotifyPlaylistsClientResponse,
} from "@/lib/spotify-account-playlists-client";
import type { DecisionTrack } from "@/types/workspace";
import type { ArtistGenresResponse } from "@/app/api/spotify/artists/genres/route";
import { cn } from "@/lib/utils";
import StatusBadge from "./status-badge";

type SpotifyAccountPlaylist = SpotifyAccountPlaylistClient;

type SpotifyPlaylistsResponse = SpotifyPlaylistsClientResponse;

type PlaylistSuggestion = {
  playlist: SpotifyAccountPlaylist | null;
  label: string;
  reason: string;
  style: string;
  hasFit: boolean;
};

// Genre type imported from genre-detection.ts
type TrackStyle = TrackGenre;

// Genre detection is now handled by genre-detection.ts (shared with playlist-kworb-suggestions)
function mapSpotifyGenresToStyle(genres: string[]): TrackStyle {
  // Map Spotify genre strings using the same canonical detectGenre logic
  // by checking the first genre string that matches known patterns
  const genreMap: Array<[RegExp, TrackStyle]> = [
    [/funk|baile/i, "funk"],
    [/\btrap\b/i, "trap"],
    [/\brap\b|hip.?hop|drill/i, "rap"],
    [/sertanejo/i, "sertanejo"],
    [/pagode|samba/i, "pagode"],
    [/forro|piseiro|pisadinha/i, "piseiro"],
    [/reggae/i, "reggae"],
    [/\brock\b/i, "rock"],
    [/\bpop\b|k.?pop/i, "pop"],
  ];
  for (const genre of genres) {
    for (const [pattern, style] of genreMap) {
      if (pattern.test(genre)) return style;
    }
  }
  return "unknown";
}

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

function formatCount(value: number | null) {
  if (value === null) {
    return "Sem dado";
  }

  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s&]/g, " ")
    .toLowerCase();
}

function countMatches(text: string, terms: string[]) {
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function detectTrackStyle(row: DecisionTrack): TrackStyle {
  // Delegates to shared genre-detection.ts — same logic as playlist-kworb-suggestions
  return detectGenre(row.artists, row.name);
}

function playlistScore(playlist: SpotifyAccountPlaylist, style: TrackStyle | "discovery") {
  const name = normalizeText(playlist.name);
  const styleTerms: Record<string, string[]> = {
    funk: ["funk", "baile", "mandela", "mandelao", "automotivo", "rave", "proibidao"],
    trap: ["trap"],
    rap: ["rap", "drill"],
    rock: ["rock"],
    sertanejo: ["sertanejo", "modao", "agro", "universitario"],
    pagode: ["pagode", "samba"],
    pagodao: ["pagodao", "pagodão", "pagoda"],
    piseiro: ["piseiro", "pisadinha", "forro", "forró", "nordeste"],
    pop: ["pop", "hits", "viral", "mundial", "mais tocadas", "internacional"],
    reggae: ["reggae", "roots", "rappa", "natiruts"],
    discovery: ["descoberta", "discovery", "viral", "hits", "top", "brasil", "novidades"],
  };

  return (styleTerms[style] ?? []).reduce(
    (score, term) => score + (name.includes(term) ? 1 : 0),
    0,
  );
}

function buildPlaylistSuggestion(
  row: DecisionTrack,
  playlists: SpotifyAccountPlaylist[],
  spotifyGenres: string[] = [],
): PlaylistSuggestion {
  // Tentar gênero real do Spotify primeiro; fallback para detecção por texto
  const spotifyStyle = mapSpotifyGenresToStyle(spotifyGenres);
  const style = spotifyStyle !== "unknown" ? spotifyStyle : detectTrackStyle(row);
  const styleLabel: Record<string, string> = {
    funk: "Funk",
    trap: "Trap",
    rap: "Rap",
    sertanejo: "Sertanejo",
    pagode: "Pagode",
    pagodao: "Pagodão",
    piseiro: "Piseiro",
    pop: "Pop",
    rock: "Rock",
    reggae: "Reggae",
    unknown: "—",
  };

  if (style === "unknown") {
    return {
      playlist: null,
      label: "—",
      style,
      hasFit: false,
      reason: "Genero nao identificado.",
    };
  }

  const sortedPlaylists = [...playlists].sort(
    (left, right) => playlistScore(right, style) - playlistScore(left, style),
  );
  const match = sortedPlaylists.find((playlist) => playlistScore(playlist, style) > 0) ?? null;

  if (match) {
    return {
      playlist: match,
      label: match.name,
      style,
      hasFit: true,
      reason: `${styleLabel[style]} detectado e match com playlist da conta.`,
    };
  }

  return {
    playlist: null,
    label: "Observar",
    style,
    hasFit: false,
    reason: `${styleLabel[style]} detectado, mas sem playlist propria do mesmo genero.`,
  };
}

function getDecisionLabel(row: DecisionTrack) {
  if (row.alreadyInPlaylists) {
    return "Ja esta em alguma playlist";
  }

  if (row.dailyStreams !== null && row.streamRank !== null && row.streamRank <= 20) {
    return "Alta prioridade pelo Top 20 BR";
  }

  if (row.lowSaturation) {
    return "Boa janela antes de saturar";
  }

  return "Avaliar encaixe editorial";
}

function getMovementBadge(row: DecisionTrack) {
  if (row.movement_type === "new") {
    return { label: "NEW", className: "text-sky-300" };
  }

  if (row.position_change && row.position_change > 0) {
    return { label: `+${row.position_change}`, className: "text-emerald-300" };
  }

  if (row.position_change && row.position_change < 0) {
    return { label: `${row.position_change}`, className: "text-rose-300" };
  }

  return { label: "=", className: "text-white/45" };
}

export default function CurationTable({ rows }: { rows: DecisionTrack[] }) {
  const [artistGenres, setArtistGenres] = useState<ArtistGenresResponse>({});
  const [playlistsData, setPlaylistsData] = useState<SpotifyPlaylistsResponse | null>(null);
  const [addedTrackIdsByPlaylist, setAddedTrackIdsByPlaylist] = useState<
    Record<string, string[]>
  >({});
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPlaylists = useCallback(() => {
    startTransition(async () => {
      try {
        setPlaylistsData(await getSpotifyAccountPlaylistsClient());
      } catch {
        setPlaylistsData({
          connected: false,
          playlists: [],
          message: "Conecte o Spotify para liberar sugestoes por playlist.",
        });
      }
    });
  }, [startTransition]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Buscar gêneros reais do Spotify para todos os artistIds únicos das rows
  useEffect(() => {
    const allIds = [...new Set(rows.flatMap((r) => r.artistIds))].filter(Boolean);
    if (allIds.length === 0) return;

    let cancelled = false;
    async function fetchGenres() {
      const chunkSize = 50;
      const merged: ArtistGenresResponse = {};
      for (let i = 0; i < allIds.length; i += chunkSize) {
        const chunk = allIds.slice(i, i + chunkSize);
        try {
          const res = await fetch(`/api/spotify/artists/genres?ids=${chunk.join(",")}`);
          if (res.ok) {
            const data = (await res.json()) as ArtistGenresResponse;
            Object.assign(merged, data);
          }
        } catch { /* silencioso — fallback por texto */ }
      }
      if (!cancelled) setArtistGenres(merged);
    }
    void fetchGenres();
    return () => { cancelled = true; };
  }, [rows]);

  const playlists = useMemo(
    () => (playlistsData?.connected ? playlistsData.playlists : []),
    [playlistsData],
  );
  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (left, right) =>
          (right.dailyStreams ?? 0) - (left.dailyStreams ?? 0) ||
          right.decisionScore - left.decisionScore,
      ),
    [rows],
  );
  const topDecision = useMemo(
    () =>
      sortedRows.find(
        (row) => !row.alreadyInPlaylists && row.recommendedAction === "add",
      ) ?? sortedRows[0] ?? null,
    [sortedRows],
  );
  const addNowCount = useMemo(
    () =>
      sortedRows.filter(
        (row) => row.recommendedAction === "add" && !row.alreadyInPlaylists,
      ).length,
    [sortedRows],
  );
  const discoveryCount = useMemo(
    () =>
      sortedRows.filter(
        (row) =>
          row.lowSaturation &&
          !row.alreadyInPlaylists &&
          (row.recommendedAction === "add" || row.recommendedAction === "observe"),
      ).length,
    [sortedRows],
  );
  const inBaseCount = useMemo(
    () => sortedRows.filter((row) => row.alreadyInPlaylists).length,
    [sortedRows],
  );
  const top20Count = useMemo(
    () =>
      sortedRows.filter(
        (row) => row.streamRank !== null && row.streamRank <= 20 && !row.alreadyInPlaylists,
      ).length,
    [sortedRows],
  );

  async function handleAddToSuggestedPlaylist(
    row: DecisionTrack,
    suggestion: PlaylistSuggestion,
  ) {
    if (!suggestion.playlist || addingKey) {
      return;
    }

    const key = `${suggestion.playlist.id}:${row.trackId}`;
    setAddingKey(key);

    try {
      const response = await fetch(
        `/api/spotify/playlists/${suggestion.playlist.id}/tracks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackUri: `spotify:track:${row.trackId}` }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        alreadyExists?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Nao foi possivel adicionar a faixa.");
      }

      setAddedTrackIdsByPlaylist((current) => {
        const currentIds = current[suggestion.playlist!.id] ?? [];

        return {
          ...current,
          [suggestion.playlist!.id]: Array.from(new Set([...currentIds, row.trackId])),
        };
      });
    } finally {
      setAddingKey(null);
    }
  }

  return (
    <Container className="border-b border-border/70 py-8">
      <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,28,0.96),rgba(5,10,22,0.98))] shadow-[0_24px_120px_rgba(0,0,0,0.38)]">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_50%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_42%)]" />

        <div className="relative border-b border-white/10 px-5 py-5 tablet:px-7 tablet:py-6">
          <div className="grid gap-4 laptop:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="green">Curadoria ativa</StatusBadge>
                <StatusBadge tone="slate">Top 200 Brasil</StatusBadge>
                <StatusBadge tone="blue">{formatCount(sortedRows.length)} faixas no radar</StatusBadge>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                  Mesa de acao
                </div>
                <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-white tablet:text-[2rem]">
                  Curadoria do dia com decisão rápida e destino de playlist já sugerido.
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-white/62">
                  A página cruza o Top 200 com o DNA da tua conta para mostrar o que
                  entra agora, o que ainda pede teste e o que já está bem coberto na base.
                </p>
              </div>

              <div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
                    <Sparkles className="h-3.5 w-3.5" />
                    Entrar agora
                  </div>
                  <div className="text-3xl font-semibold text-white">{addNowCount}</div>
                  <p className="mt-1 text-sm text-white/55">Faixas prontas para adicionar.</p>
                </div>

                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/8 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-sky-300/80">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Top 20 quente
                  </div>
                  <div className="text-3xl font-semibold text-white">{top20Count}</div>
                  <p className="mt-1 text-sm text-white/55">Subidas fortes fora da base.</p>
                </div>

                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/8 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-violet-300/80">
                    <Flame className="h-3.5 w-3.5" />
                    Discovery
                  </div>
                  <div className="text-3xl font-semibold text-white">{discoveryCount}</div>
                  <p className="mt-1 text-sm text-white/55">Janela boa antes de saturar.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                    <Music2 className="h-3.5 w-3.5" />
                    Ja na base
                  </div>
                  <div className="text-3xl font-semibold text-white">{inBaseCount}</div>
                  <p className="mt-1 text-sm text-white/55">Faixas já presentes na conta.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              {topDecision ? (
                <div
                  className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/30 p-4"
                >
                  <div
                    className="absolute inset-0 opacity-40"
                    style={coverStyle(topDecision.coverUrl)}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(4,10,20,0.92),rgba(4,10,20,0.72)_55%,rgba(16,185,129,0.18))]" />
                  <div className="relative space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="green">Melhor decisao</StatusBadge>
                      <StatusBadge tone="blue">Score {topDecision.decisionScore}</StatusBadge>
                      <StatusBadge tone="slate">{topDecision.fitLabel}</StatusBadge>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className="h-16 w-16 shrink-0 rounded-2xl border border-white/10 bg-white/5"
                        style={coverStyle(topDecision.coverUrl)}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-lg font-semibold text-white">
                          {topDecision.name}
                        </div>
                        <div className="truncate text-sm text-white/60">{topDecision.artists}</div>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm text-white/62 tablet:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                          Playlist sugerida
                        </div>
                        <div className="mt-1 truncate font-medium text-white">
                          {topDecision.suggestedPlaylistName ?? "Observar"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                          Sinal
                        </div>
                        <div className="mt-1 font-medium text-white">{getDecisionLabel(topDecision)}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="rounded-full bg-emerald-500 px-4 text-black hover:bg-emerald-400"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Atualizar
                      </Button>
                      <Button asChild variant="outline" className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10">
                        <Link href={topDecision.spotifyUrl} target="_blank" rel="noreferrer">
                          <ArrowUpRight className="h-4 w-4" />
                          Abrir no Spotify
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 text-center text-sm text-white/50">
                  Nenhuma faixa disponível para destacar agora.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative px-5 py-5 tablet:px-7 tablet:py-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                Lista operacional
              </div>
              <h3 className="mt-2 text-xl font-semibold text-white">Faixas prontas para decidir</h3>
              <p className="mt-1 max-w-3xl text-sm text-white/55">
                Leitura contínua do Top 200 com ação rápida para a playlist mais compatível da conta.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Kworb BR
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Sem paginação
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Add direto na playlist
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-black/25 backdrop-blur-sm">
            <table className="w-full divide-y divide-white/10 text-left table-fixed">
          <colgroup>
            <col className="w-[60px]" />
            <col className="w-[72px]" />
            <col className="w-[34%]" />
            <col className="w-[110px]" />
            <col className="w-[24%]" />
            <col className="w-[90px]" />
            <col className="w-[160px]" />
          </colgroup>
          <thead className="bg-white/[0.03]">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">Mov.</th>
              <th className="px-3 py-3">Musica</th>
              <th className="px-3 py-3">Streams</th>
              <th className="px-3 py-3">Playlist sugerida</th>
              <th className="px-3 py-3">Gênero</th>
              <th className="px-3 py-3">Acao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma recomendacao disponivel agora.
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => {
                const rowArtistGenres = row.artistIds.flatMap((id) => artistGenres[id] ?? []);
                const suggestion = buildPlaylistSuggestion(row, playlists, rowArtistGenres);
                const movementBadge = getMovementBadge(row);
                const isAddedToSuggestedPlaylist = suggestion.playlist
                  ? (addedTrackIdsByPlaylist[suggestion.playlist.id] ?? []).includes(row.trackId)
                  : false;
                const isAlreadyOnBase = row.alreadyInPlaylists;
                const addKey = suggestion.playlist
                  ? `${suggestion.playlist.id}:${row.trackId}`
                  : null;

                return (
                  <tr key={row.trackId} className="hover:bg-white/[0.03]">
                    <td className="px-3 py-3 align-middle">
                      <div className="text-lg font-bold text-white tabular-nums whitespace-nowrap">
                        #{row.streamRank ?? index + 1}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div
                        className={cn(
                          "inline-flex min-w-[44px] items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums",
                          row.movement_type === "new"
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                            : row.position_change && row.position_change > 0
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : row.position_change && row.position_change < 0
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                : "border-white/10 bg-white/5 text-white/45",
                        )}
                      >
                        {movementBadge.label}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-10 w-10 shrink-0 rounded-lg border border-border bg-muted"
                          style={coverStyle(row.coverUrl)}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-sm leading-tight">{row.name}</div>
                          <div className="truncate text-xs text-muted-foreground mt-0.5">
                            {row.artists}
                          </div>
                          <div className="mt-1 truncate text-xs text-white/45">
                            {getDecisionLabel(row)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      <div className="text-sm font-semibold tabular-nums">
                        {formatCount(row.dailyStreams)}
                      </div>
                      <div className="text-xs text-muted-foreground">Snapshot do dia</div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        {suggestion.playlist?.imageUrl ? (
                          <div
                            className="h-8 w-8 shrink-0 rounded-md border border-border bg-muted"
                            style={coverStyle(suggestion.playlist.imageUrl)}
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                            <Music2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold leading-tight">
                            {suggestion.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {suggestion.playlist
                              ? `${formatCount(suggestion.playlist.tracksTotal)} tracks`
                              : suggestion.reason}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      {suggestion.style === "unknown" ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <StatusBadge
                          tone={
                            suggestion.style === "funk" ? "slate" :
                            suggestion.style === "trap" ? "yellow" :
                            suggestion.style === "rap" ? "yellow" :
                            suggestion.style === "sertanejo" ? "blue" :
                            suggestion.style === "pagode" ? "green" :
                            suggestion.style === "pagodao" ? "green" :
                            suggestion.style === "piseiro" ? "slate" :
                            suggestion.style === "reggae" ? "green" :
                            suggestion.style === "rock" ? "slate" :
                            "purple"
                          }
                          className={
                            suggestion.style === "funk"
                              ? "!border-orange-500/30 !bg-orange-500/10 !text-orange-400"
                              : suggestion.style === "piseiro"
                              ? "!border-lime-500/30 !bg-lime-500/10 !text-lime-400"
                              : suggestion.style === "reggae"
                              ? "!border-teal-500/30 !bg-teal-500/10 !text-teal-400"
                              : suggestion.style === "rock"
                              ? "!border-red-500/30 !bg-red-500/10 !text-red-400"
                              : undefined
                          }
                        >
                          <span className="whitespace-nowrap">
                            {suggestion.style === "funk" ? "Funk" :
                             suggestion.style === "trap" ? "Trap" :
                             suggestion.style === "rap" ? "Rap" :
                             suggestion.style === "sertanejo" ? "Sertanejo" :
                             suggestion.style === "pagode" ? "Pagode" :
                             suggestion.style === "pagodao" ? "Pagodão" :
                             suggestion.style === "piseiro" ? "Piseiro" :
                             suggestion.style === "reggae" ? "Reggae" :
                             suggestion.style === "rock" ? "Rock" :
                             "Pop"}
                          </span>
                        </StatusBadge>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {isAddedToSuggestedPlaylist ? (
                          <StatusBadge tone="green">Adicionada</StatusBadge>
                        ) : isAlreadyOnBase ? (
                          <StatusBadge tone="blue">Na base</StatusBadge>
                        ) : !suggestion.hasFit ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <Button
                            size="sm"
                            className="rounded-full bg-emerald-500 px-3 text-black hover:bg-emerald-400"
                            disabled={!suggestion.playlist || addingKey === addKey}
                            onClick={() => void handleAddToSuggestedPlaylist(row, suggestion)}
                          >
                            {addingKey === addKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Adicionar
                          </Button>
                        )}
                        <Button asChild size="sm" variant="outline" className="rounded-full border-white/15 bg-white/5 hover:bg-white/10">
                          <Link href={row.spotifyUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
            </table>
          </div>
        </div>
      </div>

      {playlistsData && !playlistsData.connected ? (
        <p className="mt-3 text-sm text-muted-foreground">{playlistsData.message}</p>
      ) : null}
    </Container>
  );
}
