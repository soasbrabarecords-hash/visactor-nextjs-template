"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import StatusBadge from "./status-badge";
import type { BrDailyEntry, BrDailyResponse } from "@/app/api/kworb/br-daily/route";

type SpotifyPlaylist = {
  id: string;
  name: string;
  images?: { url: string }[];
};

// ---------------------------------------------------------------------------
// Genre → playlist keyword mapping
// Keywords that appear in playlist NAMES to identify their genre
// ---------------------------------------------------------------------------
const PLAYLIST_GENRE_KEYWORDS: Record<string, string[]> = {
  funk: ["funk", "baile funk", "bregafunk"],
  sertanejo: ["sertanejo", "caipira", "universitário", "universitario"],
  pagode: ["pagode", "samba", "axé", "axe"],
  rap: ["rap", "hip hop", "hip-hop", "trap", "drill"],
  pop: ["pop"],
  forró: ["forró", "forro", "nordeste", "piseiro", "pisadinha"],
  gospel: ["gospel", "louvor", "cristã", "crista", "worship"],
  rock: ["rock", "indie", "alternativo"],
  eletronica: ["eletronica", "eletrônica", "house", "techno"],
};

// ---------------------------------------------------------------------------
// Artist → genre map for the most common BR chart artists
// Used to infer genre when track name doesn't contain genre keywords
// ---------------------------------------------------------------------------
const ARTIST_GENRE: Record<string, string> = {
  // Funk / Baile Funk
  "mc ryan sp": "funk",
  "mc cabelinho": "funk",
  "mc poze do rodo": "funk",
  "mc binn": "funk",
  "mc kadu": "funk",
  "mc ig": "funk",
  "mc marks": "funk",
  "mc gw": "funk",
  "mc davi": "funk",
  "mc livinho": "funk",
  "mc don juan": "funk",
  "mc kevin": "funk",
  "mc magal": "funk",
  "mc g15": "funk",
  "mc nd": "funk",
  "mc kako": "funk",
  "mc bm": "funk",
  "mc joãozinho vt": "funk",
  "joãozinho vt": "funk",
  "mc leozinho zs": "funk",
  "mc menor mt": "funk",
  "mc lele jp": "funk",
  "mc menigão": "funk",
  "mc tuto": "funk",
  "mc kitinho": "funk",
  "mc rodolfinho": "funk",
  "mc bruninho": "funk",
  "mc phe": "funk",
  "pk": "funk",
  "2t": "funk",
  "tribo da periferia": "funk",
  // Sertanejo / Universitário
  "gusttavo lima": "sertanejo",
  "marilia mendonca": "sertanejo",
  "marília mendonça": "sertanejo",
  "henrique e julianos": "sertanejo",
  "henrique & juliano": "sertanejo",
  "israel novaes": "sertanejo",
  "jorge & mateus": "sertanejo",
  "jorge e mateus": "sertanejo",
  "zé neto & cristiano": "sertanejo",
  "ze neto e cristiano": "sertanejo",
  "matheus e kauan": "sertanejo",
  "matheus & kauan": "sertanejo",
  "maiara e maraisa": "sertanejo",
  "maiara & maraisa": "sertanejo",
  "fernando e sorocaba": "sertanejo",
  "luan santana": "sertanejo",
  "victor e leo": "sertanejo",
  "victor & leo": "sertanejo",
  "leonardo": "sertanejo",
  "chitaozinho e xororo": "sertanejo",
  "ana castela": "sertanejo",
  "brenno e rodolfo": "sertanejo",
  "simone e simaria": "sertanejo",
  "simone & simaria": "sertanejo",
  "lauana prado": "sertanejo",
  "murillo huff": "sertanejo",
  "thiago nigro": "sertanejo",
  "dilsinho": "pagode",
  // Pagode / Samba
  "thiaguinho": "pagode",
  "sorriso maroto": "pagode",
  "grupo menos é mais": "pagode",
  "menos é mais": "pagode",
  "turma do pagode": "pagode",
  "ferrugem": "pagode",
  "mumuzinho": "pagode",
  "belo": "pagode",
  "exaltasamba": "pagode",
  "molejo": "pagode",
  // Rap / Trap BR
  "mc hariel": "rap",
  "coruja bc1": "rap",
  "emicida": "rap",
  "racionais mcs": "rap",
  "djonga": "rap",
  "bk": "rap",
  "filipe ret": "rap",
  "orochi": "rap",
  "poze do rodo": "rap",
  "xamã": "rap",
  "chefin": "rap",
  "lil tecca": "rap",
  // Forró / Piseiro
  "vitor fernandes": "forró",
  "xand avião": "forró",
  "wesley safadão": "forró",
  "barões da pisadinha": "forró",
  "george henrique e rodrigo": "forró",
  "raí saia rodada": "forró",
  "tierry": "forró",
  "nattan": "forró",
  "danniel vieira": "forró",
  // Gospel
  "gabriela rocha": "gospel",
  "aline barros": "gospel",
  "fernandinho": "gospel",
  "isadora pompeo": "gospel",
  "thalles roberto": "gospel",
  "anderson freire": "gospel",
  "bruna karla": "gospel",
  "preto no branco": "gospel",
  "kemuel": "gospel",
  "ministério zoe": "gospel",
};

/**
 * Infer genre from track name + artist.
 * 1. Check artist name against known artist→genre map (most reliable)
 * 2. Check track name + artist text for genre keywords in playlist map
 * Returns a set of matched genre keys, or empty set if nothing found.
 */
