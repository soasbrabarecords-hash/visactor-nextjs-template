import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Music, Pencil, Play, Disc3 } from "lucide-react";
import Container from "@/components/container";
import { getLabelTrackById, getTrackParticipants, type TrackParticipant } from "@/lib/label-os";
import {
  getTrackCompositions,
  getTrackMasterSplits,
  getTrackRoyaltySplits,
} from "@/lib/label-splits";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Pronta",
  released: "Lancada",
  archived: "Arquivada",
};

const STEP_LABELS = [
  "Dados da track",
  "Obra",
  "Fonograma",
  "Royalties",
] as const;

function participantName(participant: TrackParticipant) {
  return (
    participant.label_artists?.artist_name ??
    participant.label_artists?.name ??
    participant.label_entities?.display_name ??
    participant.label_entities?.name ??
    "Participante"
  );
}

function formatPercentage(value: number) {
  return `${Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">{label}</div>
      <div className="mt-2 text-sm font-medium text-white">{value || "—"}</div>
    </div>
  );
}

function PreviewSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.72),rgba(11,16,27,0.88))] p-6 shadow-[0_24px_120px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-white/38">
            Etapa {step} / 4
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/56">{description}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/72">
          {STEP_LABELS[step - 1]}
        </div>
      </div>
      {children}
    </section>
  );
}

type Props = { params: Promise<{ id: string }> };

export default async function TrackDetailPage({ params }: Props) {
  const { id } = await params;
  const track = await getLabelTrackById(id);

  if (!track) notFound();

  const [participantsResult, compositionsResult, masterResult, royaltiesResult] =
    await Promise.allSettled([
      getTrackParticipants(id),
      getTrackCompositions(id),
      getTrackMasterSplits(id),
      getTrackRoyaltySplits(id),
    ]);

  const participants = participantsResult.status === "fulfilled" ? participantsResult.value : [];
  const compositions = compositionsResult.status === "fulfilled" ? compositionsResult.value : [];
  const masterSplits = masterResult.status === "fulfilled" ? masterResult.value : [];
  const royaltySplits = royaltiesResult.status === "fulfilled" ? royaltiesResult.value : [];

  const mainArtists = participants.filter(
    (participant) =>
      participant.role === "main_artist" ||
      participant.role === "featured_artist" ||
      participant.artist_id,
  );
  const obraPreview =
    compositions.length > 0
      ? compositions.map((item) => ({
          name: item.entity_display_name ?? item.entity_name ?? "Compositor",
          percentage: item.percentage,
        }))
      : participants
          .filter(
            (participant) =>
              participant.role === "composer" || Number(participant.publishing_percentage) > 0,
          )
          .map((participant) => ({
            name: participantName(participant),
            percentage: Number(participant.publishing_percentage) || 0,
          }));

  const fonogramaPreview =
    masterSplits.length > 0
      ? masterSplits.map((item) => ({
          name: item.entity_display_name ?? item.entity_name ?? "Participante",
          role: item.group_type,
          percentage: item.percentage,
        }))
      : participants
          .filter((participant) => Number(participant.master_percentage) > 0)
          .map((participant) => ({
            name: participantName(participant),
            role: participant.role,
            percentage: Number(participant.master_percentage) || 0,
          }));

  const royaltiesPreview =
    royaltySplits.length > 0
      ? royaltySplits.map((item) => ({
          name: item.entity_display_name ?? item.entity_name ?? "Entidade",
          percentage: item.percentage,
        }))
      : participants
          .filter((participant) => Number(participant.royalty_percentage) > 0)
          .map((participant) => ({
            name: participantName(participant),
            percentage: Number(participant.royalty_percentage) || 0,
          }));

  return (
    <div>
      <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.86),rgba(11,16,27,0.95))]">
        <Container className="py-4">
          <Link
            href="/label-os/tracks"
            className="inline-flex items-center gap-2 text-sm text-white/58 transition hover:text-white"
          >
            <ArrowLeft size={14} />
            Voltar para o catalogo
          </Link>
        </Container>
      </div>

      <Container className="max-w-6xl py-8">
        <div className="mb-8 overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.88),rgba(11,16,27,0.96))] shadow-[0_24px_120px_rgba(0,0,0,0.28)]">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8 lg:py-8">
            <div>
              {track.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={track.cover_url}
                  alt={track.title}
                  className="aspect-square w-full rounded-[28px] border border-white/10 object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04]">
                  <Music className="h-10 w-10 text-white/30" />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between gap-6">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-white/36">Label OS / Preview</div>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                  {track.title}
                  {track.version ? (
                    <span className="ml-3 text-2xl font-medium text-white/46">({track.version})</span>
                  ) : null}
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/80">
                    {STATUS_LABEL[track.status] ?? track.status}
                  </span>
                  {track.genre ? (
                    <span className="rounded-full border border-sky-200/14 bg-sky-200/[0.08] px-3 py-1.5 text-xs font-medium text-sky-50">
                      {track.genre}
                    </span>
                  ) : null}
                  {track.subgenre ? (
                    <span className="rounded-full border border-violet-200/14 bg-violet-200/[0.08] px-3 py-1.5 text-xs font-medium text-violet-50">
                      {track.subgenre}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/62">
                    {track.explicit ? "Conteudo explicito" : "Sem conteudo explicito"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <InfoCard
                  label="Artistas"
                  value={
                    mainArtists.length > 0
                      ? mainArtists.map((participant) => participantName(participant)).join(", ")
                      : null
                  }
                />
                <InfoCard label="Lancamento" value={track.release_date || "Sem data"} />
                <InfoCard label="ISRC" value={track.isrc} />
                <InfoCard label="UPC" value={track.upc} />
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/label-os/tracks/${track.id}/edit`}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(180deg,#f6f8fb,#dbe7ff)] px-5 text-sm font-medium text-slate-900 transition hover:bg-[linear-gradient(180deg,#ffffff,#e3ecff)]"
                >
                  <Pencil size={15} />
                  Editar track
                </Link>
                <Link
                  href="/label-os/tracks"
                  className="inline-flex h-11 items-center rounded-full border border-white/12 bg-white/5 px-5 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white"
                >
                  Ver catalogo
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <PreviewSection
            step={1}
            title="Dados da track"
            description="Visao geral do cadastro principal com metadata, capa, audio e arquivos relacionados."
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <InfoCard label="Genero" value={track.genre} />
                <InfoCard label="Subgenero" value={track.subgenre} />
                <InfoCard label="Lancamento" value={track.release_date} />
                <InfoCard label="BPM" value={track.bpm ? String(track.bpm) : null} />
                <InfoCard label="Tonalidade" value={track.key} />
                <InfoCard label="Status" value={STATUS_LABEL[track.status] ?? track.status} />
              </div>

              <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                {track.audio_url ? (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                      <Play className="h-4 w-4 text-sky-100" />
                      Preview de audio
                    </div>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls src={track.audio_url} className="w-full" />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/46">
                    Nenhum audio vinculado.
                  </div>
                )}

                {track.contract_url ? (
                  <a
                    href={track.contract_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-white/78 underline underline-offset-2 transition hover:text-white"
                  >
                    <FileText className="h-4 w-4" />
                    Abrir contrato
                  </a>
                ) : null}
              </div>
            </div>
          </PreviewSection>

          <PreviewSection
            step={2}
            title="Obra"
            description="Resumo dos compositores, publishing e letra da faixa para conferencia antes do envio."
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 text-sm font-medium text-white">Splits de obra</div>
                {obraPreview.length > 0 ? (
                  <div className="space-y-3">
                    {obraPreview.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3"
                      >
                        <div className="text-sm font-medium text-white">{item.name}</div>
                        <div className="text-sm text-white/64">{formatPercentage(item.percentage)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/44">
                    Nenhum split de obra preenchido ainda.
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 text-sm font-medium text-white">Letra</div>
                <div className="max-h-[280px] overflow-auto rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm leading-6 text-white/72">
                  {track.lyrics ? (
                    <div className="whitespace-pre-wrap">{track.lyrics}</div>
                  ) : (
                    <div className="text-white/42">Nenhuma letra cadastrada.</div>
                  )}
                </div>
              </div>
            </div>
          </PreviewSection>

          <PreviewSection
            step={3}
            title="Fonograma"
            description="Leitura dos interpretes, produtores e participantes com participacao de master."
          >
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              {fonogramaPreview.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {fonogramaPreview.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">{item.name}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/34">
                            {item.role}
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/72">
                          <Disc3 className="h-3.5 w-3.5" />
                          {formatPercentage(item.percentage)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/44">
                  Nenhum dado de fonograma preenchido ainda.
                </div>
              )}
            </div>
          </PreviewSection>

          <PreviewSection
            step={4}
            title="Royalties"
            description="Divisao final de royalties share para conferencia rapida antes de editar ou seguir a operacao."
          >
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              {royaltiesPreview.length > 0 ? (
                <div className="space-y-3">
                  {royaltiesPreview.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3"
                    >
                      <div className="text-sm font-medium text-white">{item.name}</div>
                      <div className="text-sm text-white/64">{formatPercentage(item.percentage)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/44">
                  Nenhum split de royalties preenchido ainda.
                </div>
              )}
            </div>
          </PreviewSection>
        </div>
      </Container>
    </div>
  );
}
