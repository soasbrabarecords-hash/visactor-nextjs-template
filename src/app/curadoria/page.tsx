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
      <div className="min-h-screen bg-[radial-gradient(circle_at_82%_4%,rgba(125,211,252,0.22),transparent_34%)] bg-[#eef5f8] text-slate-950">
        <TopNav title="Playlist OS" />

        <SpotifyAccountPlaylistsPanel />

        <CurationTable
          rows={data.rows}
          previousDate={data.previousDate}
        />
      </div>
    </ModuleGuard>
  );
}
