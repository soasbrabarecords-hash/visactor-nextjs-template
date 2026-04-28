"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LabelArtist } from "@/lib/label-os";
import {
  parsePercentageInput,
  formatPercentage,
  sumPercentages,
  isPercentageEqual,
} from "@/lib/percentage";

// ─── Constants ───────────────────────────────────────────

const GENRES = [
  "Funk", "Trap", "Hip-Hop", "R&B", "Pop", "Afrobeats", "Pagode",
  "Samba", "Forró", "Sertanejo", "Rock", "Eletrônico", "Soul", "Outro",
];

const KEYS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm",
];

const FONOGRAMA_TARGETS = {
  interpretes: 41.7,
  produtores: 41.7,
  musicos: 16.6,
};

// ─── Helpers ─────────────────────────────────────────────

async function uploadFile(file: File | null, bucket: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("bucket", bucket);
  const res = await fetch("/api/label-os/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const j = (await res.json()) as { error?: string };
    throw new Error(j.error ?? `Erro no upload para ${bucket}`);
  }
  const json = (await res.json()) as { url: string };
  return json.url;
}

const inputCls =
  "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 w-full";

function totalColor(total: number, target: number): string {
  if (total > target + 0.01) return "text-red-500";
  if (isPercentageEqual(total, target)) return "text-green-500";
  return "text-amber-500";
}

function totalBg(total: number, target: number): string {
  if (total > target + 0.01)
    return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (isPercentageEqual(total, target))
    return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
  return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
}

// ─── Types ───────────────────────────────────────────────

// pct é string para permitir vírgula durante digitação
type SplitRow = { artistId: string; pct: string };

type TrackData = {
  title: string;
  version: string;
  genre: string;
  key: string;
  bpm: string;
  explicit: boolean;
  release_date: string;
  notes: string;
  lyrics: string;
  coverFile: File | null;
  audioFile: File | null;
  contractFile: File | null;
};

// ─── StepIndicator ───────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Dados & Arquivos", "Obra", "Fonograma", "Royalties Share"];
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                    : done
                      ? "bg-green-600 text-white"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                {done ? "✓" : idx}
              </div>
              <span className="hidden text-[10px] text-muted-foreground sm:block">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-1 mb-4 h-px w-8 sm:w-14 ${done ? "bg-green-500" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SplitEditor ─────────────────────────────────────────

function SplitEditor({
  rows,
  onChange,
  artists,
  target,
  label,
}: {
  rows: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
  artists: LabelArtist[];
  target: number;
  label: string;
}) {
  const total = sumPercentages(rows.map((r) => r.pct));
  const over = total > target + 0.01;
  const exact = isPercentageEqual(total, target);

  const addRow = () => onChange([...rows, { artistId: "", pct: "0" }]);

  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  const updateRow = (i: number, field: keyof SplitRow, value: string) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className={`text-sm font-semibold ${totalColor(total, target)}`}>
          {formatPercentage(total)} / {formatPercentage(target)}
        </span>
      </div>

      {over && (
        <p className="text-xs text-red-500">
          ⚠️ Soma ultrapassa {formatPercentage(target)}. Ajuste as porcentagens.
        </p>
      )}

      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={row.artistId}
            onChange={(e) => updateRow(i, "artistId", e.target.value)}
            className={inputCls}
          >
            <option value="">Selecione artista...</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.artist_name ?? a.name}
              </option>
            ))}
          </select>
          <div className="relative w-32 shrink-0">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={row.pct}
              onChange={(e) => updateRow(i, "pct", e.target.value)}
              className={inputCls}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="shrink-0 text-xs text-muted-foreground hover:text-red-500"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="w-fit rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-slate-400 hover:text-foreground"
      >
        + Adicionar
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

type Props = { artists: LabelArtist[] };

