import { TopNav } from "@/components/nav";
import GlobalAdminPanel from "@/components/settings/global-admin-panel";

export const dynamic = "force-dynamic";

export default function GlobalAdminPage() {
  return (
    <>
      <TopNav title="Administração global" />
      <GlobalAdminPanel />
    </>
  );
}
