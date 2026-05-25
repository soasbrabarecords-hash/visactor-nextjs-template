import ArtistOsDashboard from "@/components/artist-os/artist-os-dashboard";
import { getArtistOsDashboardData } from "@/lib/artist-os";

export const dynamic = "force-dynamic";

export default async function ArtistOsPage() {
  const data = await getArtistOsDashboardData();

  return <ArtistOsDashboard data={data} />;
}

