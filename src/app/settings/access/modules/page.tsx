import { TopNav } from "@/components/nav";
import AccessManagementPanel from "@/components/settings/access-management-panel";

export default function AccessModulesPage() {
  return (
    <>
      <TopNav title="Gestão de Acessos" />
      <AccessManagementPanel initialTab="modules" />
    </>
  );
}
