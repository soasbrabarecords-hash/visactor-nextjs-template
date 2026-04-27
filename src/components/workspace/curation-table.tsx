"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Music2, RefreshCw } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import type { DecisionTrack } from "@/types/workspace";
import type { ArtistGenresResponse } from "@/app/api/spotify/artists/genres/route";
import StatusBadge from "./status-badge";

type SpotifyAccountPlaylist = {
  id: string;
  name: string;
  imageUrl: string | null;
  tracksTotal: number;
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

type PlaylistTrackIdsResponse = {
  trackIds?: string[];
};

type PlaylistSuggestion = {
  playlist: SpotifyAccountPlaylist | null;
  label: string;
  reason: string;
  style: string;
  hasFit: boolean;
};

type TrackStyle = "funk" | "rap" | "sertanejo" | "pagode" | "piseiro" | "pop" | "unknown";

// Mapeamento de strings de gênero Spotify → TrackStyle interno
// Spotify retorna strings como "funk carioca", "trap brasileiro", "sertanejo universitario"
const SPOTIFY_GENRE_MAP: Array<[RegExp, TrackStyle]> = [
  [/funk\s*(carioca|ostenta|mandelao|150|melody|proibid|bh|brasil)?/i, "funk"],
  [/trap\s*(brasileiro|br|nacional)?/i, "funk"], // trap BR = funk no contexto
  [/baile\s*funk/i, "funk"],
  [/rap\s*(nacional|brasileiro|consciente|underground)?/i, "rap"],
  [/hip.?hop\s*(brasileiro|nacional)?/i, "rap"],
  [/sertanejo\s*(universitario|pop|tradicional|romantico)?/i, "sertanejo"],
  [/pagode/i, "pagode"],
  [/samba/i, "pagode"],
  [/forro|piseiro|pisadinha|xote|bai[oa]o/i, "piseiro"],
  [/axe/i, "pagode"],
  [/k.?pop/i, "pop"],
  [/pop\s*(brasileiro|nacional|latino|dance)?/i, "pop"],
  [/reggaeton/i, "pop"],
];

function mapSpotifyGenresToStyle(genres: string[]): TrackStyle {
  for (const genre of genres) {
    for (const [pattern, style] of SPOTIFY_GENRE_MAP) {
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
    .toLowerCase();
}

function countMatches(text: string, terms: string[]) {
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function detectTrackStyle(row: DecisionTrack): TrackStyle {
  const text = normalizeText(`${row.name} ${row.artists} ${row.albumName}`);
  const funkScore = countMatches(text, [
    "mc",
    "dj",
    "funk",
    "baile",
    "mandelao",
    "automotivo",
    "proibidao",
    "rave",
    "japa nk",
    "meno k",
    "mc ryan sp",
    "mc ig",
    "mc luuky",
    "mc gu",
    "lele jp",
    "poze do rodo",
    "pedro sampaio",
    "anitta",
  ]);
  const sertanejoStrongScore = countMatches(text, [
    "modao",
    "agro",
    "universitario",
    "ze neto",
    "cristiano",
    "murilo huff",
    "marilia mendonca",
    "panda",
    "mj records",
    "gusttavo lima",
    "danilo e davi",
    "danilo & davi",
    "junior e cezar",
    "junior & cezar",
    "diego e vitor hugo",
    "diego & vitor hugo",
    "matheus e kauan",
    "matheus & kauan",
    "lauana prado",
    "zé neto",
  ]);
  const sertanejoScore =
    sertanejoStrongScore + (text.includes("ao vivo") && sertanejoStrongScore > 0 ? 1 : 0);
  const pagodeScore = countMatches(text, [
    "pagode",
    "samba",
    "grupo menos e mais",
    "menos e mais",
    "ferrugem",
    "thiaguinho",
    "sorriso maroto",
    "turma do pagode",
    "mumuzinho",
    "molejo",
  ]);
  const piseiroScore = countMatches(text, [
    "piseiro",
    "pisadinha",
    "vitinho imperator",
    "nattan",
    "ze vaqueiro",
    "zé vaqueiro",
  ]);
  const popScore = countMatches(text, ["bts", "pop", "kpop"]);
  const rapScore = countMatches(text, ["trap", "rap", "drill"]);

  if (sertanejoScore > 0) {
    return "sertanejo";
  }

  if (pagodeScore > 0) {
    return "pagode";
  }

  if (piseiroScore > 0) {
    return "piseiro";
  }

  if (popScore > 0) {
    return "pop";
  }

  if (funkScore > 0) {
    return "funk";
  }

  if (rapScore > 0) {
    return "rap";
  }

  return "unknown";
}

function playlistScore(playlist: SpotifyAccountPlaylist, style: TrackStyle | "discovery") {
  const name = normalizeText(playlist.name);
  const styleTerms: Record<string, string[]> = {
    funk: ["funk", "baile", "mandela", "mandelao", "automotivo", "rave", "proibidao"],
    rap: ["trap", "rap", "drill"],
    sertanejo: ["sertanejo", "modao", "agro", "universitario"],
    pagode: ["pagode", "samba"],
    piseiro: ["piseiro", "pisadinha", "forro", "forró", "nordeste"],
    pop: ["pop", "hits", "top", "viral", "mundial"],
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
    rap: "Trap/Rap",
    sertanejo: "Sertanejo",
    pagode: "Pagode/Samba",
    piseiro: "Piseiro/Forro",
    pop: "Pop",
    unknown: "Sem genero claro",
  };

  if (style === "unknown") {
    const discoveryMatch =
      playlists.find((playlist) => playlistScore(playlist, "discovery") > 0) ?? null;

    if (discoveryMatch) {
      return {
        playlist: discoveryMatch,
        label: discoveryMatch.name,
        style,
        hasFit: true,
        reason: "Genero indefinido; sugestao de descoberta para teste editorial.",
      };
    }

    return {
      playlist: null,
      label: "Observar",
      style,
      hasFit: false,
      reason: "Genero indefinido; observar antes de adicionar.",
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

export default function CurationTable({ rows }: { rows: DecisionTrack[] }) {
  const [artistGenres, setArtistGenres] = useState<ArtistGenresResponse>({});
  const [playlistsData, setPlaylistsData] = useState<SpotifyPlaylistsResponse | null>(null);
  const [playlistTrackIdsByPlaylist, setPlaylistTrackIdsByPlaylist] = useState<
    Record<string, string[]>
  >({});
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPlaylists = useCallback(() => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/spotify/me/playlists", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Nao foi possivel carregar playlists do Spotify.");
        }

        setPlaylistsData((await response.json()) as SpotifyPlaylistsResponse);
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

  useEffect(() => {
    if (playlists.length === 0 || sortedRows.length === 0) {
      return;
    }

    const suggestedPlaylistIds = new Set(
      sortedRows
        .map((row) => buildPlaylistSuggestion(row, playlists).playlist?.id)
        .filter((playlistId): playlistId is string => Boolean(playlistId)),
    );
    const missingPlaylistIds = [...suggestedPlaylistIds].filter(
      (playlistId) => !(playlistId in playlistTrackIdsByPlaylist),
    );

    if (missingPlaylistIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function loadSuggestedPlaylistTracks() {
      const entries = await Promise.all(
        missingPlaylistIds.map(async (playlistId) => {
          const response = await fetch(`/api/spotify/playlists/${playlistId}/tracks`, {
            cache: "no-store",
          });
          const payload = (await response.json().catch(() => ({}))) as PlaylistTrackIdsResponse;

          return [playlistId, response.ok ? payload.trackIds ?? [] : []] as const;
        }),
      );

      if (cancelled) {
        return;
      }

      setPlaylistTrackIdsByPlaylist((current) => ({
        ...current,
        ...Object.fromEntries(entries),
      }));
    }

    void loadSuggestedPlaylistTracks();

    return () => {
      cancelled = true;
    };
  }, [playlistTrackIdsByPlaylist, playlists, sortedRows]);

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

      if (!response.ok) {
        throw new Error("Nao foi possivel adicionar a faixa.");
      }

      setPlaylistTrackIdsByPlaylist((current) => {
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
    <Container className="border-b border-border py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Mesa de decisao
          </div>
          <h2 className="mt-2 text-2xl font-semibold">Fila de curadoria</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Leitura Kworb BR organizada por streams, com sugestao automatica de playlist
            da sua conta para acelerar a decisao editorial.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadPlaylists} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar playlists
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/60 w-full">
        <table className="w-full divide-y divide-border text-left table-fixed">
          <colgroup>
            <col className="w-[60px]" />
            <col className="w-[30%]" />
            <col className="w-[110px]" />
            <col className="w-[22%]" />
            <col className="w-[90px]" />
            <col className="w-[160px]" />
          </colgroup>
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">Musica</th>
              <th className="px-3 py-3">Streams 24h</th>
              <th className="px-3 py-3">Playlist sugerida</th>
              <th className="px-3 py-3">Gênero</th>
              <th className="px-3 py-3">Acao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma recomendacao disponivel agora.
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => {
                const rowArtistGenres = row.artistIds.flatMap((id) => artistGenres[id] ?? []);
                const suggestion = buildPlaylistSuggestion(row, playlists, rowArtistGenres);
                const isAlreadyInSuggestedPlaylist = suggestion.playlist
                  ? (playlistTrackIdsByPlaylist[suggestion.playlist.id] ?? []).includes(row.trackId)
                  : false;
                const addKey = suggestion.playlist
                  ? `${suggestion.playlist.id}:${row.trackId}`
                  : null;

                return (
                  <tr key={row.trackId} className="hover:bg-muted/10">
                    <td className="px-3 py-3 align-middle">
                      <div className="text-lg font-bold text-white tabular-nums whitespace-nowrap">
                        #{row.streamRank ?? index + 1}
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
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      <div className="text-sm font-semibold tabular-nums">
                        {formatCount(row.dailyStreams)}
                      </div>
                      <div className="text-xs text-muted-foreground">Kworb BR</div>
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
                              : "—"}
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
                            suggestion.style === "rap" ? "yellow" :
                            suggestion.style === "sertanejo" ? "blue" :
                            suggestion.style === "pagode" ? "green" :
                            suggestion.style === "piseiro" ? "slate" :
                            "purple"
                          }
                          className={
                            suggestion.style === "funk"
                              ? "!border-orange-500/30 !bg-orange-500/10 !text-orange-400"
                              : suggestion.style === "piseiro"
                              ? "!border-lime-500/30 !bg-lime-500/10 !text-lime-400"
                              : undefined
                          }
                        >
                          <span className="whitespace-nowrap">
                            {suggestion.style === "funk" ? "Funk" :
                             suggestion.style === "rap" ? "Rap" :
                             suggestion.style === "sertanejo" ? "Sertanejo" :
                             suggestion.style === "pagode" ? "Pagode" :
                             suggestion.style === "piseiro" ? "Piseiro" :
                             "Pop"}
                          </span>
                        </StatusBadge>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {isAlreadyInSuggestedPlaylist ? (
                          <StatusBadge tone="green">On playlist</StatusBadge>
                        ) : !suggestion.hasFit ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={!suggestion.playlist || addingKey === addKey}
                            onClick={() => void handleAddToSuggestedPlaylist(row, suggestion)}
                          >
                            {addingKey === addKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Adicionar
                          </Button>
                        )}
                        <Button asChild size="sm" variant="outline">
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

      {playlistsData && !playlistsData.connected ? (
        <p className="mt-3 text-sm text-muted-foreground">{playlistsData.message}</p>
      ) : null}
    </Container>
  );
}
