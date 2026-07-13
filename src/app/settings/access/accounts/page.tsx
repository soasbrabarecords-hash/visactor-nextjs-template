import { redirect } from "next/navigation";

export default function AccessAccountsPage() {
  redirect("/settings/admin");
}
