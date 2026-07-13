import { TopNav } from "@/components/nav";
import AccessManagementPanel from "@/components/settings/access-management-panel";

export default function AccessSettingsPage() {
  return (
    <>
      <TopNav title="Gestão de Acessos" />
      <AccessManagementPanel initialTab="overview" />
    </>
  );
}
