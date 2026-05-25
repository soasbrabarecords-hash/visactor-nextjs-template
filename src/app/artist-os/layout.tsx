import { TopNav } from "@/components/nav";
import ArtistOsShell from "@/components/artist-os/artist-os-shell";

export default function ArtistOsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav title="ArtistOS" />
      <ArtistOsShell>{children}</ArtistOsShell>
    </>
  );
}

