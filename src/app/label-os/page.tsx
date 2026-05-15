import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Disc3,
  FileBadge2,
  FileWarning,
  Library,
  Music2,
  Plus,
  Sparkles,
  Users2,
} from "lucide-react";
import Container from "@/components/container";
import { getLabelEntities } from "@/lib/label-entities";
import { getLabelArtists, getLabelOsStats, getLabelTracks } from "@/lib/label-os";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Pronta",
  released: "Lançada",
  archived: "Arquivada",
};

const STATUS_TONE: Record<string, string> = {
  draft:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200",
  ready:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/18 dark:bg-sky-300/[0.09] dark:text-sky-100",
  released:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-300/18 dark:bg-indigo-300/[0.09] dark:text-indigo-100",
  archived:
    "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-300/16 dark:bg-slate-300/[0.08] dark:text-slate-200",
};

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatStatus(value: string) {
  return STATUS_LABEL[value] ?? value;
}

function formatPercent(value: number) {
  return `${value}%`;
}

function LabelMetricCard({
  label,
  value,
  meta,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: number;
  meta: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "slate" | "emerald" | "sky" | "violet";
}) {
  const toneMap = {
    slate:
      "border-slate-200/80 bg-white/[0.68] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-100",
    emerald:
      "border-emerald-200/80 bg-emerald-50/[0.72] text-emerald-700 dark:border-emerald-200/12 dark:bg-emerald-300/[0.07] dark:text-emerald-100",
    sky:
      "border-sky-200/80 bg-sky-50/[0.72] text-sky-700 dark:border-sky-200/12 dark:bg-sky-300/[0.08] dark:text-sky-100",
    violet:
      "border-indigo-200/80 bg-indigo-50/[0.72] text-indigo-700 dark:border-indigo-200/12 dark:bg-indigo-300/[0.08] dark:text-indigo-100",
  } as const;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[28px] border p-4 shadow-[0_18px_52px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_70px_rgba(0,0,0,0.22)]",
        toneMap[tone],
      )}
    >
      <div className="absolute inset-x-5 top-0 h-px bg-white/80 opacity-80 dark:bg-white/20" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground dark:text-white/45">
            {label}
          </div>
          <div className="mt-2 text-4xl font-semibold tracking-tight text-foreground dark:text-white">
            {value}
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/70 bg-white/[0.66] shadow-inner shadow-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <div className="mt-4 text-sm leading-6 text-muted-foreground dark:text-white/56">
        {meta}
      </div>
    </div>
  );
}

function TrackSpotlightCard({
  title,
  href,
  coverUrl,
  status,
  genre,
  releaseDate,
  isrc,
}: {
  title: string;
  href: string;
  coverUrl: string | null;
  status: string;
  genre: string | null;
  releaseDate: string | null;
  isrc: string | null;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-3 overflow-hidden rounded-[24px] border border-border/70 bg-background/[0.66] p-3 shadow-sm backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_18px_44px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/16 dark:hover:bg-white/[0.06]"
    >
      <div className="absolute inset-x-4 top-0 h-px bg-white/80 opacity-70 dark:bg-white/18" />
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={title}
          className="relative h-16 w-16 shrink-0 rounded-[18px] border border-border/70 object-cover shadow-[0_12px_30px_rgba(15,23,42,0.14)] dark:border-white/10 dark:shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
        />
      ) : (
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] border border-border/70 bg-muted/70 dark:border-white/10 dark:bg-white/[0.04]">
          <Music2 className="h-5 w-5 text-muted-foreground dark:text-white/40" />
        </div>
      )}

      <div className="relative min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground dark:text-white">
              {title}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground dark:text-white/48">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  STATUS_TONE[status] ?? STATUS_TONE.draft,
                )}
              >
                {formatStatus(status)}
              </span>
              {genre ? <span>{genre}</span> : null}
            </div>
          </div>
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60 transition group-hover:text-foreground dark:text-white/28 dark:group-hover:text-white/68" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground dark:text-white/44">
          <span>{formatDate(releaseDate)}</span>
          {isrc ? <span>ISRC {isrc}</span> : null}
        </div>
      </div>
    </Link>
  );
}

