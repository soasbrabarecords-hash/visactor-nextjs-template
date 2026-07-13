"use client";

/**
 * PlaylistKworbSuggestions
 * Shown at the bottom of the playlist editor page.
 * Uses genre-detection.ts (same logic as curation-table) so genre matching is consistent.
 */

import { useEffect, useState } from "react";
import { Loader2, Plus, Check } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import { invalidateSpotifyAccountPlaylistsClientCache } from "@/lib/spotify-account-playlists-client";
import StatusBadge from "./status-badge";
import { detectGenre, detectPlaylistGenre, GENRE_LABEL, type TrackGenre } from "@/lib/genre-detection";
import type { BrDailyEntry, BrDailyResponse } from "@/app/api/kworb/br-daily/route";

type SuggestionState = "idle" | "adding" | "added" | "error";

const GENRE_TONE: Record<TrackGenre, "blue" | "green" | "yellow" | "slate" | "purple"> = {
  funk: "slate",
  trap: "yellow",
  rap: "yellow",
  sertanejo: "blue",
  pagode: "green",
  pagodao: "green",
  piseiro: "slate",
  pop: "purple",
  rock: "slate",
  reggae: "green",
  unknown: "slate",
};

export default function PlaylistKworbSuggestions({
  playlistId,
  playlistName,
  playlistDescription,
  currentTrackIds,
}: {
  playlistId: string;
  playlistName: string;
  playlistDescription: string;
  currentTrackIds: string[];
}) {
  const [entries, setEntries] = useState<BrDailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [buttonState, setButtonState] = useState<Record<string, SuggestionState>>({});

  const vibe = detectPlaylistGenre(playlistName, playlistDescription);
  const currentSet = new Set(currentTrackIds);

  useEffect(() => {
    fetch("/api/kworb/br-daily")
      .then((r) => r.json())
      .then((data: BrDailyResponse) => setEntries(data.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  // Filter: same genre as playlist + not already in it
  const suggestions = entries.filter((e) => {
    if (currentSet.has(e.trackId)) return false;
    const trackGenre = detectGenre(e.artist, e.trackName);
    return trackGenre === vibe;
  }).slice(0, 20);

  async function handleAdd(entry: BrDailyEntry) {
    setButtonState((s) => ({ ...s, [entry.trackId]: "adding" }));
    try {
      const res = await fetch(`/api/spotify/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackUri: `spotify:track:${entry.trackId}` }),
      });
      if (!res.ok) throw new Error("Failed");
      invalidateSpotifyAccountPlaylistsClientCache();
      setButtonState((s) => ({ ...s, [entry.trackId]: "added" }));
    } catch {
      setButtonState((s) => ({ ...s, [entry.trackId]: "error" }));
      setTimeout(() => {
        setButtonState((s) => ({ ...s, [entry.trackId]: "idle" }));
      }, 2000);
    }
  }

  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Sugestões Kworb
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <h2 className="text-2xl font-semibold">Top 200 BR — compatíveis com esta playlist</h2>
          {vibe !== "unknown" && (
            <StatusBadge tone={GENRE_TONE[vibe]}>{GENRE_LABEL[vibe]}</StatusBadge>
          )}
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Faixas do Kworb Top 200 BR Daily que combinam com a vibe desta playlist e ainda não estão nela.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando sugestões…
        </div>
      ) : vibe === "unknown" ? (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
          Não foi possível detectar o gênero desta playlist pelo nome/descrição.
          <br />
          Inclua um termo de gênero no nome (ex: funk, trap, sertanejo, pagode) para ativar as sugestões.
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma sugestão compatível no Top 200 BR agora.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
          <table className="w-full table-fixed divide-y divide-border text-left">
            <colgroup>
              <col style={{ width: "52px" }} />
              <col />
              <col style={{ width: "110px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead className="bg-muted/20">
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Faixa</th>
                <th className="px-4 py-3">Streams hoje</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {suggestions.map((entry) => {
                const state = buttonState[entry.trackId] ?? "idle";
                const added = state === "added";
                return (
                  <tr key={entry.trackId} className="hover:bg-muted/10">
                    <td className="px-4 py-3 text-sm font-bold tabular-nums text-muted-foreground">
                      #{entry.rank}
                    </td>
                    <td className="min-w-0 px-4 py-3">
                      <div className="truncate font-semibold leading-tight text-sm">
                        {entry.trackName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {entry.artist}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium tabular-nums text-emerald-400">
                      {entry.dailyStreams !== null
                        ? entry.dailyStreams >= 1_000_000
                          ? `${(entry.dailyStreams / 1_000_000).toFixed(1)}M`
                          : entry.dailyStreams >= 1_000
                          ? `${(entry.dailyStreams / 1_000).toFixed(0)}K`
                          : String(entry.dailyStreams)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {added ? (
                        <StatusBadge tone="green">
                          <Check className="mr-1 h-3 w-3" />
                          Já está na playlist
                        </StatusBadge>
                      ) : (
                        <Button
                          size="sm"
                          disabled={state === "adding"}
                          onClick={() => void handleAdd(entry)}
                        >
                          {state === "adding" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          Adicionar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
