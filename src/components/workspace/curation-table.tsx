"use client";

import { detectGenre, type TrackGenre } from "@/lib/genre-detection";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  ArrowUp,
  ExternalLink,
  Loader2,
  Minus,
  Music2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import { useSpotifyAccountPlaylistsCacheKey } from "@/hooks/use-spotify-account-playlists-cache-key";
import {
  getSpotifyArtistGenresClient,
  type SpotifyArtistGenresResponse,
} from "@/lib/spotify-artist-genres-client";
import {
  getCachedSpotifyAccountPlaylistsClient,
  getSpotifyAccountPlaylistsClient,
  invalidateSpotifyAccountPlaylistsClientCache,
  type SpotifyAccountPlaylistClient,
  type SpotifyPlaylistsClientResponse,
} from "@/lib/spotify-account-playlists-client";
import type { DecisionTrack } from "@/types/workspace";
import { cn } from "@/lib/utils";
import StatusBadge from "./status-badge";

type SpotifyAccountPlaylist = SpotifyAccountPlaylistClient;

type SpotifyPlaylistsResponse = SpotifyPlaylistsClientResponse;

type PlaylistOption = {
  playlist: SpotifyAccountPlaylist;
  score: number;
};

type PlaylistSuggestion = {
  playlist: SpotifyAccountPlaylist | null;
  label: string;
  reason: string;
  style: string;
  hasFit: boolean;
  options: PlaylistOption[];
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
      options: [...playlists]
        .map((playlist) => ({ playlist, score: 0 }))
        .sort((left, right) => right.playlist.tracksTotal - left.playlist.tracksTotal),
    };
  }

  const options = playlists
    .map((playlist) => ({
      playlist,
      score: playlistScore(playlist, style),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.playlist.tracksTotal - left.playlist.tracksTotal;
    });
  const match = options.find((option) => option.score > 0)?.playlist ?? null;

  if (match) {
    return {
      playlist: match,
      label: match.name,
      style,
      hasFit: true,
      reason: `${styleLabel[style]} detectado e match com playlist da conta.`,
      options,
    };
  }

  return {
    playlist: null,
    label: "Observar",
    style,
    hasFit: false,
    reason: `${styleLabel[style]} detectado, mas sem playlist propria do mesmo genero.`,
    options,
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
    return { label: "NEW", tone: "purple" as const, icon: Sparkles, value: "NEW" };
  }

  if (row.position_change && row.position_change > 0) {
    return {
      label: `+${row.position_change}`,
      tone: "green" as const,
      icon: ArrowUp,
      value: `${Math.abs(row.position_change)}`,
    };
  }

  if (row.position_change && row.position_change < 0) {
    return {
      label: `${row.position_change}`,
      tone: "red" as const,
      icon: ArrowDown,
      value: `${Math.abs(row.position_change)}`,
    };
  }

  return { label: "=", tone: "slate" as const, icon: Minus, value: "—" };
}

function MovementBadge({ row }: { row: DecisionTrack }) {
  const movement = getMovementBadge(row);
  const Icon = movement.icon;

  return (
    <StatusBadge tone={movement.tone} className="min-w-[54px] justify-center px-2 py-0.5 text-[9px]">
      <Icon className="mr-1 h-3 w-3" />
      {movement.value}
    </StatusBadge>
  );
}

