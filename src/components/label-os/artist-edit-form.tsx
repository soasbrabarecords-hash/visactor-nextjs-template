"use client";

import type { ComponentType, ReactNode } from "react";
import { Disc3, Mic2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import RoleChipSelector from "@/components/label-os/role-chip-selector";
import type { LabelArtist } from "@/lib/label-os-types";
import {
  ARTIST_ROLE_LABELS,
  ARTIST_ROLE_OPTIONS,
  type ArtistRole,
} from "@/lib/label-os-taxonomy";

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

function maskDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toBrDate(isoDate: string | null): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

const INPUT_CLASS =
  "w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-sky-200/24 focus:bg-white/[0.055]";

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
};

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-white" htmlFor={name}>
        {label}
        {required ? <span className="ml-1 text-emerald-300">*</span> : null}
      </label>
      {type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          placeholder={placeholder}
          defaultValue={defaultValue ?? ""}
          rows={4}
          className={INPUT_CLASS}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          defaultValue={defaultValue ?? ""}
          className={INPUT_CLASS}
        />
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.62),rgba(11,16,27,0.82))] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <Icon className="h-[18px] w-[18px] text-sky-100" />
        </div>
        <div>
          <div className="text-base font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-white/54">{description}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ArtistEditForm({ artist }: { artist: LabelArtist }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState(toBrDate(artist.birth_date));
  const [roles, setRoles] = useState<ArtistRole[]>(
    artist.roles?.length ? artist.roles : ["artist"],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (roles.length === 0) {
      setError("Selecione pelo menos uma funcao para o artista.");
      setLoading(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name") as string,
      artist_name: (formData.get("artist_name") as string) || null,
      roles,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      instagram: (formData.get("instagram") as string) || null,
      spotify_url: (formData.get("spotify_url") as string) || null,
      apple_music_url: (formData.get("apple_music_url") as string) || null,
      youtube_url: (formData.get("youtube_url") as string) || null,
      document: (formData.get("document") as string) || null,
      birth_date: parseBrDate(birthDate),
      notes: (formData.get("notes") as string) || null,
    };

    try {
      const res = await fetch(`/api/label-os/artists/${artist.id}`, {
        method: "PATCH",
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.72),rgba(11,16,27,0.88))] shadow-[0_24px_120px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.14),transparent_44%),radial-gradient(circle_at_top_right,rgba(196,181,253,0.12),transparent_42%)] px-6 py-6">
          <div className="flex flex-wrap items-center gap-2">
            {roles.map((role) => (
              <span
                key={role}
                className="rounded-full border border-sky-200/16 bg-sky-200/[0.08] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-sky-100"
              >
                {ARTIST_ROLE_LABELS[role]}
              </span>
            ))}
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
            Ajustar perfil e funcoes do artista.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/56">
            Organize os creditos base desse nome e deixe claro como ele entra no catalogo.
          </p>
        </div>

        <div className="space-y-5 p-6">
          {error ? (
            <div className="rounded-2xl border border-rose-300/18 bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <Section
            icon={UserRound}
            title="Identidade artistica"
            description="Mantenha o cadastro alinhado ao roster e atualize as funcoes sempre que o papel mudar."
          >
            <div className="space-y-5">
              <RoleChipSelector
                label="Funcoes do artista"
                hint="Selecione todas as funcoes que esse nome pode exercer nas faixas e contratos."
                options={ARTIST_ROLE_OPTIONS}
                value={roles}
                onChange={(nextValue) => setRoles(nextValue as ArtistRole[])}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Nome completo" name="name" required placeholder="Nome legal" defaultValue={artist.name} />
                <Field
                  label="Nome artistico"
                  name="artist_name"
                  placeholder="Como aparece nos creditos"
                  defaultValue={artist.artist_name ?? ""}
                />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white" htmlFor="birth_date">
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
                    className={INPUT_CLASS}
                  />
                </div>
                <Field
                  label="Documento"
                  name="document"
                  placeholder="CPF ou CNPJ se aplicavel"
                  defaultValue={artist.document ?? ""}
                />
              </div>
            </div>
          </Section>

          <Section
            icon={Mic2}
            title="Contato e presenca"
            description="Perfis e atalhos publicos para a equipe operar sem friccao."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Email" name="email" type="email" placeholder="contato@artista.com" defaultValue={artist.email ?? ""} />
              <Field label="Telefone" name="phone" placeholder="+55 11 99999-9999" defaultValue={artist.phone ?? ""} />
              <Field label="Instagram" name="instagram" placeholder="@artista" defaultValue={artist.instagram ?? ""} />
              <Field
                label="Spotify URL"
                name="spotify_url"
                placeholder="https://open.spotify.com/artist/..."
                defaultValue={artist.spotify_url ?? ""}
              />
              <Field
                label="Apple Music URL"
                name="apple_music_url"
                placeholder="https://music.apple.com/..."
                defaultValue={artist.apple_music_url ?? ""}
              />
              <Field
                label="YouTube URL"
                name="youtube_url"
                placeholder="https://youtube.com/@artista"
                defaultValue={artist.youtube_url ?? ""}
              />
            </div>
          </Section>

          <Section
            icon={Disc3}
            title="Observacoes internas"
            description="Contexto de repertorio, relacionamento, pendencias ou qualquer leitura que ajude a equipe."
          >
            <Field
              label="Notas"
              name="notes"
              type="textarea"
              placeholder="Brief interno, observacoes contratuais, contexto de lancamento..."
              defaultValue={artist.notes ?? ""}
            />
          </Section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center rounded-full bg-[linear-gradient(180deg,#f6f8fb,#dbe7ff)] px-5 text-sm font-medium text-slate-900 transition hover:bg-[linear-gradient(180deg,#ffffff,#e3ecff)] disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar alteracoes"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-11 items-center rounded-full border border-white/12 bg-white/5 px-5 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
