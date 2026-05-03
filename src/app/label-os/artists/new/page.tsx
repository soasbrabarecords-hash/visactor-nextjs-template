import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import ArtistForm from "@/components/label-os/artist-form";

export default function NewArtistPage() {
  return (
    <div>
      <PageIntro
        eyebrow="Label OS / Artistas"
        title="Novo Artista"
        description="Cadastre o artista e marque todas as funcoes que ele exerce dentro do catalogo."
      />
      <Container className="py-8">
        <div className="max-w-5xl">
          <ArtistForm />
        </div>
      </Container>
    </div>
  );
}
