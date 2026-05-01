import { TopNav } from "@/components/nav";
import CurationTable from "@/components/workspace/curation-table";
import SpotifyAccountPlaylistsPanel from "@/components/workspace/spotify-account-playlists-panel";
import { getCurationPageData } from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function CuradoriaPage() {
  const data = await getCurationPageData();

  return (
    <div>
      <TopNav title="Curadoria" />

      <SpotifyAccountPlaylistsPanel />


      <CurationTable rows={data.rows} />
    </div>
  );
}
