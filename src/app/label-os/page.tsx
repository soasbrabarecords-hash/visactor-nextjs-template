import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Disc3,
  FileBadge2,
  Library,
  Music2,
  Plus,
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
  draft: "border-white/10 bg-white/6 text-white/72",
  ready: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  released: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  archived: "border-amber-400/20 bg-amber-400/10 text-amber-200",
};

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatStatus(value: string) {
  return STATUS_LABEL[value] ?? value;
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
    slate: "border-white/10 bg-white/[0.035] text-white/75",
    emerald: "border-emerald-400/16 bg-emerald-400/[0.08] text-emerald-100",
    sky: "border-sky-400/16 bg-sky-400/[0.08] text-sky-100",
    violet: "border-violet-400/16 bg-violet-400/[0.08] text-violet-100",
  } as const;

  return (
    <div className={cn("rounded-[24px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", toneMap[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
          <Icon className="h-[18px] w-[18px] text-white/75" />
        </div>
      </div>
      <div className="mt-4 text-sm text-white/56">{meta}</div>
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
      className="group flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/18 hover:bg-white/[0.05]"
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={title}
          className="h-16 w-16 shrink-0 rounded-[18px] border border-white/10 object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04]">
          <Music2 className="h-5 w-5 text-white/40" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/48">
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
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/28 transition group-hover:text-white/68" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/44">
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
      className="group rounded-[22px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/18 hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
          <Icon className="h-[18px] w-[18px] text-white/78" />
        </div>
        <ArrowRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/65" />
      </div>
      <div className="mt-5 text-sm font-semibold text-white">{label}</div>
      <div className="mt-1 text-sm leading-6 text-white/52">{description}</div>
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

  return (
    <div className="bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,#06101f_0%,#071121_46%,#08101d_100%)]">
      <Container className="py-7 tablet:py-8">
        <div className="space-y-7">
          <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,28,0.94),rgba(7,12,24,0.98))] p-6 shadow-[0_24px_120px_rgba(0,0,0,0.34)] tablet:p-7">
            <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_45%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_42%)]" />

            <div className="relative grid gap-6 laptop:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
                    Distribuidora ativa
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                    Catálogo central
                  </span>
                </div>

                <div className="max-w-3xl space-y-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/42">Label OS</div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white tablet:text-[2.5rem]">
                    Painel da distribuidora para catálogo, splits e preparação de lançamento.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-white/58">
                    Acompanhe o que está em draft, o que já pode subir e onde a operação precisa agir primeiro.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/label-os/tracks/new"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-medium text-black transition hover:bg-emerald-400"
                  >
                    <Plus className="h-4 w-4" />
                    Nova track
                  </Link>
                  <Link
                    href="/label-os/entities/new"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-white/14 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <Building2 className="h-4 w-4" />
                    Nova entidade
                  </Link>
                  <Link
                    href="/label-os/tracks"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-white/14 bg-black/20 px-5 text-sm font-medium text-white/78 transition hover:bg-white/6 hover:text-white"
                  >
                    <Library className="h-4 w-4" />
                    Ver catálogo
                  </Link>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/5">
                    <CalendarClock className="h-5 w-5 text-white/78" />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Draft</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{stats.draftTracks}</div>
                  </div>
                  <div className="rounded-2xl border border-sky-400/18 bg-sky-400/[0.08] p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-sky-100/70">Prontas</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{readyTracks.length}</div>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/18 bg-emerald-400/[0.08] p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/70">Lançadas</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{stats.releasedTracks}</div>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
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
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/25 px-3 py-2 text-xs font-medium text-white/78 transition hover:bg-white/8 hover:text-white"
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
            <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,25,0.96),rgba(7,11,22,0.98))] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.28)] tablet:p-6">
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
              <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,25,0.96),rgba(7,11,22,0.98))] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.28)] tablet:p-6">
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

              <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,25,0.96),rgba(7,11,22,0.98))] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.28)] tablet:p-6">
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
