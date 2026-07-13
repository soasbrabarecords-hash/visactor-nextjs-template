"use client";

import {
  BadgeCheck,
  Building2,
  FileText,
  Landmark,
  Orbit,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import EntityCombobox from "@/components/label-os/entity-combobox";
import RoleChipSelector from "@/components/label-os/role-chip-selector";
import type { LabelEntity } from "@/lib/label-entities-types";
import {
  ENTITY_FUNCTION_LABELS,
  ENTITY_FUNCTION_OPTIONS,
  ENTITY_KIND_LABELS,
  ENTITY_KIND_OPTIONS,
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_OPTIONS,
  type EntityFunction,
  type EntityKind,
  type EntityType,
} from "@/lib/label-os-taxonomy";

const INPUT_CLASS =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-primary/20";

const CATEGORY_COLOR: Record<string, string> = {
  artist: "border-purple-300/20 bg-purple-300/12 text-purple-100",
  producer: "border-orange-300/20 bg-orange-300/12 text-orange-100",
  composer: "border-yellow-300/20 bg-yellow-300/12 text-yellow-100",
  label: "border-blue-300/20 bg-blue-300/12 text-blue-100",
  imprint: "border-violet-300/20 bg-violet-300/12 text-violet-100",
  publisher: "border-emerald-300/20 bg-emerald-300/12 text-emerald-100",
  manager: "border-pink-300/20 bg-pink-300/12 text-pink-100",
  company: "border-slate-300/20 bg-slate-300/12 text-slate-100",
  other: "border-white/10 bg-white/[0.06] text-white/72",
};

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  rows?: number;
};

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
  rows = 4,
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
          rows={rows}
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
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/50">
          <Icon className="h-[18px] w-[18px] text-sky-100" />
        </div>
        <div>
          <div className="text-base font-semibold text-white">{title}</div>
          <div className="text-white/54 mt-1 text-sm">{description}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function EntityForm({
  entity,
  initialPublisher = null,
}: {
  entity?: LabelEntity;
  initialPublisher?: LabelEntity | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<EntityKind>(entity?.entity_kind ?? "person");
  const [category, setCategory] = useState<EntityType>(
    entity?.type ?? "artist",
  );
  const [roles, setRoles] = useState<EntityFunction[]>(entity?.roles ?? []);
  const [publisher, setPublisher] = useState<LabelEntity | null>(
    initialPublisher,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (roles.length === 0) {
      setError("Selecione pelo menos uma função exercida no catálogo.");
      return;
    }

    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const body = {
      name: String(formData.get("name") ?? "").trim(),
      display_name: String(formData.get("display_name") ?? "").trim() || null,
      type: category,
      entity_kind: kind,
      roles,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      instagram: String(formData.get("instagram") ?? "").trim() || null,
      spotify_url: String(formData.get("spotify_url") ?? "").trim() || null,
      spotify_artist_id:
        String(formData.get("spotify_artist_id") ?? "").trim() || null,
      apple_music_url:
        String(formData.get("apple_music_url") ?? "").trim() || null,
      youtube_url: String(formData.get("youtube_url") ?? "").trim() || null,
      document: String(formData.get("document") ?? "").trim() || null,
      birth_date: String(formData.get("birth_date") ?? "").trim() || null,
      ipi_cae: String(formData.get("ipi_cae") ?? "").trim() || null,
      rights_society:
        String(formData.get("rights_society") ?? "").trim() || null,
      publisher_name: publisher?.display_name ?? publisher?.name ?? null,
      publisher_entity_id: publisher?.id ?? null,
      payment_data_complete: formData.get("payment_data_complete") === "on",
      pix_key: String(formData.get("pix_key") ?? "").trim() || null,
      bank_details: String(formData.get("bank_details") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    };

    try {
      const response = await fetch(
        entity
          ? `/api/label-os/entities/${entity.id}`
          : "/api/label-os/entities",
        {
          method: entity ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erro ao salvar participante.");
      }
      router.push("/label-os/entities");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Erro desconhecido.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 px-5 py-5 tablet:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${CATEGORY_COLOR[category] ?? CATEGORY_COLOR.other}`}
            >
              {ENTITY_TYPE_LABELS[category]}
            </span>
            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-sky-100">
              {ENTITY_KIND_LABELS[kind]}
            </span>
            {roles.map((role) => (
              <span
                key={role}
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/70"
              >
                {ENTITY_FUNCTION_LABELS[role]}
              </span>
            ))}
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
            {entity
              ? "Atualizar participante."
              : "Uma identidade, várias funções."}
          </h2>
          <p className="text-white/56 mt-2 max-w-2xl text-sm leading-6">
            Pessoas e empresas são cadastradas uma única vez e reutilizadas na
            obra, no fonograma, nos royalties e nos contratos.
          </p>
        </div>

        <div className="space-y-5 p-6">
          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-100"
            >
              {error}
            </div>
          ) : null}

          <Section
            icon={kind === "person" ? UserRound : Building2}
            title="Identidade e funções"
            description="A categoria identifica o cadastro visualmente; as funções controlam onde ele pode ser usado."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label
                  className="text-sm font-medium text-white"
                  htmlFor="entity-kind"
                >
                  Tipo jurídico
                </label>
                <select
                  id="entity-kind"
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as EntityKind)
                  }
                  className={INPUT_CLASS}
                >
                  {ENTITY_KIND_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-slate-950 text-white"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label
                  className="text-sm font-medium text-white"
                  htmlFor="entity-category"
                >
                  Categoria
                </label>
                <select
                  id="entity-category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as EntityType)
                  }
                  className={INPUT_CLASS}
                >
                  {ENTITY_TYPE_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-slate-950 text-white"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <RoleChipSelector
                  label="Funções exercidas no catálogo"
                  hint="Selecione todas as funções. Os campos da track usam esta lista para mostrar apenas participantes compatíveis."
                  options={ENTITY_FUNCTION_OPTIONS}
                  value={roles}
                  onChange={(value) => setRoles(value as EntityFunction[])}
                />
              </div>
            </div>
          </Section>

          <Section
            icon={BadgeCheck}
            title="Dados de cadastro"
            description="Nome legal para documentos e nome artístico ou fantasia para créditos e operação."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={kind === "person" ? "Nome legal" : "Razão social"}
                name="name"
                required
                placeholder="Identidade legal"
                defaultValue={entity?.name}
              />
              <Field
                label={kind === "person" ? "Nome artístico" : "Nome fantasia"}
                name="display_name"
                placeholder="Nome público ou de crédito"
                defaultValue={entity?.display_name ?? ""}
              />
              <Field
                label="CPF / CNPJ"
                name="document"
                placeholder="Documento sem duplicar cadastros"
                defaultValue={entity?.document ?? ""}
              />
              {kind === "person" ? (
                <Field
                  label="Data de nascimento"
                  name="birth_date"
                  type="date"
                  defaultValue={entity?.birth_date ?? ""}
                />
              ) : null}
              <Field
                label="Email"
                name="email"
                type="email"
                placeholder="contato@exemplo.com"
                defaultValue={entity?.email ?? ""}
              />
              <Field
                label="Telefone"
                name="phone"
                placeholder="+55 11 99999-9999"
                defaultValue={entity?.phone ?? ""}
              />
              <Field
                label="Instagram"
                name="instagram"
                placeholder="@perfil"
                defaultValue={entity?.instagram ?? ""}
              />
              <Field
                label="IPI / CAE"
                name="ipi_cae"
                placeholder="Identificador autoral"
                defaultValue={entity?.ipi_cae ?? ""}
              />
              <Field
                label="Associação autoral"
                name="rights_society"
                placeholder="Abramus, UBC..."
                defaultValue={entity?.rights_society ?? ""}
              />
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-white">
                  Editora vinculada
                </label>
                <EntityCombobox
                  value={publisher}
                  onChange={setPublisher}
                  roles={["publisher"]}
                  excludeIds={entity ? [entity.id] : []}
                  placeholder="Buscar entidade com função Editora..."
                />
              </div>
            </div>
          </Section>

          <Section
            icon={Orbit}
            title="Presença pública"
            description="Identificadores e links para conferir rapidamente o perfil certo."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Spotify Artist ID"
                name="spotify_artist_id"
                placeholder="ID do artista no Spotify"
                defaultValue={entity?.spotify_artist_id ?? ""}
              />
              <Field
                label="Spotify URL"
                name="spotify_url"
                placeholder="https://open.spotify.com/artist/..."
                defaultValue={entity?.spotify_url ?? ""}
              />
              <Field
                label="Apple Music URL"
                name="apple_music_url"
                placeholder="https://music.apple.com/..."
                defaultValue={entity?.apple_music_url ?? ""}
              />
              <Field
                label="YouTube URL"
                name="youtube_url"
                placeholder="https://youtube.com/@perfil"
                defaultValue={entity?.youtube_url ?? ""}
              />
            </div>
          </Section>

          <Section
            icon={Landmark}
            title="Pagamento"
            description="Dados internos para repasses. Essas informações não entram automaticamente no PDF do contrato."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Chave Pix"
                name="pix_key"
                placeholder="CPF, CNPJ, email, telefone ou chave"
                defaultValue={entity?.pix_key ?? ""}
              />
              <label className="text-white/72 flex min-h-12 items-center gap-3 self-end rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  name="payment_data_complete"
                  defaultChecked={entity?.payment_data_complete ?? false}
                  className="h-4 w-4 rounded border-white/20 bg-white/5"
                />
                Dados de pagamento conferidos
              </label>
              <div className="sm:col-span-2">
                <Field
                  label="Dados bancários"
                  name="bank_details"
                  type="textarea"
                  rows={3}
                  placeholder="Banco, agência, conta, titular e observações de pagamento"
                  defaultValue={entity?.bank_details ?? ""}
                />
              </div>
            </div>
          </Section>

          <Section
            icon={FileText}
            title="Observações internas"
            description="Contexto contratual e operacional para a equipe."
          >
            <Field
              label="Notas"
              name="notes"
              type="textarea"
              placeholder="Observações, pendências e detalhes importantes..."
              defaultValue={entity?.notes ?? ""}
            />
          </Section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center rounded-full bg-[linear-gradient(180deg,#f6f8fb,#dbe7ff)] px-5 text-sm font-medium text-slate-900 transition hover:bg-[linear-gradient(180deg,#ffffff,#e3ecff)] disabled:opacity-60"
            >
              {loading
                ? "Salvando..."
                : entity
                  ? "Salvar alterações"
                  : "Salvar participante"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="border-white/12 text-white/78 inline-flex h-11 items-center rounded-full border bg-white/5 px-5 text-sm font-medium transition hover:bg-white/10 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
