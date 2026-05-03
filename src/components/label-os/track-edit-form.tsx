"use client";

import { FileAudio2, FileImage } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { LabelTrack } from "@/lib/label-os-types";

const INPUT_CLASS =
  "w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-sky-200/24 focus:bg-white/[0.055]";

type Props = {
  track: LabelTrack;
};

const GENRE_OPTIONS = [
  "Pop",
  "Funk",
  "Hip-Hop/Rap",
  "R&B / Soul",
  "Eletronico",
  "Sertanejo",
  "Pagode / Samba",
  "Forro",
  "Afro / Latin",
  "Rock / Alternativo",
];

async function uploadFile(file: File | null, bucket: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("bucket", bucket);
  const res = await fetch("/api/label-os/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Erro no upload para ${bucket}`);
  }
  const json = (await res.json()) as { url: string };
  return json.url;
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export default function TrackEditForm({ track }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: track.title ?? "",
    version: track.version ?? "",
    genre: track.genre ?? "",
    subgenre: track.subgenre ?? "",
    release_date: track.release_date ?? "",
    explicit: Boolean(track.explicit),
    lyrics: track.lyrics ?? "",
    status: track.status ?? "draft",
  });

  const coverPreviewUrl = useMemo(
    () => (coverFile ? URL.createObjectURL(coverFile) : track.cover_url),
    [coverFile, track.cover_url],
  );

  const audioPreviewUrl = useMemo(
    () => (audioFile ? URL.createObjectURL(audioFile) : track.audio_url),
    [audioFile, track.audio_url],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!form.title.trim()) {
      setError("Titulo da musica e obrigatorio.");
      return;
    }

    setLoading(true);

    try {
      let coverUrl = track.cover_url;
      let audioUrl = track.audio_url;
      const warnings: string[] = [];

      if (coverFile) {
        try {
          coverUrl = await uploadFile(coverFile, "label-covers");
        } catch (err) {
          warnings.push(
            err instanceof Error ? `Capa nao atualizada: ${err.message}` : "Capa nao atualizada.",
          );
        }
      }

      if (audioFile) {
        try {
          audioUrl = await uploadFile(audioFile, "label-audio");
        } catch (err) {
          warnings.push(
            err instanceof Error ? `Audio nao atualizado: ${err.message}` : "Audio nao atualizado.",
          );
        }
      }

      const response = await fetch(`/api/label-os/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          version: form.version || null,
          genre: form.genre || null,
          subgenre: form.subgenre || null,
          release_date: form.release_date || null,
          explicit: form.explicit,
          lyrics: form.lyrics || null,
          status: form.status || "draft",
          cover_url: coverUrl,
          audio_url: audioUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Erro ao atualizar track."));
      }

      if (warnings.length > 0) {
        setNotice(`Track salva, mas alguns arquivos nao subiram. ${warnings.join(" ")}`);
        setCoverFile(null);
        setAudioFile(null);
        router.refresh();
        return;
      }

      router.push(`/label-os/tracks/${track.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-300/18 bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-amber-300/18 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
              <FileImage className="h-4 w-4 text-sky-100" />
              Capa da track
            </div>
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.025]">
              {coverPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreviewUrl}
                  alt={track.title}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center text-white/36">
                  Preview da capa
                </div>
              )}
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm text-white/72">Trocar capa</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-white/58 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2.5 file:font-medium file:text-white"
              />
            </label>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
              <FileAudio2 className="h-4 w-4 text-sky-100" />
              WAV / audio
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
              {audioPreviewUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio controls src={audioPreviewUrl} className="w-full" />
              ) : (
                <div className="text-sm text-white/42">Nenhum audio vinculado.</div>
              )}
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm text-white/72">Trocar audio</span>
              <input
                type="file"
                accept="audio/wav,audio/mpeg,audio/mp3"
                onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-white/58 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2.5 file:font-medium file:text-white"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white">
              Titulo da musica
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className={INPUT_CLASS}
              placeholder="Nome da faixa"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white">Versao</label>
            <input
              type="text"
              value={form.version}
              onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
              className={INPUT_CLASS}
              placeholder="Ex: Ao Vivo, Remix, Radio Edit"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white">Status</label>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              className={INPUT_CLASS}
            >
              <option value="draft">Draft</option>
              <option value="ready">Pronta</option>
              <option value="released">Lancada</option>
              <option value="archived">Arquivada</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white">Genero</label>
            <select
              value={form.genre}
              onChange={(event) => setForm((current) => ({ ...current, genre: event.target.value }))}
              className={INPUT_CLASS}
            >
              <option value="">Selecione</option>
              {GENRE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white">Subgenero</label>
            <input
              type="text"
              value={form.subgenre}
              onChange={(event) => setForm((current) => ({ ...current, subgenre: event.target.value }))}
              className={INPUT_CLASS}
              placeholder="Ex: Trap, Funk BR, Pagode"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white">Data de lancamento</label>
            <input
              type="date"
              value={form.release_date}
              onChange={(event) =>
                setForm((current) => ({ ...current, release_date: event.target.value }))
              }
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white">
              <input
                type="checkbox"
                checked={form.explicit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, explicit: event.target.checked }))
                }
                className="h-4 w-4 rounded border-white/20 bg-transparent"
              />
              Conteudo explicito
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white">Letra</label>
            <textarea
              value={form.lyrics}
              onChange={(event) => setForm((current) => ({ ...current, lyrics: event.target.value }))}
              className={`${INPUT_CLASS} min-h-[180px] resize-y`}
              placeholder="Cole a letra da musica aqui"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/label-os/tracks/${track.id}`)}
          className="inline-flex h-11 items-center rounded-full border border-white/12 bg-white/5 px-5 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 items-center rounded-full bg-[linear-gradient(180deg,#f6f8fb,#dbe7ff)] px-5 text-sm font-medium text-slate-900 transition hover:bg-[linear-gradient(180deg,#ffffff,#e3ecff)] disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar alteracoes"}
        </button>
      </div>
    </form>
  );
}
