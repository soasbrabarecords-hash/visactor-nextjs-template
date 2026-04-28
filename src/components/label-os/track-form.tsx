"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LabelArtist } from "@/lib/label-os";

// ─── Helpers ─────────────────────────────────────────────

const GENRES = [
  "Funk", "Trap", "Hip-Hop", "R&B", "Pop", "Afrobeats", "Pagode",
  "Samba", "Forró", "Sertanejo", "Rock", "Eletrônico", "Soul", "Outro",
];

const KEYS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm",
];

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

function inputCls() {
  return "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 w-full";
}

function totalOf(rows: SplitRow[]): number {
  return Math.round(rows.reduce((a, r) => a + (Number(r.pct) || 0), 0) * 100) / 100;
}

// ─── Types ───────────────────────────────────────────────

type SplitRow = { artistId: string; pct: number };

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

// ─── Sub-components ──────────────────────────────────────

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
              <div
                className={`mx-1 mb-4 h-px w-8 sm:w-14 ${done ? "bg-green-500" : "bg-border"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  target?: number;
  label?: string;
}) {
  const total = totalOf(rows);
  const over = target !== undefined ? total > target + 0.01 : total > 100.01;
  const exact = target !== undefined ? Math.abs(total - target) < 0.01 : Math.abs(total - 100) < 0.01;

  function add() {
    onChange([...rows, { artistId: "", pct: 0 }]);
  }

  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  function update(i: number, field: keyof SplitRow, value: string | number) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{label}</span>
          <span
            className={`text-sm font-semibold ${over ? "text-red-500" : exact ? "text-green-500" : "text-muted-foreground"}`}
          >
            {total}% {target !== undefined ? `/ ${target}%` : "/ 100%"}
          </span>
        </div>
      )}

      {over && (
        <p className="text-xs text-red-500">
          ⚠️ Soma ultrapassa {target ?? 100}%. Ajuste as porcentagens.
        </p>
      )}

      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={row.artistId}
            onChange={(e) => update(i, "artistId", e.target.value)}
            className={inputCls()}
          >
            <option value="">Selecione artista...</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.artist_name ?? a.name}
              </option>
            ))}
          </select>
          <div className="relative w-28 shrink-0">
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={row.pct}
              onChange={(e) => update(i, "pct", Number(e.target.value))}
              className={inputCls()}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="shrink-0 text-xs text-muted-foreground hover:text-red-500"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
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

  // Step 1 — track data
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

  // Step 2 — OBRA: compositores
  const [obraRows, setObraRows] = useState<SplitRow[]>([{ artistId: "", pct: 0 }]);

  // Step 3 — FONOGRAMA: 3 grupos com targets fixos
  const [interpretes, setInterpretes] = useState<SplitRow[]>([{ artistId: "", pct: 0 }]);
  const [produtores, setProdutores] = useState<SplitRow[]>([{ artistId: "", pct: 0 }]);
  const [musicos, setMusicos] = useState<SplitRow[]>([{ artistId: "", pct: 0 }]);

  // Step 4 — ROYALTIES SHARE
  const [royaltyRows, setRoyaltyRows] = useState<SplitRow[]>([{ artistId: "", pct: 0 }]);

  // ── Validações por step ──

  function validateStep1(): string | null {
    if (!trackData.title.trim()) return "Título é obrigatório.";
    return null;
  }

  function validateStep2(): string | null {
    if (obraRows.some((r) => !r.artistId)) return "Selecione um artista em todos os campos de Obra.";
    const t = totalOf(obraRows);
    if (Math.abs(t - 100) > 0.01) return `Obra: soma deve ser exatamente 100% (atual: ${t}%).`;
    return null;
  }

  function validateStep3(): string | null {
    const groups: [string, SplitRow[], number][] = [
      ["Intérpretes", interpretes, 41.7],
      ["Produtores fonográficos", produtores, 41.7],
      ["Músicos", musicos, 16.6],
    ];
    for (const [name, rows, target] of groups) {
      if (rows.some((r) => !r.artistId)) return `Selecione um artista em todos os campos de ${name}.`;
      const t = totalOf(rows);
      if (Math.abs(t - target) > 0.11)
        return `${name}: soma deve ser ${target}% (atual: ${t}%).`;
    }
    return null;
  }

  function validateStep4(): string | null {
    if (royaltyRows.some((r) => !r.artistId)) return "Selecione um artista em todos os campos de Royalties Share.";
    const t = totalOf(royaltyRows);
    if (Math.abs(t - 100) > 0.01) return `Royalties Share: soma deve ser exatamente 100% (atual: ${t}%).`;
    return null;
  }

  function goNext() {
    let err: string | null = null;
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (step === 3) err = validateStep3();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => s + 1);
  }

  function goBack() {
    setError(null);
    setStep((s) => s - 1);
  }

  // ── Submit final ──

  async function handleSubmit() {
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

      // Salvar participantes: obra (role=composer), fonograma, royalties
      const participants = [
        ...obraRows.map((r) => ({
          track_id: trackId, artist_id: r.artistId, role: "composer",
          royalty_percentage: 0, publishing_percentage: r.pct, master_percentage: 0,
        })),
        ...interpretes.map((r) => ({
          track_id: trackId, artist_id: r.artistId, role: "main_artist",
          royalty_percentage: 0, publishing_percentage: 0, master_percentage: r.pct,
        })),
        ...produtores.map((r) => ({
          track_id: trackId, artist_id: r.artistId, role: "producer",
          royalty_percentage: 0, publishing_percentage: 0, master_percentage: r.pct,
        })),
        ...musicos.map((r) => ({
          track_id: trackId, artist_id: r.artistId, role: "other",
          royalty_percentage: 0, publishing_percentage: 0, master_percentage: r.pct,
        })),
        ...royaltyRows.map((r) => ({
          track_id: trackId, artist_id: r.artistId, role: "label",
          royalty_percentage: r.pct, publishing_percentage: 0, master_percentage: 0,
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
  }

  // ── Render ──

  const btnBase =
    "rounded-md px-5 py-2 text-sm font-medium disabled:opacity-50";
  const btnPrimary =
    `${btnBase} bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300`;
  const btnSecondary =
    `${btnBase} border border-border hover:bg-slate-100 dark:hover:bg-slate-800`;

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
              <input
                type="text"
                placeholder="Nome da faixa"
                value={trackData.title}
                onChange={(e) => setTrackData((d) => ({ ...d, title: e.target.value }))}
                className={inputCls()}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Versão</label>
              <input
                type="text"
                placeholder="Ex: Radio Edit, Remix..."
                value={trackData.version}
                onChange={(e) => setTrackData((d) => ({ ...d, version: e.target.value }))}
                className={inputCls()}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Gênero</label>
              <select
                value={trackData.genre}
                onChange={(e) => setTrackData((d) => ({ ...d, genre: e.target.value }))}
                className={inputCls()}
              >
                <option value="">Selecione...</option>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Tonalidade</label>
              <select
                value={trackData.key}
                onChange={(e) => setTrackData((d) => ({ ...d, key: e.target.value }))}
                className={inputCls()}
              >
                <option value="">Selecione...</option>
                {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">BPM</label>
              <input
                type="number"
                placeholder="120"
                value={trackData.bpm}
                onChange={(e) => setTrackData((d) => ({ ...d, bpm: e.target.value }))}
                className={inputCls()}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Data de lançamento</label>
              <input
                type="date"
                value={trackData.release_date}
                onChange={(e) => setTrackData((d) => ({ ...d, release_date: e.target.value }))}
                className={inputCls()}
              />
            </div>

            <div className="flex items-center gap-2 pt-4">
              <input
                id="explicit"
                type="checkbox"
                checked={trackData.explicit}
                onChange={(e) => setTrackData((d) => ({ ...d, explicit: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <label className="text-sm font-medium" htmlFor="explicit">Conteúdo explícito</label>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Observações</label>
            <textarea
              rows={3}
              placeholder="Notas internas sobre a faixa..."
              value={trackData.notes}
              onChange={(e) => setTrackData((d) => ({ ...d, notes: e.target.value }))}
              className={inputCls()}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Capa (JPG/PNG)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setTrackData((d) => ({ ...d, coverFile: e.target.files?.[0] ?? null }))}
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-slate-800"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Áudio (WAV/MP3)</label>
              <input
                type="file"
                accept="audio/wav,audio/mpeg,audio/mp3"
                onChange={(e) => setTrackData((d) => ({ ...d, audioFile: e.target.files?.[0] ?? null }))}
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-slate-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2 — OBRA ── */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className="rounded-md border border-border bg-slate-50 px-4 py-3 text-sm text-muted-foreground dark:bg-slate-900">
            Distribua 100% da <strong>Obra</strong> entre os compositores da faixa e preencha a letra.
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold">Letra da música</label>
            <textarea
              rows={10}
              placeholder="Cole ou escreva a letra completa aqui..."
              value={trackData.lyrics}
              onChange={(e) => setTrackData((d) => ({ ...d, lyrics: e.target.value }))}
              className={inputCls()}
            />
          </div>

          <div className="border-t border-border" />

          <SplitEditor
            rows={obraRows}
            onChange={setObraRows}
            artists={artists}
            target={100}
            label="Compositores"
          />
        </div>
      )}

      {/* ── STEP 3 — FONOGRAMA ── */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div className="rounded-md border border-border bg-slate-50 px-4 py-3 text-sm text-muted-foreground dark:bg-slate-900">
            O Fonograma é dividido em 3 grupos com percentuais fixos:
            <strong> Intérpretes 41,7%</strong> · <strong>Produtores fonográficos 41,7%</strong> · <strong>Músicos 16,6%</strong>.
            Distribua cada grupo internamente até atingir o alvo.
          </div>

          <SplitEditor
            rows={interpretes}
            onChange={setInterpretes}
            artists={artists}
            target={41.7}
            label="Intérpretes — alvo: 41,7%"
          />
          <div className="border-t border-border" />
          <SplitEditor
            rows={produtores}
            onChange={setProdutores}
            artists={artists}
            target={41.7}
            label="Produtores fonográficos — alvo: 41,7%"
          />
          <div className="border-t border-border" />
          <SplitEditor
            rows={musicos}
            onChange={setMusicos}
            artists={artists}
            target={16.6}
            label="Músicos — alvo: 16,6%"
          />
        </div>
      )}

      {/* ── STEP 4 — ROYALTIES SHARE ── */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-border bg-slate-50 px-4 py-3 text-sm text-muted-foreground dark:bg-slate-900">
            Distribua 100% dos <strong>Royalties Share</strong> entre os envolvidos (gravadora, manager, artistas, etc.).
          </div>
          <SplitEditor
            rows={royaltyRows}
            onChange={setRoyaltyRows}
            artists={artists}
            target={100}
            label="Royalties Share"
          />
        </div>
      )}

      {/* ── Nav buttons ── */}
      <div className="flex gap-3 border-t border-border pt-4">
        {step > 1 && (
          <button type="button" onClick={goBack} className={btnSecondary}>
            ← Voltar
          </button>
        )}
        {step < 4 && (
          <button type="button" onClick={goNext} className={btnPrimary}>
            Próximo →
          </button>
        )}
        {step === 4 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={btnPrimary}
          >
            {loading ? "Salvando..." : "Salvar track"}
          </button>
        )}
        {step === 1 && (
          <button type="button" onClick={() => router.back()} className={btnSecondary}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
