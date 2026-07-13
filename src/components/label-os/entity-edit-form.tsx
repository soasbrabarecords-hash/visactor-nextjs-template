"use client";

import EntityForm from "@/components/label-os/entity-form";
import type { LabelEntity } from "@/lib/label-entities-types";

export default function EntityEditForm({
  entity,
  publisher,
}: {
  entity: LabelEntity;
  publisher: LabelEntity | null;
}) {
  return <EntityForm entity={entity} initialPublisher={publisher} />;
}
