import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceSelection } from "@/lib/workspaces";

export type PlaylistOsReadAccess =
  | {
      allowed: true;
      status: 200;
      workspaceId: string;
      userId: string;
    }
  | {
      allowed: false;
      status: 401 | 403;
      message: string;
    };

export async function getPlaylistOsReadAccess(): Promise<PlaylistOsReadAccess> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return {
      allowed: false,
      status: 401,
      message: "Sessão necessária para acessar o Music Intelligence.",
    };
  }

  const selection = await getCurrentWorkspaceSelection();
  if (!selection) {
    return {
      allowed: false,
      status: 403,
      message: "Nenhum workspace ativo vinculado a esta conta.",
    };
  }

  const dataClient = createAdminClient() ?? supabase;
  const moduleQuery = dataClient
    .from("workspace_modules")
    .select("is_enabled")
    .eq("workspace_id", selection.workspace.id)
    .eq("module_key", "playlist_os")
    .maybeSingle();
  const roleQuery =
    selection.membership.role === "owner" ||
    selection.membership.role === "admin"
      ? Promise.resolve({
          data: { role: selection.membership.role },
          error: null,
        })
      : dataClient
          .from("module_roles")
          .select("role")
          .eq("workspace_id", selection.workspace.id)
          .eq("user_id", userId)
          .eq("module_key", "playlist_os")
          .maybeSingle();
  const [moduleResult, roleResult] = await Promise.all([
    moduleQuery,
    roleQuery,
  ]);

  if (moduleResult.error) {
    throw new Error(
      `Playlist OS access module lookup failed: ${moduleResult.error.message}`,
    );
  }

  if (roleResult.error) {
    throw new Error(
      `Playlist OS access role lookup failed: ${roleResult.error.message}`,
    );
  }

  if (!moduleResult.data?.is_enabled || !roleResult.data?.role) {
    return {
      allowed: false,
      status: 403,
      message: "Você não tem acesso ao módulo Playlist OS neste workspace.",
    };
  }

  return {
    allowed: true,
    status: 200,
    workspaceId: selection.workspace.id,
    userId,
  };
}
