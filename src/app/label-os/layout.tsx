import { TopNav } from "@/components/nav";

export default function LabelOsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <TopNav title="Label OS" />
      {children}
    </div>
  );
}
