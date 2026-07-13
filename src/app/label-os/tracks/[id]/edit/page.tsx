import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/components/container";
import CompositionForm from "@/components/label-os/composition-form";
import MasterSplitForm from "@/components/label-os/master-split-form";
import RoyaltySplitForm from "@/components/label-os/royalty-split-form";
import TrackEditForm from "@/components/label-os/track-edit-form";
import { getLabelTrackById } from "@/lib/label-os";
import {
  getTrackCompositions,
  getTrackMasterSplits,
  getTrackRoyaltySplits,
} from "@/lib/label-splits";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function EditSection({
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
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm tablet:p-6">
      <div className="mb-5">
        <div className="text-white/38 text-xs uppercase tracking-[0.24em]">
          Etapa {step} / 4
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="text-white/56 mt-2 max-w-2xl text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default async function EditTrackPage({ params }: Props) {
  const { id } = await params;
  const [trackResult, compositionsResult, masterResult, royaltiesResult] =
    await Promise.allSettled([
      getLabelTrackById(id),
      getTrackCompositions(id),
      getTrackMasterSplits(id),
      getTrackRoyaltySplits(id),
    ]);
  if (trackResult.status === "rejected") throw trackResult.reason;
  const track = trackResult.value;

  if (!track) notFound();

  const compositions =
    compositionsResult.status === "fulfilled" ? compositionsResult.value : [];
  const masterSplits =
    masterResult.status === "fulfilled" ? masterResult.value : [];
  const royaltySplits =
    royaltiesResult.status === "fulfilled" ? royaltiesResult.value : [];

  return (
    <div>
      <div className="border-b border-border bg-slate-50 dark:bg-slate-900">
        <Container className="py-4">
          <Link
            href={`/label-os/tracks/${track.id}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Voltar para a track
          </Link>
        </Container>
      </div>

      <Container className="max-w-6xl py-8">
        <div className="mb-6">
          <div className="text-white/38 text-xs uppercase tracking-[0.24em]">
            Label OS / Track
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Editar track
          </h1>
          <p className="text-white/54 mt-2 max-w-2xl text-sm">
            Agora a edicao cobre as quatro etapas do cadastro: dados da faixa,
            obra, fonograma e royalties.
          </p>
        </div>

        <div className="grid gap-6">
          <EditSection
            step={1}
            title="Dados da track"
            description="Ajuste titulo, versao, genero, subgenero, status e letra da faixa."
          >
            <TrackEditForm track={track} />
          </EditSection>

          <EditSection
            step={2}
            title="Obra"
            description="Edite os compositores e os percentuais de publishing da obra."
          >
            <CompositionForm trackId={track.id} existing={compositions} />
          </EditSection>

          <EditSection
            step={3}
            title="Fonograma"
            description="Ajuste interpretes, produtores e demais participacoes de master."
          >
            <MasterSplitForm trackId={track.id} existing={masterSplits} />
          </EditSection>

          <EditSection
            step={4}
            title="Royalties"
            description="Defina a divisao final de royalties share entre as entidades envolvidas."
          >
            <RoyaltySplitForm trackId={track.id} existing={royaltySplits} />
          </EditSection>
        </div>
      </Container>
    </div>
  );
}
