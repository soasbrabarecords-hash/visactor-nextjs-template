import { TopNav } from "@/components/nav";
import SpotifyReleaseRadar from "@/components/workspace/spotify-release-radar";
import { getSpotifyReleaseRadarPageData } from "@/lib/spotify-release-radar-data";

export const dynamic = "force-dynamic";

export default async function NovidadesPage() {
  const data = await getSpotifyReleaseRadarPageData();

  return (
    <>
      <TopNav title="Novidades" />
      <SpotifyReleaseRadar data={data} />
    </>
  );
}
