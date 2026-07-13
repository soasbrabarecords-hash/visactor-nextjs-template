import { notFound, redirect } from "next/navigation";
import { getLabelEntityByLegacyArtistId } from "@/lib/label-entities";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditArtistPage({ params }: Props) {
  const { id } = await params;
  const entity = await getLabelEntityByLegacyArtistId(id);

  if (!entity) notFound();
  redirect(`/label-os/entities/${entity.id}/edit`);
}
