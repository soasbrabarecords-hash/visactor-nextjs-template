import { TopNav } from "@/components/nav";
import ModuleGuard from "@/components/workspace/module-guard";
import CurationTable from "@/components/workspace/curation-table";
import SpotifyAccountPlaylistsPanel from "@/components/workspace/spotify-account-playlists-panel";
import { getCurationPageData } from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function CuradoriaPage() {
  const data = await getCurationPageData();

  return (
    <ModuleGuard moduleKey="playlist_os">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.06),transparent_18%),linear-gradient(180deg,#040816_0%,#030712_100%)]">
        <TopNav title="Curadoria" />

        <SpotifyAccountPlaylistsPanel />

        <CurationTable
          rows={data.rows}
          previousDate={data.previousDate}
        />
      </div>
    </ModuleGuard>
  );
}
