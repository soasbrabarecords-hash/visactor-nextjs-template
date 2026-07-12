import { TopNav } from "@/components/nav";
import AccessManagementPanel from "@/components/settings/access-management-panel";

export const dynamic = "force-dynamic";

export default function AccessAccountsPage() {
  return (
    <>
      <TopNav title="Nova conta" />
      <AccessManagementPanel initialTab="accounts" />
    </>
  );
}