export default function CurationTable({
  rows,
}: {
  rows: DecisionTrack[];
  previousDate: string | null;
}) {
  const cacheKey = useSpotifyAccountPlaylistsCacheKey();
  const activeCacheKeyRef = useRef(cacheKey);
  const playlistsDataCacheKeyRef = useRef(cacheKey);
  const [artistGenres, setArtistGenres] = useState<SpotifyArtistGenresResponse>({});
  const [playlistsData, setPlaylistsData] = useState<SpotifyPlaylistsResponse | null>(() =>
    cacheKey ? getCachedSpotifyAccountPlaylistsClient(cacheKey) : null,
  );
  const [addedTrackIdsByPlaylist, setAddedTrackIdsByPlaylist] = useState<
    Record<string, string[]>
  >({});
  const [selectedPlaylistByTrackId, setSelectedPlaylistByTrackId] = useState<
    Record<string, string>
  >({});
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadPlaylists = useCallback(() => {
    if (!cacheKey) return;
    const requestCacheKey = cacheKey;

    startTransition(async () => {
      try {
        const nextPlaylists = await getSpotifyAccountPlaylistsClient({
          cacheKey: requestCacheKey,
        });
        if (activeCacheKeyRef.current !== requestCacheKey) return;
        playlistsDataCacheKeyRef.current = requestCacheKey;
        setPlaylistsData(nextPlaylists);
      } catch {
        if (activeCacheKeyRef.current !== requestCacheKey) return;
        playlistsDataCacheKeyRef.current = requestCacheKey;
        setPlaylistsData({
          connected: false,
          playlists: [],
          message: "Conecte o Spotify para liberar sugestoes por playlist.",
        });
      }
    });
  }, [cacheKey, startTransition]);

  useEffect(() => {
    activeCacheKeyRef.current = cacheKey;
    if (!cacheKey) return;

    playlistsDataCacheKeyRef.current = cacheKey;
    setPlaylistsData(getCachedSpotifyAccountPlaylistsClient(cacheKey));
    loadPlaylists();
  }, [cacheKey, loadPlaylists]);

  // Buscar gêneros reais do Spotify para todos os artistIds únicos das rows
  useEffect(() => {
    const allIds = [...new Set(rows.flatMap((r) => r.artistIds))].filter(Boolean);
    if (allIds.length === 0) return;

    let cancelled = false;
    async function fetchGenres() {
      try {
        const genres = await getSpotifyArtistGenresClient(allIds);
        if (!cancelled) setArtistGenres(genres);
      } catch {
        // silencioso — a curadoria mantém o fallback por texto
      }
    }
    void fetchGenres();
    return () => { cancelled = true; };
  }, [rows]);

  const scopedPlaylistsData =
    playlistsDataCacheKeyRef.current === cacheKey ? playlistsData : null;
  const playlists = useMemo(
    () => (scopedPlaylistsData?.connected ? scopedPlaylistsData.playlists : []),
    [scopedPlaylistsData],
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
  const topActionableTracks = useMemo(
    () =>
      sortedRows
        .filter(
          (row) => row.recommendedAction === "add" && !row.alreadyInPlaylists,
        )
        .slice(0, 4),
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
  const top20Count = useMemo(
    () =>
      sortedRows.filter(
        (row) => row.streamRank !== null && row.streamRank <= 20 && !row.alreadyInPlaylists,
      ).length,
    [sortedRows],
  );

  async function handleAddToSuggestedPlaylist(
    row: DecisionTrack,
    playlist: SpotifyAccountPlaylist | null,
  ) {
    if (!playlist || addingKey) {
      return;
    }

    const key = `${playlist.id}:${row.trackId}`;
    setAddingKey(key);

    try {
      const response = await fetch(
        `/api/spotify/playlists/${playlist.id}/tracks`,
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
        const currentIds = current[playlist.id] ?? [];

        return {
          ...current,
          [playlist.id]: Array.from(new Set([...currentIds, row.trackId])),
        };
      });
      invalidateSpotifyAccountPlaylistsClientCache(cacheKey);
    } finally {
      setAddingKey(null);
    }
  }

  return (
    <Container className="pb-8 pt-2 tablet:pt-3">
      <div className="relative overflow-hidden rounded-[26px] border border-border bg-card shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-px bg-border dark:bg-slate-700" />

        <div className="relative border-b border-white/[0.08] px-4 py-4 tablet:px-6 tablet:py-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 laptop:flex-row laptop:items-end laptop:justify-between">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="green" className="px-2 py-0.5 text-[9px]">Curadoria ativa</StatusBadge>
                  <StatusBadge tone="slate" className="px-2 py-0.5 text-[9px]">Top 200 Brasil</StatusBadge>
                  <StatusBadge tone="blue" className="px-2 py-0.5 text-[9px]">{formatCount(addNowCount)} para adicionar</StatusBadge>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/38">
                    Mesa de acao
                  </div>
                  <h2 className="max-w-2xl text-xl font-semibold tracking-[-0.03em] text-white tablet:text-[1.65rem]">
                    Musicas quentes para entrar hoje.
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 tablet:max-w-[330px]">
                <div className="rounded-xl border border-emerald-400/15 bg-white/[0.035] px-3 py-2">
                  <div className="text-[8px] font-medium uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300/65">
                    Entrar
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-white">{addNowCount}</div>
                </div>
                <div className="rounded-xl border border-sky-400/15 bg-white/[0.035] px-3 py-2">
                  <div className="text-[8px] font-medium uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300/65">
                    Top 20
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-white">{top20Count}</div>
                </div>
                <div className="rounded-xl border border-violet-400/15 bg-white/[0.035] px-3 py-2">
                  <div className="text-[8px] font-medium uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300/65">
                    Discovery
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-white">{discoveryCount}</div>
                </div>
              </div>
            </div>

            {topDecision ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/36">
                    Destaques para adicionar rapido
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="h-8 rounded-full bg-emerald-400 px-3 text-xs text-slate-950 shadow-none hover:bg-emerald-300"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Atualizar
                    </Button>
                    <Button asChild variant="outline" className="h-8 rounded-full border-white/10 bg-white/[0.04] px-3 text-xs text-white shadow-none hover:bg-white/[0.08]">
                      <Link href={topDecision.spotifyUrl} target="_blank" rel="noreferrer">
                        <ArrowUpRight className="h-4 w-4" />
                        Abrir
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="-mx-1 overflow-x-auto pb-1.5">
                  <div className="flex min-w-max gap-2.5 px-1">
                    {topActionableTracks.map((track) => (
                      <div
                        key={track.trackId}
                        className="w-[190px] overflow-hidden rounded-[18px] border border-white/[0.09] bg-white/[0.035] shadow-[0_18px_42px_-30px_rgba(0,0,0,0.9)] tablet:w-[210px]"
                      >
                        <div className="relative aspect-[16/10] overflow-hidden bg-white/[0.04]" style={coverStyle(track.coverUrl)}>
                          {!track.coverUrl ? (
                            <div className="flex h-full items-center justify-center text-white/16">
                              <Music2 className="h-8 w-8" />
                            </div>
                          ) : null}
                          <div className="absolute inset-0 bg-slate-950/10" />
                          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
                            <MovementBadge row={track} />
                            <StatusBadge tone="green" className="px-2 py-0.5 text-[9px]">
                              {track.decisionScore}
                            </StatusBadge>
                          </div>
                        </div>

                        <div className="space-y-2 p-3">
                          <div className="space-y-0.5">
                              <div className="line-clamp-1 text-sm font-semibold leading-tight text-white">
                                {track.name}
                              </div>
                              <div className="truncate text-[11px] text-white/48">{track.artists}</div>
                          </div>
                            <div className="flex min-w-0 items-center gap-1.5 text-[9px] text-white/58">
                              {track.suggestedPlaylistName ? (
                                <span className="max-w-[92px] truncate rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1">
                                  {track.suggestedPlaylistName}
                                </span>
                              ) : null}
                              <span className="max-w-[100px] truncate rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1">
                                {getDecisionLabel(track)}
                              </span>
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[150px] items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-white/[0.025] px-6 text-center text-sm text-white/50">
                Nenhuma faixa disponível para destacar agora.
              </div>
            )}
          </div>
        </div>

        <div className="relative px-4 py-4 tablet:px-6 tablet:py-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/35">
                Lista operacional
              </div>
              <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">Faixas prontas para decidir</h3>
              <p className="mt-0.5 max-w-3xl text-xs text-white/45">
                Leitura contínua do Top 200 com ação rápida para a playlist mais compatível da conta.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-white/38">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1">
                Spotify Charts BR
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1">
                Snapshot diario
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1">
                Add direto na playlist
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[18px] border border-white/[0.08] bg-black/15 backdrop-blur-sm">
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
          <thead className="bg-white/[0.025]">
            <tr className="text-[9px] uppercase tracking-[0.16em] text-white/34">
              <th className="px-3 py-2.5">Rank</th>
              <th className="px-3 py-2.5">Mov.</th>
              <th className="px-3 py-2.5">Musica</th>
              <th className="px-3 py-2.5">Streams</th>
              <th className="px-3 py-2.5">Playlist sugerida</th>
              <th className="px-3 py-2.5">Gênero</th>
              <th className="px-3 py-2.5">Acao</th>
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
                const selectedPlaylistId =
                  selectedPlaylistByTrackId[row.trackId] ?? suggestion.playlist?.id ?? "";
                const selectedPlaylist =
                  suggestion.options.find((option) => option.playlist.id === selectedPlaylistId)
                    ?.playlist ??
                  suggestion.playlist;
                const selectedOption =
                  suggestion.options.find((option) => option.playlist.id === selectedPlaylist?.id) ??
                  null;
                const isAddedToSelectedPlaylist = selectedPlaylist
                  ? (addedTrackIdsByPlaylist[selectedPlaylist.id] ?? []).includes(row.trackId)
                  : false;
                const isAlreadyOnBase = row.alreadyInPlaylists;
                const addKey = selectedPlaylist
                  ? `${selectedPlaylist.id}:${row.trackId}`
                  : null;

                return (
                  <tr key={row.trackId} className="transition-colors hover:bg-white/[0.025]">
                    <td className="px-3 py-2.5 align-middle">
                      <div className="whitespace-nowrap text-sm font-semibold tabular-nums text-white">
                        #{row.streamRank ?? index + 1}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <MovementBadge row={row} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.04] text-white/16 shadow-sm"
                          style={coverStyle(row.coverUrl)}
                        >
                          {!row.coverUrl ? <Music2 className="h-4 w-4" /> : null}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold leading-tight text-white">{row.name}</div>
                          <div className="mt-1 truncate text-[10px] text-white/38">
                            {row.artists}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                      <div className="text-xs font-semibold tabular-nums text-white/88">
                        {formatCount(row.dailyStreams)}
                      </div>
                      <div
                        className={cn(
                            "text-[10px]",
                          row.streamGrowthPercent === null
                            ? "text-muted-foreground"
                            : row.streamGrowthPercent > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : row.streamGrowthPercent < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-white/45",
                        )}
                      >
                        {row.streamGrowthPercent === null
                          ? "Sem historico"
                          : `${row.streamGrowthPercent >= 0 ? "+" : ""}${row.streamGrowthPercent.toFixed(1)}%`}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex min-w-0 items-center gap-2">
                        {selectedPlaylist?.imageUrl ? (
                          <div
                            className="h-8 w-8 shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04]"
                            style={coverStyle(selectedPlaylist.imageUrl)}
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                            <Music2 className="h-3.5 w-3.5 text-white/22" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <select
                            value={selectedPlaylistId}
                            onChange={(event) =>
                              setSelectedPlaylistByTrackId((current) => ({
                                ...current,
                                [row.trackId]: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[10px] font-medium text-white/80 outline-none transition focus:border-white/20"
                          >
                            {suggestion.options.map((option, optionIndex) => (
                              <option
                                key={option.playlist.id}
                                value={option.playlist.id}
                                className="bg-slate-950 text-white"
                              >
                                {optionIndex === 0 && option.score > 0 ? "Sugerida · " : ""}
                                {option.playlist.name}
                              </option>
                            ))}
                            {!suggestion.playlist ? (
                              <option value="" className="bg-slate-950 text-white">
                                Observar
                              </option>
                            ) : null}
                          </select>
                          <div className="mt-0.5 text-[9px] text-white/32">
                            {selectedPlaylist
                              ? `${formatCount(selectedPlaylist.tracksTotal)} tracks${
                                  selectedOption && selectedOption.score > 0
                                    ? " · melhor fit"
                                    : ""
                                }`
                              : suggestion.reason}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
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
                              ? "!border-orange-500/30 !bg-orange-500/10 !text-orange-600 dark:!text-orange-400"
                              : suggestion.style === "piseiro"
                              ? "!border-lime-500/30 !bg-lime-500/10 !text-lime-700 dark:!text-lime-400"
                              : suggestion.style === "reggae"
                              ? "!border-teal-500/30 !bg-teal-500/10 !text-teal-700 dark:!text-teal-400"
                              : suggestion.style === "rock"
                              ? "!border-red-500/30 !bg-red-500/10 !text-red-600 dark:!text-red-400"
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
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {isAddedToSelectedPlaylist ? (
                          <StatusBadge tone="green">Adicionada</StatusBadge>
                        ) : isAlreadyOnBase ? (
                          <StatusBadge tone="blue">Na base</StatusBadge>
                        ) : !selectedPlaylist ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <Button
                            size="sm"
                            className="rounded-full bg-emerald-500 px-3 text-black hover:bg-emerald-400"
                            disabled={!selectedPlaylist || addingKey === addKey}
                            onClick={() => void handleAddToSuggestedPlaylist(row, selectedPlaylist)}
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

      {scopedPlaylistsData && !scopedPlaylistsData.connected ? (
        <p className="mt-3 text-sm text-muted-foreground">{scopedPlaylistsData.message}</p>
      ) : null}
    </Container>
  );
}
