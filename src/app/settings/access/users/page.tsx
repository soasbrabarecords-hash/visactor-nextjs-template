import { TopNav } from "@/components/nav";
import AccessManagementPanel from "@/components/settings/access-management-panel";

export default function AccessUsersPage() {
  return (
    <>
      <TopNav title="Gestão de Acessos" />
      <AccessManagementPanel initialTab="users" />
    </>
  );
}
