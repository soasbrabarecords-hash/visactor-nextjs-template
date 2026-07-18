"use client";

import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  Minus,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState, useTransition } from "react";
import SpotifyPlaylistAddButton from "@/components/workspace/spotify-playlist-add-button";
import StatusBadge from "@/components/workspace/status-badge";
import type {
  ChartSnapshot,
  ChartSnapshotTrackWithMovement,
} from "@/lib/chart-snapshots";
import type { SpotifyChartRun } from "@/lib/charts/spotify-chart-runs";

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
  latestAutomaticRun: SpotifyChartRun | null;
  canBackfill: boolean;
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

function formatTimestamp(value: string | null) {
  if (!value) return "Ainda nao executado";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function isAutomaticRunResolved(run: SpotifyChartRun | null) {
  return run?.status === "error" && run.resolved_by_complete_snapshot;
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
      <Minus className="mr-1 h-3 w-3" />—
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
  latestAutomaticRun,
  canBackfill,
}: Props) {
  const router = useRouter();

  const [dates, setDates] = useState<string[]>(initialDates);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(
    initialSnapshot,
  );
  const [loadingDate, setLoadingDate] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    (
      initialDate ??
      initialDates[0] ??
      new Date().toISOString().slice(0, 10)
    ).slice(0, 7),
  );
  const [backfillCountry, setBackfillCountry] = useState(country);
  const [backfillStartDate, setBackfillStartDate] = useState("");
  const [backfillEndDate, setBackfillEndDate] = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setDates(initialDates);
    setSelectedDate(initialDate);
    setSnapshot(initialSnapshot);
    setVisibleMonth(
      (
        initialDate ??
        initialDates[0] ??
        new Date().toISOString().slice(0, 10)
      ).slice(0, 7),
    );
    setCalendarOpen(false);
    setLoadingDate(false);
  }, [country, initialDate, initialDates, initialSnapshot]);

  async function loadSnapshot(date: string) {
    setLoadingDate(true);
    setSelectedDate(date);
    setVisibleMonth(date.slice(0, 7));
    setCalendarOpen(false);

    try {
      const res = await fetch(
        `/api/charts/snapshot?date=${date}&country=${country}`,
      );
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

  async function handleBackfill() {
    setBackfilling(true);
    setBackfillMessage(null);

    try {
      const response = await fetch("/api/spotify-charts/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: backfillCountry,
          chart_type: "top-songs",
          start_date: backfillStartDate,
          end_date: backfillEndDate,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: number;
        failed?: number;
        rows_count?: number;
        error?: string;
      } | null;

      if (!response.ok || payload?.error) {
        setBackfillMessage(payload?.error ?? "Falha ao importar historico.");
        return;
      }

      setBackfillMessage(
        `${payload?.success ?? 0} dias importados, ${payload?.failed ?? 0} falharam, ${formatCount(payload?.rows_count ?? 0)} faixas salvas.`,
      );
      const datesResponse = await fetch(
        `/api/charts/snapshot-dates?country=${country}`,
      );
      const datesPayload = (await datesResponse.json()) as { dates?: string[] };
      setDates(datesPayload.dates ?? dates);
      startTransition(() => router.refresh());
    } catch {
      setBackfillMessage("Falha de rede ao importar historico.");
    } finally {
      setBackfilling(false);
    }
  }

  const tracks = useMemo(() => snapshot?.tracks ?? [], [snapshot?.tracks]);
  const prevDate = snapshot?.previousDate ?? null;
  const hasHistory = dates.length > 0;
  const availableDates = useMemo(() => new Set(dates), [dates]);
  const selectedDateIndex = selectedDate ? dates.indexOf(selectedDate) : -1;
  const newerDate = selectedDateIndex > 0 ? dates[selectedDateIndex - 1] : null;
  const olderDate =
    selectedDateIndex >= 0 && selectedDateIndex < dates.length - 1
      ? dates[selectedDateIndex + 1]
      : null;
  const calendarDays = useMemo(() => {
    const [year, month] = visibleMonth.split("-").map(Number);
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const leadingEmptyDays = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return [
      ...Array.from({ length: leadingEmptyDays }, () => null),
      ...Array.from(
        { length: daysInMonth },
        (_, index) => `${visibleMonth}-${String(index + 1).padStart(2, "0")}`,
      ),
    ];
  }, [visibleMonth]);

  function changeMonth(offset: number) {
    const [year, month] = visibleMonth.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, month - 1 + offset, 1));
    setVisibleMonth(nextMonth.toISOString().slice(0, 7));
  }

  const topTrack = tracks[0] ?? null;

  function changeCountry(nextCountry: string) {
    if (nextCountry === country) return;
    setLoadingDate(true);
    setCalendarOpen(false);
    router.replace(`/spotify-charts?country=${nextCountry}`);
  }

  return (
    <div className="flex h-[calc(100dvh-112px)] min-h-0 flex-col gap-3 overflow-hidden">
      <section className="shrink-0 overflow-hidden rounded-[20px] border border-border bg-[linear-gradient(135deg,rgba(8,12,20,0.98),rgba(11,33,28,0.96),rgba(22,101,52,0.26))] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="green">
            Spotify Charts {country === "GLOBAL" ? "Global" : "Brasil"}
          </StatusBadge>
          {selectedDate ? (
            <StatusBadge tone="slate">{formatDate(selectedDate)}</StatusBadge>
          ) : null}
          {prevDate ? (
            <StatusBadge tone="blue">vs {formatDate(prevDate)}</StatusBadge>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/65">
          <StatusBadge
            tone={
              latestAutomaticRun?.status === "success" ||
              isAutomaticRunResolved(latestAutomaticRun)
                ? "green"
                : latestAutomaticRun?.status === "error"
                  ? "red"
                  : "slate"
            }
          >
            Auto:{" "}
            {isAutomaticRunResolved(latestAutomaticRun)
              ? "resolvido"
              : (latestAutomaticRun?.status ?? "sem execucao")}
          </StatusBadge>
          <span>
            Ultima atualizacao:{" "}
            {formatTimestamp(
              latestAutomaticRun?.finished_at ??
                latestAutomaticRun?.started_at ??
                null,
            )}
          </span>
          {latestAutomaticRun?.status === "success" ? (
            <span>{latestAutomaticRun.rows_count} linhas salvas</span>
          ) : null}
          {isAutomaticRunResolved(latestAutomaticRun) ? (
            <span className="text-emerald-300">
              Snapshot Top 200 integro; erro anterior reconciliado.
            </span>
          ) : null}
          {latestAutomaticRun?.status === "error" &&
          !isAutomaticRunResolved(latestAutomaticRun) &&
          latestAutomaticRun.error_message ? (
            <span className="max-w-xl text-red-300">
              {latestAutomaticRun.error_message}
            </span>
          ) : null}
        </div>
      </section>

      {hasHistory ? (
        <section className="relative z-20 shrink-0 rounded-[20px] border border-border bg-card/80 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={country}
                onChange={(event) => changeCountry(event.target.value)}
                aria-label="Pais do chart"
                className="h-9 rounded-full border border-border bg-background px-3 text-sm font-medium"
              >
                <option value="BR">Brasil</option>
                <option value="GLOBAL">Global</option>
              </select>
              <StatusBadge tone="slate">Top Songs</StatusBadge>
              <StatusBadge tone="green">{tracks.length} faixas</StatusBadge>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!olderDate}
                onClick={() => olderDate && void loadSnapshot(olderDate)}
                aria-label="Dia anterior"
                title="Dia anterior"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background transition hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCalendarOpen((open) => !open)}
                  aria-expanded={calendarOpen}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted"
                >
                  <CalendarDays size={15} />
                  {selectedDate ? formatDate(selectedDate) : "Selecionar data"}
                </button>

                {calendarOpen ? (
                  <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] rounded-[20px] border border-border bg-background p-4 shadow-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        aria-label="Mes anterior"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <input
                        type="month"
                        value={visibleMonth}
                        onChange={(event) =>
                          setVisibleMonth(event.target.value)
                        }
                        className="h-9 rounded-full border border-border bg-background px-4 text-sm font-medium"
                        aria-label="Mes e ano do calendario"
                      />
                      <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        aria-label="Proximo mes"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted-foreground">
                      {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map(
                        (day) => (
                          <span key={day} className="py-1">
                            {day}
                          </span>
                        ),
                      )}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {calendarDays.map((date, index) =>
                        date ? (
                          <button
                            key={date}
                            type="button"
                            disabled={!availableDates.has(date)}
                            onClick={() => void loadSnapshot(date)}
                            className={`aspect-square rounded-xl text-sm font-medium transition ${
                              date === selectedDate
                                ? "bg-emerald-400 text-slate-950"
                                : availableDates.has(date)
                                  ? "bg-muted/60 text-foreground hover:bg-emerald-400/20"
                                  : "text-muted-foreground/25"
                            }`}
                          >
                            {Number(date.slice(-2))}
                          </button>
                        ) : (
                          <span key={`empty-${index}`} />
                        ),
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Datas sem snapshot ficam desabilitadas.</span>
                      <StatusBadge tone="blue">{dates.length} dias</StatusBadge>
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={!newerDate}
                onClick={() => newerDate && void loadSnapshot(newerDate)}
                aria-label="Proximo dia"
                title="Proximo dia"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background transition hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-border px-6 py-20 text-center">
          <div className="text-lg font-medium">
            Nenhum snapshot salvo ainda.
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            O historico aparecera aqui na proxima atualizacao automatica.
          </p>
        </section>
      )}

      {canBackfill ? (
        <section className="hidden">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-400/10 p-2.5 text-emerald-300">
              <Database size={18} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Admin interno
              </div>
              <h3 className="mt-1 text-xl font-semibold">Importar historico</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ate 7 dias por execucao. Cada data gera seu proprio registro de
                auditoria.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 tablet:grid-cols-4">
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Pais
              <select
                value={backfillCountry}
                onChange={(event) => setBackfillCountry(event.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="BR">Brasil</option>
                <option value="GLOBAL">Global</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Chart type
              <select
                value="top-songs"
                disabled
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="top-songs">Top Songs diario</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Data inicial
              <input
                type="date"
                value={backfillStartDate}
                onChange={(event) => setBackfillStartDate(event.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Data final
              <input
                type="date"
                value={backfillEndDate}
                onChange={(event) => setBackfillEndDate(event.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={backfilling || !backfillStartDate || !backfillEndDate}
              onClick={() => void handleBackfill()}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {backfilling ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Database size={15} />
              )}
              {backfilling ? "Importando..." : "Importar historico"}
            </button>
            {backfillMessage ? (
              <span className="text-sm text-muted-foreground">
                {backfillMessage}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasHistory && selectedDate ? (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-border bg-card/60">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-4">
              <div
                className="h-10 w-10 rounded-xl border border-border bg-muted"
                style={coverStyle(topTrack?.image_url ?? null)}
              />
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Top 200
                </div>
                <h3 className="text-base font-semibold">
                  {selectedDate ? formatDate(selectedDate) : "Sem data"}
                </h3>
                <p className="text-xs text-muted-foreground">
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
                  Lider{" "}
                  {getMovementLabel(topTrack.status, topTrack.position_change)}
                </StatusBadge>
              ) : null}
            </div>
          </div>

          {loadingDate ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : tracks.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-14" />
                  <col className="w-[76px]" />
                  <col />
                  <col className="w-[126px]" />
                  <col className="hidden w-[136px] laptop:table-column" />
                  <col className="w-16" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border bg-muted/20 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-2 py-3 text-center">#</th>
                    <th className="px-2 py-3 text-center">Mov.</th>
                    <th className="px-3 py-3 text-left">Faixa</th>
                    <th className="px-3 py-3 text-right">Streams</th>
                    <th className="hidden px-3 py-3 text-left laptop:table-cell">
                      Genero
                    </th>
                    <th className="px-2 py-3 text-center">Add</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tracks.map((track) => (
                    <tr key={track.id} className="hover:bg-muted/10">
                      <td className="px-2 py-3 text-center align-top">
                        <div className="text-lg font-semibold text-white">
                          #{track.position}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center align-top">
                        <MovementIcon
                          status={track.status}
                          change={track.position_change}
                        />
                      </td>
                      <td className="min-w-0 px-3 py-3 align-top">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="h-12 w-12 shrink-0 rounded-xl border border-border bg-muted"
                            style={coverStyle(track.image_url ?? null)}
                          />
                          <div className="min-w-0 flex-1">
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
                      <td className="px-3 py-3 text-right align-top font-mono text-xs">
                        <StreamsCell
                          streams={track.streams}
                          growthPct={track.stream_growth_percent}
                        />
                      </td>
                      <td className="hidden px-3 py-3 align-top laptop:table-cell">
                        {track.genre ? (
                          <StatusBadge
                            tone="slate"
                            className="max-w-[120px] truncate normal-case tracking-[0.04em]"
                          >
                            {track.genre}
                          </StatusBadge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center align-top">
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
        <div className="hidden">
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
