import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import ArtistEditForm from "@/components/label-os/artist-edit-form";
import { getLabelArtistById } from "@/lib/label-os";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditArtistPage({ params }: Props) {
  const { id } = await params;
  const artist = await getLabelArtistById(id);

  if (!artist) notFound();

  return (
    <div>
      <div className="border-b border-border bg-slate-50 dark:bg-slate-900">
        <Container className="py-4">
          <Link
            href="/label-os/artists"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Voltar para Artistas
          </Link>
        </Container>
      </div>

      <PageIntro
        eyebrow="Label OS / Artistas"
        title={`Editar: ${artist.artist_name ?? artist.name}`}
        description="Atualize os dados do artista no catálogo da gravadora."
      />

      <Container className="py-8">
        <div className="max-w-3xl">
          <ArtistEditForm artist={artist} />
        </div>
      </Container>
    </div>
  );
}
