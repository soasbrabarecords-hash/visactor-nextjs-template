import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import PlaylistsAiWorkbench from "@/components/workspace/playlists-ai-workbench";

export default function PlaylistsIaPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.10),transparent_26%),radial-gradient(circle_at_90%_0%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
      <TopNav title="Playlists IA" />

      <Container className="py-6">
        <PlaylistsAiWorkbench />
      </Container>
    </div>
  );
}
