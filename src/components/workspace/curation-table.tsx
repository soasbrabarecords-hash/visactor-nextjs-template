"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Music2, RefreshCw } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import type { DecisionTrack } from "@/types/workspace";
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

function detectTrackStyle(row: DecisionTrack) {
  const text = normalizeText(`${row.name} ${row.artists} ${row.albumName}`);

  if (
    [
      "funk",
      "mc ",
      " dj ",
      "mandela",
      "automotivo",
      "montagem",
      "beat fino",
      "phonk",
      "bruxaria",
      "tuto",
      "joaozinho",
      "mk",
    ].some((term) => text.includes(term))
  ) {
    return "funk";
  }

  if (
    ["trap", "rap", "veigh", "matue", "orochi", "oruan", "chefin", "kayblack"].some(
      (term) => text.includes(term),
    )
  ) {
    return "rap";
  }

  if (["dance", "remix", "house", "eletron", "pop"].some((term) => text.includes(term))) {
    return "dance";
  }

  if (["sertanejo", "ze neto", "cristiano", "ana castela"].some((term) => text.includes(term))) {
    return "sertanejo";
  }

  return "discovery";
}

function playlistScore(playlist: SpotifyAccountPlaylist, style: string) {
  const name = normalizeText(playlist.name);
  const styleTerms: Record<string, string[]> = {
    funk: ["funk", "baile", "mandela", "automotivo"],
    rap: ["trap", "rap", "hip hop"],
    dance: ["dance", "remix", "eletron", "pop"],
    sertanejo: ["sertanejo", "agro"],
    discovery: ["hits", "brasil", "viral", "top", "novidades"],
  };

  return (styleTerms[style] ?? styleTerms.discovery).reduce(
    (score, term) => score + (name.includes(term) ? 1 : 0),
    0,
  );
}

function buildPlaylistSuggestion(
  row: DecisionTrack,
  playlists: SpotifyAccountPlaylist[],
): PlaylistSuggestion {
  const style = detectTrackStyle(row);
  const sortedPlaylists = [...playlists].sort(
    (left, right) => playlistScore(right, style) - playlistScore(left, style),
  );
  const match = sortedPlaylists.find((playlist) => playlistScore(playlist, style) > 0) ?? null;
  const styleLabel: Record<string, string> = {
    funk: "Funk / Baile",
    rap: "Rap / Trap",
    dance: "Dance / Pop",
    sertanejo: "Sertanejo",
    discovery: "Discovery",
  };

  if (match) {
    return {
      playlist: match,
      label: match.name,
      style,
      reason: `${styleLabel[style]} detectado e match com playlist da conta.`,
    };
  }

  return {
    playlist: null,
    label: "Playlist de descoberta",
    style,
    reason: `${styleLabel[style]} detectado, mas sem playlist propria com nome compativel.`,
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

  const playlists = playlistsData?.connected ? playlistsData.playlists : [];
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

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
        <table className="min-w-[980px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Musica</th>
              <th className="px-4 py-3">Streams 24h</th>
              <th className="px-4 py-3">Playlist sugerida</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="px-4 py-3">Acao</th>
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
                const suggestion = buildPlaylistSuggestion(row, playlists);
                const isAlreadyInSuggestedPlaylist = suggestion.playlist
                  ? (playlistTrackIdsByPlaylist[suggestion.playlist.id] ?? []).includes(row.trackId)
                  : false;
                const addKey = suggestion.playlist
                  ? `${suggestion.playlist.id}:${row.trackId}`
                  : null;

                return (
                  <tr key={row.trackId} className="hover:bg-muted/10">
                    <td className="px-4 py-4 align-top">
                      <div className="text-2xl font-semibold text-white">
                        #{row.streamRank ?? index + 1}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-14 w-14 shrink-0 rounded-xl border border-border bg-muted shadow-lg"
                          style={coverStyle(row.coverUrl)}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{row.name}</div>
                          <div className="mt-1 max-w-[360px] truncate text-sm text-muted-foreground">
                            {row.artists}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-sm font-semibold">
                        {formatCount(row.dailyStreams)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Kworb BR
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        {suggestion.playlist?.imageUrl ? (
                          <div
                            className="h-10 w-10 shrink-0 rounded-lg border border-border bg-muted"
                            style={coverStyle(suggestion.playlist.imageUrl)}
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                            <Music2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="max-w-[260px] truncate text-sm font-semibold">
                            {suggestion.label}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {suggestion.playlist
                              ? `${formatCount(suggestion.playlist.tracksTotal)} tracks`
                              : "Criar/usar playlist de descoberta"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="max-w-[300px] text-sm text-muted-foreground">
                        {getDecisionLabel(row)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge tone="blue">{suggestion.reason}</StatusBadge>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {isAlreadyInSuggestedPlaylist ? (
                          <StatusBadge tone="green">Ja esta na playlist</StatusBadge>
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
                        <Button size="sm" variant="outline">
                          Observar
                        </Button>
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
