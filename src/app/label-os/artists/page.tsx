import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ArtistsPage() {
  redirect("/label-os/entities?view=artists");
}
