import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AccessAccountsPage() {
  redirect("/settings/admin");
}