export default function TrackForm({ artists }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trackData, setTrackData] = useState<TrackData>({
    title: "",
    version: "",
    genre: "",
    key: "",
    bpm: "",
    explicit: false,
    release_date: "",
    notes: "",
    lyrics: "",
    coverFile: null,
    audioFile: null,
    contractFile: null,
  });

  const [obraRows, setObraRows] = useState<SplitRow[]>([{ artistId: "", pct: "0" }]);
  const [interpretes, setInterpretes] = useState<SplitRow[]>([{ artistId: "", pct: "0" }]);
  const [produtores, setProdutores] = useState<SplitRow[]>([{ artistId: "", pct: "0" }]);
  const [musicos, setMusicos] = useState<SplitRow[]>([{ artistId: "", pct: "0" }]);
  const [royaltyRows, setRoyaltyRows] = useState<SplitRow[]>([{ artistId: "", pct: "0" }]);

  // ── Validações ──

  const validateStep1 = (): string | null => {
    if (!trackData.title.trim()) return "Título é obrigatório.";
    return null;
  };

  const validateStep2 = (): string | null => {
    if (obraRows.some((r) => !r.artistId))
      return "Selecione um artista em todos os campos de Obra.";
    const t = sumPercentages(obraRows.map((r) => r.pct));
    if (!isPercentageEqual(t, 100))
      return `Obra: soma deve ser 100% (atual: ${formatPercentage(t)}).`;
    return null;
  };

  const validateStep3 = (): string | null => {
    const groups: [string, SplitRow[], number][] = [
      ["Intérpretes", interpretes, FONOGRAMA_TARGETS.interpretes],
      ["Produtores fonográficos", produtores, FONOGRAMA_TARGETS.produtores],
      ["Músicos", musicos, FONOGRAMA_TARGETS.musicos],
    ];
    for (const [name, rows, target] of groups) {
      if (rows.some((r) => !r.artistId))
        return `Selecione um artista em todos os campos de ${name}.`;
      const t = sumPercentages(rows.map((r) => r.pct));
      if (!isPercentageEqual(t, target))
        return `${name}: soma deve ser ${formatPercentage(target)} (atual: ${formatPercentage(t)}).`;
    }
    return null;
  };

  const validateStep4 = (): string | null => {
    if (royaltyRows.some((r) => !r.artistId))
      return "Selecione um artista em todos os campos de Royalties Share.";
    const t = sumPercentages(royaltyRows.map((r) => r.pct));
    if (!isPercentageEqual(t, 100))
      return `Royalties Share: soma deve ser 100% (atual: ${formatPercentage(t)}).`;
    return null;
  };

  const goNext = () => {
    let err: string | null = null;
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (step === 3) err = validateStep3();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setError(null);
    setStep((s) => s - 1);
  };

  // ── Submit ──

  const handleSubmit = async () => {
    const err = validateStep4();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);

    try {
      const [cover_url, audio_url, contract_url] = await Promise.all([
        uploadFile(trackData.coverFile, "label-covers"),
        uploadFile(trackData.audioFile, "label-audio"),
        uploadFile(trackData.contractFile, "label-contracts"),
      ]);

      const trackRes = await fetch("/api/label-os/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trackData.title,
          version: trackData.version || null,
          genre: trackData.genre || null,
          bpm: trackData.bpm ? parseInt(trackData.bpm, 10) : null,
          key: trackData.key || null,
          explicit: trackData.explicit,
          release_date: trackData.release_date || null,
          notes: trackData.notes || null,
          lyrics: trackData.lyrics || null,
          status: "draft",
          cover_url,
          audio_url,
          contract_url,
          isrc: null,
          upc: null,
        }),
      });

      if (!trackRes.ok) {
        const j = (await trackRes.json()) as { error?: string };
        throw new Error(j.error ?? "Erro ao salvar track.");
      }

      const track = (await trackRes.json()) as { id: string };
      const trackId = track.id;

      const participants = [
        ...obraRows.map((r) => ({
          track_id: trackId, artist_id: r.artistId, role: "composer",
          royalty_percentage: 0,
          publishing_percentage: parsePercentageInput(r.pct),
          master_percentage: 0,
        })),
        ...interpretes.map((r) => ({
          track_id: trackId, artist_id: r.artistId, role: "main_artist",
          royalty_percentage: 0, publishing_percentage: 0,
          master_percentage: parsePercentageInput(r.pct),
        })),
        ...produtores.map((r) => ({
          track_id: trackId, artist_id: r.artistId, role: "producer",
          royalty_percentage: 0, publishing_percentage: 0,
          master_percentage: parsePercentageInput(r.pct),
        })),
        ...musicos.map((r) => ({
          track_id: trackId, artist_id: r.artistId, role: "other",
          royalty_percentage: 0, publishing_percentage: 0,
          master_percentage: parsePercentageInput(r.pct),
        })),
        ...royaltyRows.map((r) => ({
          track_id: trackId, artist_id: r.artistId, role: "label",
          royalty_percentage: parsePercentageInput(r.pct),
          publishing_percentage: 0, master_percentage: 0,
        })),
      ];

      await Promise.all(
        participants.map((p) =>
          fetch(`/api/label-os/tracks/${trackId}/participants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          }),
        ),
      );

      router.push(`/label-os/tracks/${trackId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──

  const btnBase = "rounded-md px-5 py-2 text-sm font-medium disabled:opacity-50";
  const btnPrimary = `${btnBase} bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300`;
  const btnSecondary = `${btnBase} border border-border hover:bg-slate-100 dark:hover:bg-slate-800`;

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator current={step} />

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Título <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Nome da faixa" value={trackData.title}
                onChange={(e) => setTrackData((d) => ({ ...d, title: e.target.value }))}
                className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Versão</label>
              <input type="text" placeholder="Ex: Radio Edit, Remix..." value={trackData.version}
                onChange={(e) => setTrackData((d) => ({ ...d, version: e.target.value }))}
                className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Gênero</label>
              <select value={trackData.genre}
                onChange={(e) => setTrackData((d) => ({ ...d, genre: e.target.value }))}
                className={inputCls}>
                <option value="">Selecione...</option>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Tonalidade</label>
              <select value={trackData.key}
                onChange={(e) => setTrackData((d) => ({ ...d, key: e.target.value }))}
                className={inputCls}>
                <option value="">Selecione...</option>
                {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">BPM</label>
              <input type="number" placeholder="120" value={trackData.bpm}
                onChange={(e) => setTrackData((d) => ({ ...d, bpm: e.target.value }))}
                className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Data de lançamento</label>
              <input type="date" value={trackData.release_date}
                onChange={(e) => setTrackData((d) => ({ ...d, release_date: e.target.value }))}
                className={inputCls} />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input id="explicit" type="checkbox" checked={trackData.explicit}
                onChange={(e) => setTrackData((d) => ({ ...d, explicit: e.target.checked }))}
                className="h-4 w-4 rounded border-border" />
              <label className="text-sm font-medium" htmlFor="explicit">Conteúdo explícito</label>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Observações</label>
            <textarea rows={3} placeholder="Notas internas sobre a faixa..." value={trackData.notes}
              onChange={(e) => setTrackData((d) => ({ ...d, notes: e.target.value }))}
              className={inputCls} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Capa (JPG/PNG)</label>
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setTrackData((d) => ({ ...d, coverFile: e.target.files?.[0] ?? null }))}
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-slate-800" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Áudio (WAV/MP3)</label>
              <input type="file" accept="audio/wav,audio/mpeg,audio/mp3"
                onChange={(e) => setTrackData((d) => ({ ...d, audioFile: e.target.files?.[0] ?? null }))}
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-slate-800" />
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2 — OBRA ── */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className="rounded-md border border-border bg-slate-50 px-4 py-3 text-sm text-muted-foreground dark:bg-slate-900">
            Preencha a letra e distribua <strong>100%</strong> da Obra entre os compositores.
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold">Letra da música</label>
            <textarea rows={10} placeholder="Cole ou escreva a letra completa aqui..."
              value={trackData.lyrics}
              onChange={(e) => setTrackData((d) => ({ ...d, lyrics: e.target.value }))}
              className={inputCls} />
          </div>
          <div className="border-t border-border" />
          <SplitEditor rows={obraRows} onChange={setObraRows} artists={artists}
            target={100} label="Compositores" />
        </div>
      )}

      {/* ── STEP 3 — FONOGRAMA ── */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div className="rounded-md border border-border bg-slate-50 px-4 py-3 text-sm text-muted-foreground dark:bg-slate-900">
            Distribua o Fonograma nos 3 grupos com alvos fixos:
            <strong> Intérpretes 41,70%</strong> · <strong>Produtores 41,70%</strong> · <strong>Músicos 16,60%</strong>.
          </div>

          {/* Totalizador geral do fonograma */}
          <div className={`rounded-md px-4 py-2.5 text-sm font-semibold ${totalBg(
            sumPercentages([
              ...interpretes.map((r) => r.pct),
              ...produtores.map((r) => r.pct),
              ...musicos.map((r) => r.pct),
            ]), 100)}`}>
            Total Fonograma: {formatPercentage(sumPercentages([
              ...interpretes.map((r) => r.pct),
              ...produtores.map((r) => r.pct),
              ...musicos.map((r) => r.pct),
            ]))} / 100%
          </div>

          <SplitEditor rows={interpretes} onChange={setInterpretes} artists={artists}
            target={FONOGRAMA_TARGETS.interpretes} label="Intérpretes — alvo: 41,70%" />
          <div className="border-t border-border" />
          <SplitEditor rows={produtores} onChange={setProdutores} artists={artists}
            target={FONOGRAMA_TARGETS.produtores} label="Produtores fonográficos — alvo: 41,70%" />
          <div className="border-t border-border" />
          <SplitEditor rows={musicos} onChange={setMusicos} artists={artists}
            target={FONOGRAMA_TARGETS.musicos} label="Músicos — alvo: 16,60%" />
        </div>
      )}

      {/* ── STEP 4 — ROYALTIES SHARE ── */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-border bg-slate-50 px-4 py-3 text-sm text-muted-foreground dark:bg-slate-900">
            Distribua <strong>100%</strong> dos Royalties Share entre os envolvidos.
          </div>
          <SplitEditor rows={royaltyRows} onChange={setRoyaltyRows} artists={artists}
            target={100} label="Royalties Share" />
        </div>
      )}

      {/* ── Nav ── */}
      <div className="flex gap-3 border-t border-border pt-4">
        {step > 1 && (
          <button type="button" onClick={goBack} className={btnSecondary}>← Voltar</button>
        )}
        {step < 4 && (
          <button type="button" onClick={goNext} className={btnPrimary}>Próximo →</button>
        )}
        {step === 4 && (
          <button type="button" onClick={handleSubmit} disabled={loading} className={btnPrimary}>
            {loading ? "Salvando..." : "Salvar track"}
          </button>
        )}
        {step === 1 && (
          <button type="button" onClick={() => router.back()} className={btnSecondary}>Cancelar</button>
        )}
      </div>
    </div>
  );
}
