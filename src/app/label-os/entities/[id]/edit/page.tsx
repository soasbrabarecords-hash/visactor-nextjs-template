import { notFound } from "next/navigation";
import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import EntityEditForm from "@/components/label-os/entity-edit-form";
import { getLabelEntityById } from "@/lib/label-entities";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditEntityPage({ params }: Props) {
  const { id } = await params;
  const entity = await getLabelEntityById(id);

  if (!entity) notFound();
  const publisher = entity.publisher_entity_id
    ? await getLabelEntityById(entity.publisher_entity_id)
    : null;

  return (
    <div>
      <PageIntro
        eyebrow="Label OS / Pessoas e Entidades"
        title="Editar participante"
        description={`Ajuste categoria, funcoes e dados de ${entity.display_name ?? entity.name}.`}
      />
      <Container className="py-8">
        <div className="max-w-5xl">
          <EntityEditForm entity={entity} publisher={publisher} />
        </div>
      </Container>
    </div>
  );
}
