import { TopNav } from "@/components/nav";
import ModuleGuard from "@/components/workspace/module-guard";

export default function LabelOsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleKey="label_os">
      <div>
        <TopNav title="Label OS" />
        {children}
      </div>
    </ModuleGuard>
  );
}
