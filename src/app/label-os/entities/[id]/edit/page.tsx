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

  return (
    <div>
      <PageIntro
        eyebrow="Label OS / Entidades"
        title="Editar Entidade"
        description={`Editando: ${entity.display_name ?? entity.name}`}
      />
      <Container className="py-8">
        <div className="max-w-3xl">
          <EntityEditForm entity={entity} />
        </div>
      </Container>
    </div>
  );
}
