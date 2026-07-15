import { TopNav } from "@/components/nav";
import ModuleGuard from "@/components/workspace/module-guard";
import { MusicIntelligenceDashboard } from "@/components/workspace/music-intelligence-dashboard";
import { getMusicIntelligence } from "@/lib/music-intelligence";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";
import { attachTrackProfilesToMusicIntelligence } from "@/lib/track-profile-engine";

export const dynamic = "force-dynamic";

export default async function PlaylistOsPage() {
  const access = await getPlaylistOsReadAccess();

  if (!access.allowed) {
    return (
      <ModuleGuard moduleKey="playlist_os">
        <TopNav title="Playlist OS" />
      </ModuleGuard>
    );
  }

  const data = await attachTrackProfilesToMusicIntelligence(
    await getMusicIntelligence(),
    access.workspaceId,
  );

  return (
    <ModuleGuard moduleKey="playlist_os">
      <TopNav title="Playlist OS" />
      <MusicIntelligenceDashboard data={data} />
    </ModuleGuard>
  );
}
