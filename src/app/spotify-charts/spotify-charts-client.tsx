"use client";

import React, { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  FileUp,
  Loader2,
  Minus,
  Sparkles,
} from "lucide-react";
import type {
  ChartSnapshot,
  ChartSnapshotTrackWithMovement,
} from "@/lib/chart-snapshots";
import SpotifyPlaylistAddButton from "@/components/workspace/spotify-playlist-add-button";
import StatusBadge from "@/components/workspace/status-badge";

type SnapshotData = {
  snapshot: ChartSnapshot | null;
  tracks: ChartSnapshotTrackWithMovement[];
  previousDate: string | null;
};

type Props = {
  initialDates: string[];
  initialDate: string | null;
  initialSnapshot: SnapshotData | null;
  country: string;
};

function coverStyle(coverUrl: string | null): React.CSSProperties | undefined {
  if (!coverUrl) return undefined;
  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function getMovementTone(status: "new" | "up" | "down" | "stable") {
  if (status === "new") return "purple";
  if (status === "up") return "green";
  if (status === "down") return "red";
  return "slate";
}

function getMovementLabel(
  status: "new" | "up" | "down" | "stable",
  change: number | null,
) {
  if (status === "new") return "NEW";
  if (status === "up") return `+${Math.abs(change ?? 0)}`;
  if (status === "down") return `-${Math.abs(change ?? 0)}`;
  return "—";
}

function MovementIcon({
  status,
  change,
}: {
  status: "new" | "up" | "down" | "stable";
  change: number | null;
}) {
  if (status === "new") {
    return (
      <StatusBadge tone="purple" className="px-2 py-0.5 text-[10px]">
        <Sparkles className="mr-1 h-3 w-3" />
        NEW
      </StatusBadge>
    );
  }

  if (status === "up") {
    return (
      <StatusBadge tone="green" className="px-2 py-0.5 text-[10px]">
        <ArrowUp className="mr-1 h-3 w-3" />
        {Math.abs(change ?? 0)}
      </StatusBadge>
    );
  }

  if (status === "down") {
    return (
      <StatusBadge tone="red" className="px-2 py-0.5 text-[10px]">
        <ArrowDown className="mr-1 h-3 w-3" />
        {Math.abs(change ?? 0)}
      </StatusBadge>
    );
  }

  return (
    <StatusBadge tone="slate" className="px-2 py-0.5 text-[10px]">
      <Minus className="mr-1 h-3 w-3" />
      —
    </StatusBadge>
  );
}

function StreamsCell({
  streams,
  growthPct,
}: {
  streams: number | null;
  growthPct: number | null;
}) {
  if (streams === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="font-medium text-white">{formatCount(streams)}</span>
      {growthPct !== null ? (
        <span
          className={`text-[10px] font-medium ${
            growthPct >= 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {growthPct >= 0 ? "+" : ""}
          {growthPct.toFixed(1)}%
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground">Sem hist.</span>
      )}
    </span>
  );
}

export default function SpotifyChartsClient({
  initialDates,
  initialDate,
  initialSnapshot,
  country,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [dates, setDates] = useState<string[]>(initialDates);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(initialSnapshot);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [loadingDate, setLoadingDate] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFile(file: File) {
    setUploading(true);
    setUploadMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("country", country);
      const res = await fetch("/api/import/spotify-charts-csv", {
        method: "POST",
        body: formData,
      });
      const payload = (await res.json()) as {
        success: boolean;
        importedCount: number;
        skippedCount: number;
        errors: string[];
      };

      if (!res.ok || !payload.success) {
        setUploadMsg({
          ok: false,
          text: payload.errors[0] ?? "Erro ao importar CSV.",
        });
        return;
      }

      setUploadMsg({
        ok: true,
        text: `${payload.importedCount} faixas importadas. ${payload.skippedCount} puladas.`,
      });
      const datesRes = await fetch(`/api/charts/snapshot-dates?country=${country}`);
      const datesData = (await datesRes.json()) as { dates: string[] };
      const newDates = datesData.dates ?? [];
      setDates(newDates);

      if (newDates[0] && newDates[0] !== selectedDate) {
        await loadSnapshot(newDates[0]);
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setUploadMsg({ ok: false, text: "Falha ao importar. Tente novamente." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function loadSnapshot(date: string) {
    setLoadingDate(true);
    setSelectedDate(date);

    try {
      const res = await fetch(`/api/charts/snapshot?date=${date}&country=${country}`);
      if (!res.ok) {
        setSnapshot(null);
        return;
      }

      const data = (await res.json()) as SnapshotData;
      setSnapshot(data);
    } catch {
      setSnapshot(null);
    } finally {
      setLoadingDate(false);
    }
  }

  const tracks = useMemo(() => snapshot?.tracks ?? [], [snapshot?.tracks]);
  const prevDate = snapshot?.previousDate ?? null;
  const hasHistory = dates.length > 0;

  const topTrack = tracks[0] ?? null;
  const biggestRise = useMemo(
    () =>
      [...tracks]
        .filter((track) => track.status === "up")
        .sort(
          (left, right) =>
            Math.abs(right.position_change ?? 0) -
            Math.abs(left.position_change ?? 0),
        )[0] ?? null,
    [tracks],
  );
  const newEntries = useMemo(
    () => tracks.filter((track) => track.status === "new").length,
    [tracks],
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-border bg-[linear-gradient(135deg,rgba(8,12,20,0.98),rgba(11,33,28,0.96),rgba(22,101,52,0.26))] p-5 shadow-[0_28px_90px_-42px_rgba(22,163,74,0.35)]">
        <div className="grid gap-5 laptop:grid-cols-[1.18fr_0.82fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="green">Spotify Charts BR</StatusBadge>
              {selectedDate ? (
                <StatusBadge tone="slate">{formatDate(selectedDate)}</StatusBadge>
              ) : null}
              {prevDate ? (
                <StatusBadge tone="blue">vs {formatDate(prevDate)}</StatusBadge>
              ) : null}
            </div>

            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white laptop:text-4xl">
              Historico diario do Top 200 com leitura rapida de subida, queda e novas entradas.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
              Importa o CSV do Spotify Charts, salva snapshots diarios e deixa a
              comparacao pronta para curadoria e decisao rapida.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-slate-950 transition hover:bg-white/90 disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileUp size={15} />
                )}
                {uploading ? "Importando..." : "Importar CSV"}
              </button>
              <div className="inline-flex h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/70">
                {uploadMsg ? (
                  <span className={uploadMsg.ok ? "text-emerald-300" : "text-red-300"}>
                    {uploadMsg.text}
                  </span>
                ) : (
                  "Nome do arquivo com data, ex: 2025-04-20"
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 tablet:grid-cols-3 laptop:grid-cols-1">
            <article className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                Snapshot
              </div>
              <div className="mt-3 text-3xl font-semibold">
                {hasHistory ? formatCount(tracks.length) : "0"}
              </div>
              <p className="mt-2 text-sm text-white/65">faixas carregadas na data.</p>
            </article>
            <article className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                Maior subida
              </div>
              <div className="mt-3 text-2xl font-semibold">
                {biggestRise?.position_change
                  ? `+${Math.abs(biggestRise.position_change)}`
                  : "—"}
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-white/65">
                {biggestRise?.track_name ?? "Sem leitura de subida forte agora."}
              </p>
            </article>
            <article className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                Novas entradas
              </div>
              <div className="mt-3 text-3xl font-semibold">{newEntries}</div>
              <p className="mt-2 text-sm text-white/65">
                faixas novas no recorte do dia.
              </p>
            </article>
          </div>
        </div>
      </section>

      {hasHistory ? (
        <section className="rounded-[28px] border border-border bg-card/60 p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.9)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Dias disponiveis
              </div>
              <h3 className="mt-2 text-xl font-semibold">Escolha o snapshot</h3>
            </div>
            <StatusBadge tone="blue">{dates.length} dias</StatusBadge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {dates.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => void loadSnapshot(date)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  date === selectedDate
                    ? "border-white bg-white text-slate-950"
                    : "border-border bg-background/60 text-foreground hover:bg-muted/60"
                }`}
              >
                {formatDate(date)}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-border px-6 py-20 text-center">
          <div className="text-lg font-medium">Nenhum snapshot salvo ainda.</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Importe um CSV do Spotify Charts para iniciar o historico.
          </p>
        </section>
      )}

      {hasHistory && selectedDate ? (
        <section className="overflow-hidden rounded-[30px] border border-border bg-card/60 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.9)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
            <div className="flex items-center gap-4">
              <div
                className="h-16 w-16 rounded-[20px] border border-border bg-muted"
                style={coverStyle(topTrack?.image_url ?? null)}
              />
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Top 200
                </div>
                <h3 className="mt-1 text-xl font-semibold">
                  {selectedDate ? formatDate(selectedDate) : "Sem data"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {prevDate
                    ? `Comparando com ${formatDate(prevDate)}`
                    : "Primeiro snapshot sem comparacao disponivel"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="green">{tracks.length} faixas</StatusBadge>
              {topTrack ? (
                <StatusBadge tone={getMovementTone(topTrack.status)}>
                  Lider {getMovementLabel(topTrack.status, topTrack.position_change)}
                </StatusBadge>
              ) : null}
            </div>
          </div>

          {loadingDate ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : tracks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 py-3 text-center">#</th>
                    <th className="px-4 py-3 text-center">Mov.</th>
                    <th className="px-4 py-3 text-left">Faixa</th>
                    <th className="px-4 py-3 text-right">Streams</th>
                    <th className="px-4 py-3 text-left">Genero</th>
                    <th className="px-4 py-3 text-center">Add</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tracks.map((track) => (
                    <tr
                      key={track.id}
                      className="hover:bg-muted/10"
                    >
                      <td className="px-4 py-3 text-center align-top">
                        <div className="text-lg font-semibold text-white">
                          #{track.position}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <MovementIcon
                          status={track.status}
                          change={track.position_change}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-12 w-12 shrink-0 rounded-xl border border-border bg-muted"
                            style={coverStyle(track.image_url ?? null)}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-semibold leading-tight">
                              {track.spotify_track_id ? (
                                <a
                                  href={`https://open.spotify.com/track/${track.spotify_track_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-emerald-300"
                                >
                                  {track.track_name}
                                </a>
                              ) : (
                                track.track_name
                              )}
                            </div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {track.artist_name ?? "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right align-top font-mono text-xs">
                        <StreamsCell
                          streams={track.streams}
                          growthPct={track.stream_growth_percent}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {track.genre ? (
                          <StatusBadge tone="slate" className="normal-case tracking-[0.04em]">
                            {track.genre}
                          </StatusBadge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        {track.spotify_track_id ? (
                          <SpotifyPlaylistAddButton
                            spotifyTrackId={track.spotify_track_id}
                            compact
                            className="h-8 w-8 rounded-full border-border bg-background/80 px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              Nenhuma faixa encontrada para esta data.
            </p>
          )}
        </section>
      ) : null}

      {tracks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="font-medium">Legenda</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <ArrowUp size={12} />
            Subiu
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <ArrowDown size={12} />
            Caiu
          </span>
          <span className="flex items-center gap-1">
            <Minus size={12} />
            Estavel
          </span>
          <span className="flex items-center gap-1 text-violet-400">
            <Sparkles size={12} />
            Novo no chart
          </span>
        </div>
      ) : null}
    </div>
  );
}