function inferTrackGenres(trackName: string, artist: string): Set<string> {
  const genres = new Set<string>();
  const artistLower = artist.toLowerCase();
  const trackLower = trackName.toLowerCase();
  const fullText = `${trackLower} ${artistLower}`;

  // 1. Artist lookup — most reliable signal
  for (const [artistKey, genre] of Object.entries(ARTIST_GENRE)) {
    if (artistLower.includes(artistKey)) {
      genres.add(genre);
    }
  }

  // 2. Keyword scan on track name + artist text
  for (const [genre, keywords] of Object.entries(PLAYLIST_GENRE_KEYWORDS)) {
    if (keywords.some((kw) => fullText.includes(kw))) {
      genres.add(genre);
    }
  }

  return genres;
}

/**
 * Suggest playlists based on track genre.
 * Only returns playlists where there is a confirmed genre match —
 * no partial/fallback scoring that pollutes results.
 */
function suggestPlaylists(
  trackName: string,
  artist: string,
  playlists: SpotifyPlaylist[],
): SpotifyPlaylist[] {
  if (playlists.length === 0) return [];

  const trackGenres = inferTrackGenres(trackName, artist);

  // No genre detected → no suggestions (better than wrong suggestions)
  if (trackGenres.size === 0) return [];

  const results: { pl: SpotifyPlaylist; score: number }[] = [];

  for (const pl of playlists) {
    const plName = pl.name.toLowerCase();
    let score = 0;

    for (const genre of trackGenres) {
      const keywords = PLAYLIST_GENRE_KEYWORDS[genre] ?? [];
      // Count how many keywords from this genre appear in the playlist name
      const hits = keywords.filter((kw) => plName.includes(kw)).length;
      if (hits > 0) {
        score += hits * 2; // each keyword hit adds weight
      }
    }

    if (score > 0) {
      results.push({ pl, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.pl);
}

function formatStreams(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function RankBadge({ rank }: { rank: number }) {
  const color =
    rank <= 10
      ? "text-yellow-400"
      : rank <= 50
        ? "text-emerald-400"
        : "text-muted-foreground";
  return (
    <span className={`text-sm font-bold tabular-nums ${color}`}>
      #{rank}
    </span>
  );
}

export default function CurationTable() {
  const [chart, setChart] = useState<BrDailyEntry[]>([]);
  const [chartDate, setChartDate] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [chartRes, playlistRes] = await Promise.all([
          fetch("/api/kworb/br-daily"),
          fetch("/api/spotify/me/playlists"),
        ]);

        if (chartRes.ok) {
          const chartData: BrDailyResponse = await chartRes.json();
          setChart(chartData.entries ?? []);
          setChartDate(chartData.date ?? null);
        }

        if (playlistRes.ok) {
          const plData = await playlistRes.json();
          // Could be { items: [...] } or just an array depending on route shape
          const items: SpotifyPlaylist[] = Array.isArray(plData)
            ? plData
            : (plData.items ?? []);
          setPlaylists(items);
        }
      } catch {
        setError("Falha ao carregar ranking Kworb.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Ranking Kworb
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <h2 className="text-2xl font-semibold">Top 200 Daily BR — Spotify</h2>
          {chartDate && (
            <span className="text-xs text-muted-foreground">{chartDate}</span>
          )}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Streams diários do Kworb.net com sugestão de playlist baseada no
          gênero da faixa e nos títulos das suas playlists conectadas.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando ranking…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
          <table className="min-w-[1080px] w-full divide-y divide-border text-left">
            <thead className="bg-muted/20">
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Faixa</th>
                <th className="px-4 py-3">Streams hoje</th>
                <th className="px-4 py-3">Playlist sugerida</th>
                <th className="px-4 py-3">Abrir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {chart.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum dado disponível. Tente novamente em instantes.
                  </td>
                </tr>
              ) : (
                chart.map((entry) => {
                  const suggested = suggestPlaylists(
                    entry.trackName,
                    entry.artist,
                    playlists,
                  );
                  const spotifyUrl = `https://open.spotify.com/track/${entry.trackId}`;

                  return (
                    <tr key={entry.trackId} className="hover:bg-muted/10">
                      {/* Rank */}
                      <td className="px-4 py-3">
                        <RankBadge rank={entry.rank} />
                      </td>

                      {/* Track info */}
                      <td className="px-4 py-3">
                        <div className="font-semibold leading-tight">
                          {entry.trackName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {entry.artist}
                        </div>
                      </td>

                      {/* Daily streams */}
                      <td className="px-4 py-3 text-sm font-medium tabular-nums">
                        {entry.dailyStreams !== null ? (
                          <span className="text-emerald-400">
                            {formatStreams(entry.dailyStreams)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Suggested playlists */}
                      <td className="px-4 py-3">
                        {suggested.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {suggested.map((pl) => (
                              <Link
                                key={pl.id}
                                href={`/curadoria/playlists/${pl.id}`}
                              >
                                <StatusBadge tone="green">
                                  {pl.name}
                                </StatusBadge>
                              </Link>
                            ))}
                          </div>
                        ) : playlists.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Conecte o Spotify para ver sugestões
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sem match direto
                          </span>
                        )}
                      </td>

                      {/* Open in Spotify */}
                      <td className="px-4 py-3">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={spotifyUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
