import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import EntityForm from "@/components/label-os/entity-form";

export default function NewEntityPage() {
  return (
    <div>
      <PageIntro
        eyebrow="Label OS / Entidades"
        title="Nova Entidade"
        description="Cadastre gravadora, selo, editora, manager e funcoes extras como produtor fonografico."
      />
      <Container className="py-8">
        <div className="max-w-5xl">
          <EntityForm />
        </div>
      </Container>
    </div>
  );
}
