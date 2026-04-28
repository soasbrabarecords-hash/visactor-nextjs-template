"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

function Field({ label, name, type = "text", placeholder, required }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground" htmlFor={name}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          placeholder={placeholder}
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
        />
      )}
    </div>
  );
}

const GENRES = [
  "Funk", "Trap", "Hip-Hop", "R&B", "Pop", "Afrobeats", "Pagode",
  "Samba", "Forró", "Sertanejo", "Rock", "Eletrônico", "Soul", "Outro",
];

const KEYS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm",
];

async function uploadFile(
  file: File | null,
  bucket: string,
): Promise<string | null> {
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

export default function TrackForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      // Upload de arquivos para a API que salva no Supabase Storage
      const coverFile = formData.get("cover") as File | null;
      const audioFile = formData.get("audio") as File | null;
      const contractFile = formData.get("contract") as File | null;

      const [cover_url, audio_url, contract_url] = await Promise.all([
        uploadFile(coverFile, "label-covers"),
        uploadFile(audioFile, "label-audio"),
        uploadFile(contractFile, "label-contracts"),
      ]);

      const bpmRaw = formData.get("bpm") as string;
      const body = {
        title: formData.get("title") as string,
        version: formData.get("version") as string || null,
        genre: formData.get("genre") as string || null,
        bpm: bpmRaw ? parseInt(bpmRaw, 10) : null,
        key: formData.get("key") as string || null,
        explicit: formData.get("explicit") === "on",
        release_date: formData.get("release_date") as string || null,
        notes: formData.get("notes") as string || null,
        status: "draft",
        cover_url,
        audio_url,
        contract_url,
        isrc: null,
        upc: null,
      };

      const res = await fetch("/api/label-os/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Erro ao salvar track.");
      }

      router.push("/label-os/tracks");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Título" name="title" required placeholder="Nome da faixa" />
        <Field label="Versão" name="version" placeholder="Ex: Radio Edit, Remix..." />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="genre">Gênero</label>
          <select
            id="genre"
            name="genre"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
          >
            <option value="">Selecione...</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="key">Tonalidade</label>
          <select
            id="key"
            name="key"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
          >
            <option value="">Selecione...</option>
            {KEYS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        <Field label="BPM" name="bpm" type="number" placeholder="120" />
        <Field label="Data de lançamento" name="release_date" type="date" />

        <div className="flex items-center gap-2 pt-5">
          <input
            id="explicit"
            name="explicit"
            type="checkbox"
            className="h-4 w-4 rounded border-border"
          />
          <label className="text-sm font-medium" htmlFor="explicit">
            Conteúdo explícito
          </label>
        </div>
      </div>

      <Field label="Observações" name="notes" type="textarea" placeholder="Notas internas sobre a faixa..." />

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Capa (JPG/PNG)</label>
          <input
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-slate-800"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Áudio (WAV/MP3)</label>
          <input
            name="audio"
            type="file"
            accept="audio/wav,audio/mpeg,audio/mp3"
            className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-slate-800"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Contrato (PDF)</label>
          <input
            name="contract"
            type="file"
            accept="application/pdf"
            className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-slate-800"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {loading ? "Salvando..." : "Salvar track"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-5 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
