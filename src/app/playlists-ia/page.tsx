import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import ModuleGuard from "@/components/workspace/module-guard";
import PlaylistsAiWorkbench from "@/components/workspace/playlists-ai-workbench";

export const dynamic = "force-dynamic";

export default async function PlaylistsIaPage() {
  return (
    <ModuleGuard moduleKey="playlist_os">
      <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.07),transparent_24%),radial-gradient(circle_at_90%_0%,rgba(14,165,233,0.08),transparent_26%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
        <TopNav title="Playlist OS" />

        <Container className="h-[calc(100dvh-3.5rem)] py-3">
          <PlaylistsAiWorkbench />
        </Container>
      </div>
    </ModuleGuard>
  );
}
