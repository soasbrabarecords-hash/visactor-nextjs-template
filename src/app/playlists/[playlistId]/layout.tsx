import { TopNav } from "@/components/nav";

export default function PlaylistAnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopNav title="Analise da Playlist" />
      <main>{children}</main>
    </>
  );
}
