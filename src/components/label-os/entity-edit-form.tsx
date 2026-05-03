"use client";

import type { ComponentType, ReactNode } from "react";
import { BadgeCheck, Building2, FileText, Orbit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import RoleChipSelector from "@/components/label-os/role-chip-selector";
import { ENTITY_TYPES } from "@/lib/label-entities-types";
import type { LabelEntity } from "@/lib/label-entities-types";
import {
  ENTITY_FUNCTION_OPTIONS,
  ENTITY_TYPE_LABELS,
  type EntityCategory,
  type EntityFunction,
} from "@/lib/label-os-taxonomy";

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

export default function EntityEditForm({ entity }: { entity: LabelEntity }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<EntityCategory>(
    (ENTITY_TYPES.some((option) => option.value === entity.type)
      ? entity.type
      : "label") as EntityCategory,
  );
  const [roles, setRoles] = useState<EntityFunction[]>(entity.roles ?? []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name") as string,
      display_name: (formData.get("display_name") as string) || null,
      type,
      roles,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      instagram: (formData.get("instagram") as string) || null,
      spotify_url: (formData.get("spotify_url") as string) || null,
      apple_music_url: (formData.get("apple_music_url") as string) || null,
      youtube_url: (formData.get("youtube_url") as string) || null,
      document: (formData.get("document") as string) || null,
      birth_date: null,
      notes: (formData.get("notes") as string) || null,
    };

    try {
      const res = await fetch(`/api/label-os/entities/${entity.id}`, {
        method: "PATCH",
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.72),rgba(11,16,27,0.88))] shadow-[0_24px_120px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.14),transparent_44%),radial-gradient(circle_at_top_right,rgba(196,181,253,0.12),transparent_42%)] px-6 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sky-400/18 bg-sky-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-sky-100">
              {ENTITY_TYPE_LABELS[type]}
            </span>
            {roles.map((role) => (
              <span
                key={role}
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/70"
              >
                {role.replaceAll("_", " ")}
              </span>
            ))}
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
            Ajustar categoria e funcoes da entidade.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/56">
            Mantenha o cadastro juridico alinhado com o papel real da empresa dentro da distribuicao e dos creditos.
          </p>
        </div>

        <div className="space-y-5 p-6">
          {error ? (
            <div className="rounded-2xl border border-rose-300/18 bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <Section
            icon={Building2}
            title="Categoria da entidade"
            description="A categoria principal organiza a leitura do cadastro. As funcoes extras cobrem casos como produtor fonografico."
          >
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white" htmlFor="type">
                  Categoria principal
                </label>
                <select
                  id="type"
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as EntityCategory)}
                  className={INPUT_CLASS}
                >
                  {ENTITY_TYPES.map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <RoleChipSelector
                label="Funcoes adicionais"
                hint="Selecione papeis complementares sem perder a categoria principal."
                options={ENTITY_FUNCTION_OPTIONS}
                value={roles}
                onChange={(nextValue) => setRoles(nextValue as EntityFunction[])}
              />
            </div>
          </Section>

          <Section
            icon={BadgeCheck}
            title="Dados de cadastro"
            description="Dados essenciais para contratos, repasses, contato e organizacao do ecossistema."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Razao social / nome legal"
                name="name"
                required
                placeholder="Nome da empresa ou representante"
                defaultValue={entity.name}
              />
              <Field
                label="Nome fantasia"
                name="display_name"
                placeholder="Como aparece no sistema e nos creditos"
                defaultValue={entity.display_name ?? ""}
              />
              <Field label="Email" name="email" type="email" placeholder="contato@empresa.com" defaultValue={entity.email ?? ""} />
              <Field label="Telefone" name="phone" placeholder="+55 11 99999-9999" defaultValue={entity.phone ?? ""} />
              <Field label="Documento" name="document" placeholder="CNPJ ou CPF" defaultValue={entity.document ?? ""} />
              <Field label="Instagram" name="instagram" placeholder="@perfil" defaultValue={entity.instagram ?? ""} />
            </div>
          </Section>

          <Section
            icon={Orbit}
            title="Links e presenca publica"
            description="Atalhos para verificar rapidamente perfis, pages ou catálogos públicos."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Spotify URL"
                name="spotify_url"
                placeholder="https://open.spotify.com/..."
                defaultValue={entity.spotify_url ?? ""}
              />
              <Field
                label="Apple Music URL"
                name="apple_music_url"
                placeholder="https://music.apple.com/..."
                defaultValue={entity.apple_music_url ?? ""}
              />
              <Field
                label="YouTube URL"
                name="youtube_url"
                placeholder="https://youtube.com/@perfil"
                defaultValue={entity.youtube_url ?? ""}
              />
            </div>
          </Section>

          <Section
            icon={FileText}
            title="Observacoes internas"
            description="Contexto contratual, repasses, relacionamento e qualquer detalhe operacional relevante."
          >
            <Field
              label="Notas"
              name="notes"
              type="textarea"
              placeholder="Observacoes de contrato, distribuicao, repasse, relacionamento..."
              defaultValue={entity.notes ?? ""}
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
