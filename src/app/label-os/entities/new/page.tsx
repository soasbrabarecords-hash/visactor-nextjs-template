import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import EntityForm from "@/components/label-os/entity-form";

export default function NewEntityPage() {
  return (
    <div>
      <PageIntro
        eyebrow="Label OS / Entidades"
        title="Nova Entidade"
        description="Cadastre um artista, gravadora, editora, produtor ou qualquer envolvido."
      />
      <Container className="py-8">
        <div className="max-w-3xl">
          <EntityForm />
        </div>
      </Container>
    </div>
  );
}
