import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Music } from "lucide-react";
import Container from "@/components/container";
import {
  getLabelTrackById,
  getTrackParticipants,
} from "@/lib/label-os";
import {
  getTrackCompositions,
  getTrackMasterSplits,
  getTrackRoyaltySplits,
} from "@/lib/label-splits";
import AddParticipantForm from "@/components/label-os/add-participant-form";
import CompositionForm from "@/components/label-os/composition-form";
import MasterSplitForm from "@/components/label-os/master-split-form";
import RoyaltySplitForm from "@/components/label-os/royalty-split-form";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Pronta",
  released: "Lançada",
  archived: "Arquivada",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  ready: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  released:
    "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  archived:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const ROLE_LABEL: Record<string, string> = {
  main_artist: "Artista Principal",
  featured_artist: "Artista Feat.",
  producer: "Produtor",
  composer: "Compositor",
  label: "Gravadora",
  publisher: "Publisher",
  manager: "Manager",
  other: "Outro",
};

function pctColor(total: number) {
  if (Math.abs(total - 100) < 0.01) return "text-green-600 dark:text-green-400";
  if (total > 100) return "text-red-600 dark:text-red-400";
  return "text-amber-600 dark:text-amber-400";
}

function SplitSectionHeader({
  title,
  total,
  count,
}: {
  title: string;
  total: number;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <h3 className="text-sm font-semibold">
        {title}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          ({count})
        </span>
      </h3>
      {count > 0 && (
        <span className={`text-sm font-bold ${pctColor(total)}`}>
          {total.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%
        </span>
      )}
    </div>
  );
}

type Props = { params: Promise<{ id: string }> };

export default async function TrackDetailPage({ params }: Props) {
  const { id } = await params;

  const [track, participants, compositions, masterSplits, royaltySplits] =
    await Promise.all([
      getLabelTrackById(id),
      getTrackParticipants(id),
      getTrackCompositions(id),
      getTrackMasterSplits(id),
      getTrackRoyaltySplits(id),
    ]);

  if (!track) notFound();

  const compositionTotal = compositions.reduce<number>(
    (acc, c) => acc + c.percentage,
    0,
  );
  const masterTotal = masterSplits.reduce<number>(
    (acc, s) => acc + s.percentage,
    0,
  );
  const royaltyTotal = royaltySplits.reduce<number>(
    (acc, s) => acc + s.percentage,
    0,
  );

  return (
    <div>
      {/* Breadcrumb */}
      <div className="border-b border-border bg-slate-50 dark:bg-slate-900">
        <Container className="py-4">
          <Link
            href="/label-os/tracks"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Voltar para Tracks
          </Link>
        </Container>
      </div>

      <Container className="py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Coluna principal */}
          <div className="flex flex-col gap-6">
            {/* Header da track */}
            <div className="flex gap-5">
              {track.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={track.cover_url}
                  alt={track.title}
                  className="h-24 w-24 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-slate-100 dark:bg-slate-800">
                  <Music size={28} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col justify-center gap-2">
                <h2 className="text-2xl font-semibold">
                  {track.title}
                  {track.version && (
                    <span className="ml-2 text-base font-normal text-muted-foreground">
                      ({track.version})
                    </span>
                  )}
                </h2>
                <span
                  className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[track.status] ?? STATUS_COLOR.draft}`}
                >
                  {STATUS_LABEL[track.status] ?? track.status}
                </span>
              </div>
            </div>

            {/* Dados da track */}
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold">Informações</h3>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
                {(
                  [
                    { label: "Gênero", value: track.genre },
                    { label: "BPM", value: track.bpm?.toString() },
                    { label: "Tonalidade", value: track.key },
                    {
                      label: "Lançamento",
                      value: track.release_date
                        ? new Date(track.release_date).toLocaleDateString(
                            "pt-BR",
                          )
                        : null,
                    },
                    { label: "ISRC", value: track.isrc },
                    { label: "UPC", value: track.upc },
                    {
                      label: "Explícito",
                      value: track.explicit ? "Sim" : "Não",
                    },
                  ] as { label: string; value: string | null | undefined }[]
                ).map(({ label, value }) => (
                  <div key={label} className="bg-card px-5 py-3">
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {value ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>
              {track.notes && (
                <div className="border-t border-border px-5 py-4">
                  <dt className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                    Observações
                  </dt>
                  <dd className="text-sm text-foreground">{track.notes}</dd>
                </div>
              )}
            </div>

            {/* Arquivos */}
            {(track.audio_url || track.contract_url) && (
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-5 py-3">
                  <h3 className="text-sm font-semibold">Arquivos</h3>
                </div>
                <div className="flex flex-col gap-4 px-5 py-4">
                  {track.audio_url && (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                        Preview de áudio
                      </p>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio
                        controls
                        src={track.audio_url}
                        className="w-full"
                      />
                    </div>
                  )}
                  {track.contract_url && (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                        Contrato
                      </p>
                      <a
                        href={track.contract_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm underline underline-offset-2 hover:text-foreground"
                      >
                        <FileText size={14} />
                        Abrir contrato (PDF)
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Participantes legados */}
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold">
                  Splits & Participantes
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({participants.length})
                  </span>
                </h3>
              </div>

              {participants.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nenhum participante adicionado ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-slate-50 dark:bg-slate-900">
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                          Artista
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                          Papel
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                          Royalties
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                          Publishing
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                          Master
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-4 py-2.5 font-medium">
                            {p.label_artists?.artist_name ??
                              p.label_artists?.name ??
                              "—"}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {ROLE_LABEL[p.role] ?? p.role}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {p.royalty_percentage}%
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {p.publishing_percentage}%
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {p.master_percentage}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-slate-50 dark:bg-slate-900">
                        <td
                          colSpan={2}
                          className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          Total
                        </td>
                        {(
                          [
                            "royalty_percentage",
                            "publishing_percentage",
                            "master_percentage",
                          ] as const
                        ).map((field) => {
                          const total = participants.reduce(
                            (acc, p) => acc + (Number(p[field]) || 0),
                            0,
                          );
                          return (
                            <td
                              key={field}
                              className={`px-4 py-2.5 text-right text-xs font-semibold ${pctColor(total)}`}
                            >
                              {total}%
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* ── OBRA (Composições) ─────────────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card">
              <SplitSectionHeader
                title="Obra — Composições"
                total={compositionTotal}
                count={compositions.length}
              />
              <div className="px-5 py-4">
                <CompositionForm
                  trackId={track.id}
                  existing={compositions}
                  onSaved={() => {}}
                />
              </div>
            </div>

            {/* ── FONOGRAMA (Master Splits) ──────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card">
              <SplitSectionHeader
                title="Fonograma — Master"
                total={masterTotal}
                count={masterSplits.length}
              />
              <div className="px-5 py-4">
                <MasterSplitForm
                  trackId={track.id}
                  existing={masterSplits}
                  onSaved={() => {}}
                />
              </div>
            </div>

            {/* ── ROYALTIES SHARE ───────────────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card">
              <SplitSectionHeader
                title="Royalties Share"
                total={royaltyTotal}
                count={royaltySplits.length}
              />
              <div className="px-5 py-4">
                <RoyaltySplitForm
                  trackId={track.id}
                  existing={royaltySplits}
                  onSaved={() => {}}
                />
              </div>
            </div>
          </div>

          {/* Sidebar — formulário de participante */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <AddParticipantForm
              trackId={track.id}
              participants={participants}
            />
          </div>
        </div>
      </Container>
    </div>
  );
}
