"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function TrackEditForm({ track }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError("Titulo da musica e obrigatorio.");
      return;
    }

    setLoading(true);

    try {
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
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erro ao atualizar track.");
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

      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.72),rgba(11,16,27,0.88))] p-6 shadow-[0_24px_120px_rgba(0,0,0,0.26)] backdrop-blur-xl">
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
      </section>

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
