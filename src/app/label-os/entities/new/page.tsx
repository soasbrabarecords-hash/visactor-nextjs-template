import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import EntityForm from "@/components/label-os/entity-form";

export default function NewEntityPage() {
  return (
    <div>
      <PageIntro
        eyebrow="Label OS / Pessoas e Entidades"
        title="Novo participante"
        description="Cadastre uma pessoa ou empresa uma única vez, preservando sua categoria e todas as funções no catálogo."
      />
      <Container className="py-8">
        <div className="max-w-5xl">
          <EntityForm />
        </div>
      </Container>
    </div>
  );
}
