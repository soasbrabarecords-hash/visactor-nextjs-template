import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Container from "@/components/container";
import { getLabelTrackById } from "@/lib/label-os";
import {
  getTrackCompositions,
  getTrackMasterSplits,
  getTrackRoyaltySplits,
} from "@/lib/label-splits";
import TrackEditForm from "@/components/label-os/track-edit-form";
import CompositionForm from "@/components/label-os/composition-form";
import MasterSplitForm from "@/components/label-os/master-split-form";
import RoyaltySplitForm from "@/components/label-os/royalty-split-form";

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
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.72),rgba(11,16,27,0.88))] p-6 shadow-[0_24px_120px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.24em] text-white/38">Etapa {step} / 4</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/56">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default async function EditTrackPage({ params }: Props) {
  const { id } = await params;
  const track = await getLabelTrackById(id);

  if (!track) notFound();

  const [compositionsResult, masterResult, royaltiesResult] = await Promise.allSettled([
    getTrackCompositions(id),
    getTrackMasterSplits(id),
    getTrackRoyaltySplits(id),
  ]);

  const compositions = compositionsResult.status === "fulfilled" ? compositionsResult.value : [];
  const masterSplits = masterResult.status === "fulfilled" ? masterResult.value : [];
  const royaltySplits = royaltiesResult.status === "fulfilled" ? royaltiesResult.value : [];

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
          <div className="text-xs uppercase tracking-[0.24em] text-white/38">Label OS / Track</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Editar track</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/54">
            Agora a edicao cobre as quatro etapas do cadastro: dados da faixa, obra, fonograma e royalties.
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
            <CompositionForm
              trackId={track.id}
              existing={compositions}
              onSaved={() => {}}
            />
          </EditSection>

          <EditSection
            step={3}
            title="Fonograma"
            description="Ajuste interpretes, produtores e demais participacoes de master."
          >
            <MasterSplitForm
              trackId={track.id}
              existing={masterSplits}
              onSaved={() => {}}
            />
          </EditSection>

          <EditSection
            step={4}
            title="Royalties"
            description="Defina a divisao final de royalties share entre as entidades envolvidas."
          >
            <RoyaltySplitForm
              trackId={track.id}
              existing={royaltySplits}
              onSaved={() => {}}
            />
          </EditSection>
        </div>
      </Container>
    </div>
  );
}
