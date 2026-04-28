"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ENTITY_TYPES } from "@/lib/label-entities";
import type { EntityType } from "@/lib/label-entities";

const INPUT_CLASS =
  "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 w-full";

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

const Field = ({ label, name, type = "text", placeholder, required }: FieldProps) => (
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
        className={INPUT_CLASS}
      />
    ) : (
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className={INPUT_CLASS}
      />
    )}
  </div>
);

export default function EntityForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<EntityType>("artist");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name") as string,
      display_name: (formData.get("display_name") as string) || null,
      type,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      instagram: (formData.get("instagram") as string) || null,
      spotify_url: (formData.get("spotify_url") as string) || null,
      apple_music_url: (formData.get("apple_music_url") as string) || null,
      youtube_url: (formData.get("youtube_url") as string) || null,
      document: (formData.get("document") as string) || null,
      notes: (formData.get("notes") as string) || null,
    };

    try {
      const res = await fetch("/api/label-os/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Erro ao salvar entidade.");
      }

      router.push("/label-os/entities");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  const isArtist = type === "artist";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tipo — primeiro para condicionar outros campos */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground" htmlFor="type">
          Tipo <span className="ml-0.5 text-red-500">*</span>
        </label>
        <select
          id="type"
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value as EntityType)}
          className={INPUT_CLASS}
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Nome completo / Razão social"
          name="name"
          required
          placeholder={isArtist ? "Nome legal" : "Nome da empresa ou pessoa"}
        />
        <Field
          label={isArtist ? "Nome artístico" : "Nome fantasia / Apelido"}
          name="display_name"
          placeholder={isArtist ? "Como aparece nos créditos" : "Nome de exibição"}
        />
        <Field label="Email" name="email" type="email" placeholder="contato@exemplo.com" />
        <Field label="Telefone" name="phone" placeholder="+55 11 99999-9999" />
        <Field label="Documento (CPF/CNPJ)" name="document" placeholder="000.000.000-00" />

        {/* Campos de redes — só fazem sentido para artistas, mas ficam visíveis para todos */}
        <Field label="Instagram" name="instagram" placeholder="@handle" />
        <Field
          label="Spotify URL"
          name="spotify_url"
          placeholder="https://open.spotify.com/artist/..."
        />
        <Field
          label="Apple Music URL"
          name="apple_music_url"
          placeholder="https://music.apple.com/..."
        />
        <Field
          label="YouTube URL"
          name="youtube_url"
          placeholder="https://youtube.com/@handle"
        />
      </div>

      <Field
        label="Observações"
        name="notes"
        type="textarea"
        placeholder="Notas internas..."
      />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {loading ? "Salvando..." : "Salvar entidade"}
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
