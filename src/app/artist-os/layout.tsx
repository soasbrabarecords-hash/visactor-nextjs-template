import { TopNav } from "@/components/nav";
import ArtistOsShell from "@/components/artist-os/artist-os-shell";
import ModuleGuard from "@/components/workspace/module-guard";

export default function ArtistOsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGuard moduleKey="artist_os">
      <TopNav title="Artist OS" />
      <ArtistOsShell>{children}</ArtistOsShell>
    </ModuleGuard>
  );
}
