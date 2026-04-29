"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Converte DD/MM/AAAA → YYYY-MM-DD para salvar no banco
function parseBrDate(value: string): string | null {
  const clean = value.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  const day = clean.slice(0, 2);
  const month = clean.slice(2, 4);
  const year = clean.slice(4, 8);
  const d = new Date(`${year}-${month}-${day}`);
  if (isNaN(d.getTime())) return null;
  return `${year}-${month}-${day}`;
}

// Aplica máscara DD/MM/AAAA enquanto digita
function maskDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: FieldProps) {
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

export default function ArtistForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name") as string,
      artist_name: formData.get("artist_name") as string || null,
      email: formData.get("email") as string || null,
      phone: formData.get("phone") as string || null,
      instagram: formData.get("instagram") as string || null,
      spotify_url: formData.get("spotify_url") as string || null,
      apple_music_url: formData.get("apple_music_url") as string || null,
      youtube_url: formData.get("youtube_url") as string || null,
      document: formData.get("document") as string || null,
      birth_date: parseBrDate(birthDate),
      notes: formData.get("notes") as string || null,
    };

    try {
      const res = await fetch("/api/label-os/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Erro ao salvar artista.");
      }

      router.push("/label-os/artists");
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
        <Field label="Nome completo" name="name" required placeholder="Nome legal" />
        <Field label="Nome artístico" name="artist_name" placeholder="Como aparece nos créditos" />
        <Field label="Email" name="email" type="email" placeholder="contato@artista.com" />
        <Field label="Telefone" name="phone" placeholder="+55 11 99999-9999" />
        <Field label="Instagram" name="instagram" placeholder="@artista" />
        <Field label="Spotify URL" name="spotify_url" placeholder="https://open.spotify.com/artist/..." />
        <Field label="Apple Music URL" name="apple_music_url" placeholder="https://music.apple.com/..." />
        <Field label="YouTube URL" name="youtube_url" placeholder="https://youtube.com/@artista" />
        <Field label="Documento (CPF/CNPJ)" name="document" placeholder="000.000.000-00" />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground" htmlFor="birth_date">
            Data de nascimento
          </label>
          <input
            id="birth_date"
            name="birth_date"
            type="text"
            inputMode="numeric"
            placeholder="DD/MM/AAAA"
            value={birthDate}
            onChange={(e) => setBirthDate(maskDate(e.target.value))}
            maxLength={10}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
          />
        </div>
      </div>

      <Field label="Observações" name="notes" type="textarea" placeholder="Notas internas sobre o artista..." />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {loading ? "Salvando..." : "Salvar artista"}
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
