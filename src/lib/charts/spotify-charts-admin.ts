import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceContext } from "@/lib/workspaces";

export async function canCurrentUserBackfillSpotifyCharts() {
  const workspace = await getCurrentWorkspaceContext().catch(() => null);

  if (
    !workspace ||
    !["owner", "admin"].includes(workspace.membership.role)
  ) {
    return false;
  }

  const client = createAdminClient() ?? (await createClient());
  const { data, error } = await client
    .from("workspaces")
    .select("type")
    .eq("id", workspace.workspace.id)
    .maybeSingle();

  return !error && data?.type === "internal";
}
