import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import ModuleGuard from "@/components/workspace/module-guard";
import PlaylistsAiWorkbench from "@/components/workspace/playlists-ai-workbench";

export const dynamic = "force-dynamic";

export default async function PlaylistsIaPage() {
  return (
    <ModuleGuard moduleKey="playlist_os">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.10),transparent_26%),radial-gradient(circle_at_90%_0%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
        <TopNav title="Playlist OS" />

        <Container className="py-5">
          <PlaylistsAiWorkbench />
        </Container>
      </div>
    </ModuleGuard>
  );
}
