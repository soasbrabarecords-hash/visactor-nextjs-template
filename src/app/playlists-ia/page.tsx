import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import ModuleGuard from "@/components/workspace/module-guard";
import PlaylistsAiWorkbench from "@/components/workspace/playlists-ai-workbench";

export const dynamic = "force-dynamic";

export default async function PlaylistsIaPage() {
  return (
    <ModuleGuard moduleKey="playlist_os">
      <div className="h-[100dvh] overflow-hidden bg-background">
        <TopNav title="Playlists IA" />

        <Container className="h-[calc(100dvh-3.5rem)] max-w-none px-0 py-0">
          <PlaylistsAiWorkbench />
        </Container>
      </div>
    </ModuleGuard>
  );
}
