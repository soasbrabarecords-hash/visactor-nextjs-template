import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import TrackForm from "@/components/label-os/track-form";
import { getLabelArtists } from "@/lib/label-os";

export const dynamic = "force-dynamic";

export default async function NewTrackPage() {
  const artists = await getLabelArtists();

  return (
    <div>
      <PageIntro
        eyebrow="Label OS / Tracks"
        title="Nova Track"
        description="Cadastro limpo de faixa com metadados principais, artistas, genero, arquivos e divisao de direitos."
      />
      <Container className="py-8">
        <div className="max-w-5xl">
          <TrackForm artists={artists} />
        </div>
      </Container>
    </div>
  );
}
