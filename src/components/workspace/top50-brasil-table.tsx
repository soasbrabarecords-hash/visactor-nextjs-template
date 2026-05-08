"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import type { Top50Track, Top50Response } from "@/app/api/spotify/charts/top50-br/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function PopularityBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round(value);
  const color =
    pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-yellow-400" : "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted/40 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs text-muted-foreground">{pct}</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const color =
    rank <= 3
      ? "text-yellow-400 font-black"
      : rank <= 10
        ? "text-yellow-500/80"
        : rank <= 25
          ? "text-emerald-400"
          : "text-muted-foreground";
  return <span className={`text-sm tabular-nums ${color}`}>#{rank}</span>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Top50BrasilTable() {
  const [tracks, setTracks] = useState<Top50Track[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/spotify/charts/top50-br");
        if (!res.ok) throw new Error("Erro ao buscar Top 50");
        const data: Top50Response = await res.json();
        setTracks(data.tracks ?? []);
        setFetchedAt(data.fetchedAt ?? null);
      } catch {
        setError("Falha ao carregar Top 50 Brasil.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const dateLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Container className="border-b border-border py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Spotify Charts
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <h2 className="text-2xl font-semibold">Top 50 Brasil</h2>
          {dateLabel && (
            <span className="text-xs text-muted-foreground">atualizado {dateLabel}</span>
          )}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Faixas mais tocadas no Brasil agora, direto da playlist editorial do Spotify.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando Top 50…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
          {error}
          <p className="mt-1 text-xs">Conecte o Spotify para ver o Top 50 Brasil.</p>
        </div>
      ) : tracks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum dado disponível. Conecte o Spotify para ver o Top 50 Brasil.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
          <table className="w-full table-fixed divide-y divide-border text-left">
            <colgroup>
              <col style={{ width: "52px" }} />
              <col style={{ width: "40px" }} />
              <col />
              <col style={{ width: "130px" }} />
              <col style={{ width: "44px" }} />
            </colgroup>
            <thead className="bg-muted/20">
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-3 py-2.5">Rank</th>
                <th className="px-2 py-2.5"></th>
                <th className="px-3 py-2.5">Faixa</th>
                <th className="px-3 py-2.5">Popularidade</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tracks.map((track) => {
                const spotifyUrl = `https://open.spotify.com/track/${track.trackId}`;
                return (
                  <tr key={track.trackId} className="hover:bg-muted/10">
                    {/* Rank */}
                    <td className="px-3 py-2">
                      <RankBadge rank={track.rank} />
                    </td>

                    {/* Album art */}
                    <td className="px-2 py-2">
                      {track.albumArt ? (
                        <Image
                          src={track.albumArt}
                          alt={track.albumName}
                          width={32}
                          height={32}
                          unoptimized
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted/40" />
                      )}
                    </td>

                    {/* Track info */}
                    <td className="px-3 py-2 min-w-0">
                      <div className="truncate font-semibold leading-tight text-sm">
                        {track.trackName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {track.artist}
                      </div>
                    </td>

                    {/* Popularity */}
                    <td className="px-3 py-2">
                      <PopularityBar value={track.popularity} />
                    </td>

                    {/* Open in Spotify */}
                    <td className="px-3 py-2">
                      <Button asChild size="sm" variant="outline" className="h-7 w-7 p-0">
                        <Link href={spotifyUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
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
