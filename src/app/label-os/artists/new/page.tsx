import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import ArtistForm from "@/components/label-os/artist-form";

export default function NewArtistPage() {
  return (
    <div>
      <PageIntro
        eyebrow="Label OS / Artistas"
        title="Novo Artista"
        description="Cadastre um novo artista no catálogo da gravadora."
      />
      <Container className="py-8">
        <div className="max-w-3xl">
          <ArtistForm />
        </div>
      </Container>
    </div>
  );
}
