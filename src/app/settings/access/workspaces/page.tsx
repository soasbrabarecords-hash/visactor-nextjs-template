import { TopNav } from "@/components/nav";
import AccessManagementPanel from "@/components/settings/access-management-panel";

export const dynamic = "force-dynamic";

export default function AccessWorkspacesPage() {
  return (
    <>
      <TopNav title="Gestão de Acessos" />
      <AccessManagementPanel initialTab="workspaces" />
    </>
  );
}