function ActionTile({
  href,
  label,
  description,
  icon: Icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[24px] border border-border/70 bg-background/[0.66] p-4 shadow-sm backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_18px_44px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/16 dark:hover:bg-white/[0.06]"
    >
      <div className="absolute inset-x-4 top-0 h-px bg-white/80 opacity-70 dark:bg-white/18" />
      <div className="flex items-start justify-between gap-3">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-[18px] border border-border/70 bg-muted/60 dark:border-white/10 dark:bg-white/[0.04]">
          <Icon className="h-[18px] w-[18px] text-foreground/80 dark:text-white/78" />
        </div>
        <ArrowRight className="relative h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground dark:text-white/30 dark:group-hover:text-white/65" />
      </div>
      <div className="relative mt-5 text-sm font-semibold text-foreground dark:text-white">
        {label}
      </div>
      <div className="relative mt-1 text-sm leading-6 text-muted-foreground dark:text-white/52">
        {description}
      </div>
    </Link>
  );
}

export default async function LabelOsPage() {
  const [stats, tracks, artists, entities] = await Promise.all([
    getLabelOsStats(),
    getLabelTracks(),
    getLabelArtists(),
    getLabelEntities(),
  ]);

  const readyTracks = tracks.filter((track) => track.status === "ready");
  const archivedTracks = tracks.filter((track) => track.status === "archived");
  const nextRelease =
    [...tracks]
      .filter((track) => track.release_date)
      .sort((a, b) => {
        const dateA = a.release_date ? new Date(a.release_date).getTime() : Number.MAX_SAFE_INTEGER;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      })[0] ?? null;
  const latestTracks = tracks.slice(0, 5);
  const latestArtists = artists.slice(0, 5);
  const liveCatalogCount = stats.releasedTracks + readyTracks.length;
  const catalogReadiness =
    stats.totalTracks > 0 ? Math.round((liveCatalogCount / stats.totalTracks) * 100) : 0;
  const metadataIssues = tracks.filter(
    (track) => !track.cover_url || !track.isrc || !track.release_date,
  ).length;
  const priorityAction = metadataIssues > 0
    ? `${metadataIssues} faixas pedem revisão de metadados`
    : readyTracks.length > 0
      ? `${readyTracks.length} faixas prontas para distribuição`
      : "Cadastrar o próximo lançamento";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted))_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.09),transparent_30%),radial-gradient(circle_at_top_right,rgba(196,181,253,0.08),transparent_28%),linear-gradient(180deg,#080d16_0%,#0a0f18_42%,#0b0f17_100%)]">
      <Container className="py-7 tablet:py-8">
        <div className="space-y-7">
          <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-white/[0.72] p-6 shadow-[0_24px_100px_rgba(15,23,42,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.72),rgba(12,17,28,0.88))] dark:shadow-[0_24px_120px_rgba(0,0,0,0.28)] tablet:p-7">
            <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_42%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_42%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.14),transparent_45%),radial-gradient(circle_at_top_right,rgba(196,181,253,0.12),transparent_42%)]" />
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-200/[0.34] blur-3xl dark:bg-sky-300/[0.10]" />
            <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-emerald-200/[0.28] blur-3xl dark:bg-indigo-300/[0.10]" />

            <div className="relative grid gap-6 laptop:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700 dark:border-sky-200/16 dark:bg-sky-200/[0.08] dark:text-sky-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Distribuidora ativa
                  </span>
                  <span className="rounded-full border border-border/70 bg-background/[0.58] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                    Catálogo central
                  </span>
                </div>

                <div className="max-w-3xl space-y-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground dark:text-white/42">
                    Label OS
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground tablet:text-[2.5rem] dark:text-white">
                    Painel da distribuidora para catálogo, splits e preparação de lançamento.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground dark:text-white/58">
                    Acompanhe o que está em draft, o que já pode subir e onde a operação precisa agir primeiro.
                  </p>
                </div>

                <div className="grid gap-3 tablet:grid-cols-3">
                  <div className="rounded-[24px] border border-border/70 bg-background/[0.62] p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:text-white/42">
                      <CheckCircle2 className="h-4 w-4" />
                      Prontidão
                    </div>
                    <div className="mt-3 text-3xl font-semibold text-foreground dark:text-white">
                      {formatPercent(catalogReadiness)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground dark:text-white/52">
                      Prontas ou lançadas.
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-border/70 bg-background/[0.62] p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:text-white/42">
                      <FileWarning className="h-4 w-4" />
                      Pendências
                    </div>
                    <div className="mt-3 text-3xl font-semibold text-foreground dark:text-white">
                      {metadataIssues}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground dark:text-white/52">
                      Capas, ISRC ou data.
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-border/70 bg-background/[0.62] p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:text-white/42">
                      <Disc3 className="h-4 w-4" />
                      Vivo
                    </div>
                    <div className="mt-3 text-3xl font-semibold text-foreground dark:text-white">
                      {liveCatalogCount}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground dark:text-white/52">
                      Faixas no pipeline bom.
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/label-os/tracks/new"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-medium text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-[linear-gradient(180deg,#f6f8fb,#dbe7ff)] dark:text-slate-900 dark:hover:bg-[linear-gradient(180deg,#ffffff,#e3ecff)]"
                  >
                    <Plus className="h-4 w-4" />
                    Nova track
                  </Link>
                  <Link
                    href="/label-os/entities/new"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-background/[0.62] px-5 text-sm font-medium text-foreground backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-background dark:border-white/14 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.08]"
                  >
                    <Building2 className="h-4 w-4" />
                    Nova entidade
                  </Link>
                  <Link
                    href="/label-os/tracks"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-background/[0.48] px-5 text-sm font-medium text-muted-foreground backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-background hover:text-foreground dark:border-white/14 dark:bg-white/[0.035] dark:text-white/78 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <Library className="h-4 w-4" />
                    Ver catálogo
                  </Link>
                </div>
              </div>

              <div className="rounded-[30px] border border-border/70 bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                      Operação do dia
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {nextRelease ? nextRelease.title : "Organizar próximos lançamentos"}
                    </div>
                    <div className="mt-1 text-sm text-white/55">
                      {nextRelease
                        ? `Próxima data no pipeline: ${formatDate(nextRelease.release_date)}`
                        : "Sem data cadastrada no pipeline agora."}
                    </div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.05]">
                    <CalendarClock className="h-5 w-5 text-white/78" />
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                    Melhor ação agora
                  </div>
                  <div className="mt-2 text-sm font-medium leading-6 text-white">
                    {priorityAction}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Draft</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{stats.draftTracks}</div>
                  </div>
                  <div className="rounded-2xl border border-sky-200/14 bg-sky-200/[0.07] p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-sky-100/64">Prontas</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{readyTracks.length}</div>
                  </div>
                  <div className="rounded-2xl border border-indigo-200/14 bg-indigo-200/[0.07] p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-indigo-100/64">Lançadas</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{stats.releasedTracks}</div>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-white/38">Ajuste fino</div>
                      <div className="mt-2 text-sm font-medium text-white">
                        {archivedTracks.length > 0
                          ? `${archivedTracks.length} faixas arquivadas para revisar`
                          : "Catálogo sem filas arquivadas no momento"}
                      </div>
                    </div>
                    <Link
                      href="/label-os/tracks"
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/78 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      Abrir tracks
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 tablet:grid-cols-2 laptop:grid-cols-4">
            <LabelMetricCard
              label="Faixas"
              value={stats.totalTracks}
              meta="Catálogo total dentro do Label OS."
              icon={Music2}
              tone="slate"
            />
            <LabelMetricCard
              label="Artistas"
              value={stats.totalArtists}
              meta="Roster ativo vinculado à operação."
              icon={Users2}
              tone="sky"
            />
            <LabelMetricCard
              label="Entidades"
              value={entities.length}
              meta="Editoras, selos, managers e parceiros."
              icon={FileBadge2}
              tone="violet"
            />
            <LabelMetricCard
              label="Catálogo vivo"
              value={stats.releasedTracks + readyTracks.length}
              meta="Faixas prontas ou já em circulação."
              icon={Disc3}
              tone="emerald"
            />
          </section>

          <section className="grid gap-5 laptop:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
            <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.66),rgba(11,16,27,0.84))] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl tablet:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">Pipeline</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Últimas faixas no catálogo</h2>
                  <p className="mt-1 text-sm text-white/54">
                    Leitura rápida do que entrou e do status de preparação do release.
                  </p>
                </div>
                <Link
                  href="/label-os/tracks"
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white"
                >
                  Ver todas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {latestTracks.length > 0 ? (
                  latestTracks.map((track) => (
                    <TrackSpotlightCard
                      key={track.id}
                      title={track.version ? `${track.title} (${track.version})` : track.title}
                      href={`/label-os/tracks/${track.id}`}
                      coverUrl={track.cover_url}
                      status={track.status}
                      genre={track.genre}
                      releaseDate={track.release_date}
                      isrc={track.isrc}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-5 py-10 text-center text-sm text-white/48">
                    Nenhuma faixa cadastrada ainda.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.66),rgba(11,16,27,0.84))] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl tablet:p-6">
                <div className="text-xs uppercase tracking-[0.18em] text-white/40">Ações rápidas</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Operação da distribuidora</h2>
                <div className="mt-5 grid gap-3">
                  <ActionTile
                    href="/label-os/tracks/new"
                    label="Cadastrar lançamento"
                    description="Criar track com capa, áudio, metadados e status inicial."
                    icon={Music2}
                  />
                  <ActionTile
                    href="/label-os/artists/new"
                    label="Adicionar artista"
                    description="Subir artista novo para o roster com links e contato."
                    icon={Users2}
                  />
                  <ActionTile
                    href="/label-os/entities/new"
                    label="Criar entidade"
                    description="Cadastrar editora, selo, manager ou participante jurídico."
                    icon={Building2}
                  />
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.66),rgba(11,16,27,0.84))] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl tablet:p-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">Roster</div>
                    <h2 className="mt-2 text-xl font-semibold text-white">Artistas recentes</h2>
                  </div>
                  <Link
                    href="/label-os/artists"
                    className="text-sm font-medium text-white/64 transition hover:text-white"
                  >
                    Abrir artistas
                  </Link>
                </div>

                <div className="mt-5 space-y-3">
                  {latestArtists.length > 0 ? (
                    latestArtists.map((artist) => (
                      <Link
                        key={artist.id}
                        href={`/label-os/artists/${artist.id}/edit`}
                        className="group flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-white/18 hover:bg-white/[0.05]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">
                            {artist.artist_name ?? artist.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/46">
                            <span>{artist.email ?? "Sem email"}</span>
                            {artist.instagram ? <span>{artist.instagram}</span> : null}
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-white/28 transition group-hover:text-white/68" />
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center text-sm text-white/48">
                      Nenhum artista cadastrado ainda.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 tablet:grid-cols-2">
                <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Prontas</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{readyTracks.length}</div>
                  <div className="mt-1 text-sm text-white/52">Faixas já organizadas para subir.</div>
                </div>
                <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Lançadas</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{stats.releasedTracks}</div>
                  <div className="mt-1 text-sm text-white/52">Catálogo já distribuído e vivo.</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Container>
    </div>
  );
}
