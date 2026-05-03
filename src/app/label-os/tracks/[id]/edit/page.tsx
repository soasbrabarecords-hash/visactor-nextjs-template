import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Container from "@/components/container";
import { getLabelTrackById } from "@/lib/label-os";
import TrackEditForm from "@/components/label-os/track-edit-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditTrackPage({ params }: Props) {
  const { id } = await params;
  const track = await getLabelTrackById(id);

  if (!track) notFound();

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

      <Container className="max-w-5xl py-8">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.24em] text-white/38">Label OS / Track</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Editar track</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/54">
            Ajuste os dados gerais da faixa com uma leitura mais clara e sem mexer nos splits.
          </p>
        </div>

        <TrackEditForm track={track} />
      </Container>
    </div>
  );
}
