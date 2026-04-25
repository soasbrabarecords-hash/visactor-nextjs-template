import { TopNav } from "@/components/nav";

export default function ChartsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopNav title="Charts" />
      <main>{children}</main>
    </>
  );
}
