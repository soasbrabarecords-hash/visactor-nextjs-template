"use client";

/**
 * PlaylistKworbSuggestions
 *
 * Shown at the bottom of the playlist editor page.
 * Fetches Kworb BR Top 200, filters by the playlist genre,
 * excludes tracks already in the playlist, and lets the user
 * add tracks directly to the playlist being edited.
 *
 * Does NOT touch PlaylistEditor, CurationTable, or any other component.
 */

import { useEffect, useState } from "react";
import { Loader2, Plus, Check } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import StatusBadge from "./status-badge";
import type { BrDailyEntry, BrDailyResponse } from "@/app/api/kworb/br-daily/route";

// ---------------------------------------------------------------------------
// Genre detection — mirrors curation-table.tsx logic but simplified to vibe
// ---------------------------------------------------------------------------

type Vibe =
  | "funk"
  | "rap"
  | "sertanejo"
  | "pagode"
  | "piseiro"
  | "pop"
  | "reggae"
  | "unknown";

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function matches(text: string, terms: string[]) {
  return terms.some((t) => text.includes(t));
}

// ---------------------------------------------------------------------------
// Each playlist keyword maps to exactly ONE vibe — no overlaps.
// Each artist/track keyword maps to exactly ONE vibe — no overlaps.
// This prevents "samba" playlists from getting "pagode" suggestions and vice-versa.
// ---------------------------------------------------------------------------

const PLAYLIST_VIBE_MAP: Array<[string[], Vibe]> = [
  // funk — checked before rap so "mc" doesn't bleed into rap
  [["funk", "baile", "mandelao", "automotivo", "proibidao", "rave"], "funk"],
  // rap/trap — "trap" and "rap" each belong here exclusively
  [["trap", "rap", "drill", "hip hop", "hip-hop"], "rap"],
  // sertanejo
  [["sertanejo", "modao", "agro", "universitario", "caipira"], "sertanejo"],
  // pagode — "pagode" only; "samba" is a separate entry below
  [["pagode"], "pagode"],
  // samba — maps to pagode vibe (same bucket) but only triggered by "samba"
  [["samba"], "pagode"],
  // piseiro
  [["piseiro", "pisadinha", "forro", "nordeste", "xote"], "piseiro"],
  // pop
  [["pop", "hits", "viral", "top", "internacional"], "pop"],
  // reggae
  [["reggae", "roots"], "reggae"],
];

const TRACK_VIBE_MAP: Array<[string[], Vibe]> = [
  // funk artists/terms — "mc" prefix is a funk signal here
  [["funk", "baile", "mandelao", "automotivo", "proibidao", "rave",
    "poze do rodo", "pedro sampaio", "anitta",
    "mc ryan sp", "mc ig", "mc luuky", "mc gu", "lele jp",
  ], "funk"],
  // rap/trap artists — do NOT include "mc" here (MC is funk)
  [["trap", "drill",
    "veigh", "matue", "matuê", "sotam", "mc cabelinho", "kayblack",
    "supernova ent", "marina sena",
    "racionais", "charlie brown", "bk",
    "nanda tsunami", "nandatsunami", "2zdnizz", "hhr",
    "poesia acustica",
  ], "rap"],
  // sertanejo
  [["sertanejo", "modao", "agro", "universitario",
    "ze neto", "cristiano", "murilo huff", "marilia mendonca", "gusttavo lima",
    "simone mendes", "luan santana", "zeze di camargo",
    "henrique e juliano", "henrique & juliano",
    "matheus e kauan", "matheus & kauan",
    "maiara e maraisa", "maiara & maraisa",
    "ze felipe", "lauana prado",
    "guilherme e benuto", "guilherme & benuto",
  ], "sertanejo"],
  // pagode — "pagode" keyword only
  [["pagode",
    "menos e mais", "ferrugem", "thiaguinho", "sorriso maroto",
    "turma do pagode", "mumuzinho", "molejo",
  ], "pagode"],
  // samba — mapped to pagode vibe
  [["samba"], "pagode"],
  // piseiro
  [["piseiro", "pisadinha", "forro",
    "vitinho imperator", "nattan", "ze vaqueiro",
    "mari fernandez", "grelo", "natanzinho lima",
  ], "piseiro"],
  // pop
  [["kpop", "michael jackson", "justin bieber", "bts"], "pop"],
  // reggae
  [["natiruts", "reggae", "o rappa"], "reggae"],
];

/** Infer vibe from playlist name + description — first match wins */
function inferPlaylistVibe(name: string, description: string): Vibe {
  const t = normalize(`${name} ${description}`);
  for (const [terms, vibe] of PLAYLIST_VIBE_MAP) {
    if (matches(t, terms)) return vibe;
  }
  return "unknown";
}

/** Check if a Kworb track belongs to the target vibe — first match wins */
function trackMatchesVibe(entry: BrDailyEntry, vibe: Vibe): boolean {
  if (vibe === "unknown") return false;
  const t = normalize(`${entry.trackName} ${entry.artist}`);
  for (const [terms, trackVibe] of TRACK_VIBE_MAP) {
    if (matches(t, terms)) return trackVibe === vibe;
  }
  return false; // no match → don't suggest
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type SuggestionState = "idle" | "adding" | "added" | "error";

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

  const vibe = inferPlaylistVibe(playlistName, playlistDescription);
  const currentSet = new Set(currentTrackIds);

  useEffect(() => {
    fetch("/api/kworb/br-daily")
      .then((r) => r.json())
      .then((data: BrDailyResponse) => {
        setEntries(data.entries ?? []);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const suggestions = entries.filter(
    (e) => !currentSet.has(e.trackId) && trackMatchesVibe(e, vibe),
  ).slice(0, 20);

  async function handleAdd(entry: BrDailyEntry) {
    setButtonState((s) => ({ ...s, [entry.trackId]: "adding" }));
    try {
      const res = await fetch(`/api/spotify/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackUri: `spotify:track:${entry.trackId}` }),
      });
      if (!res.ok) throw new Error("Failed");
      setButtonState((s) => ({ ...s, [entry.trackId]: "added" }));
    } catch {
      setButtonState((s) => ({ ...s, [entry.trackId]: "error" }));
      setTimeout(() => {
        setButtonState((s) => ({ ...s, [entry.trackId]: "idle" }));
      }, 2000);
    }
  }

  const vibeLabel: Record<Vibe, string> = {
    funk: "Funk",
    rap: "Rap/Trap",
    sertanejo: "Sertanejo",
    pagode: "Pagode/Samba",
    piseiro: "Piseiro/Forró",
    pop: "Pop",
    reggae: "Reggae",
    unknown: "Desconhecido",
  };

  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Sugestões Kworb
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <h2 className="text-2xl font-semibold">Top 200 BR — compatíveis com esta playlist</h2>
          {vibe !== "unknown" && (
            <StatusBadge tone="blue">{vibeLabel[vibe]}</StatusBadge>
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
          Renomeie a playlist com um termo de gênero (ex: funk, trap, sertanejo) para ativar as sugestões.
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
              <col style={{ width: "100px" }} />
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
