import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeModuleKey,
  selectCurrentWorkspace,
  type ModuleRole,
  type WorkspaceModuleAccess,
  type WorkspaceModuleRole,
  type WorkspaceRole,
  type WorkspaceSummary,
} from "@/lib/workspace-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_WORKSPACE_MESSAGE =
  "Nenhum workspace vinculado. Peça acesso a um administrador.";

function normalizeWorkspaceRole(role: string | null | undefined): WorkspaceRole {
  if (role === "owner" || role === "admin" || role === "viewer") {
    return role;
  }

  return "member";
}

function emptyWorkspaceAccess(error: string | null) {
  return {
    currentWorkspace: null,
    modules: [],
    moduleRoles: [],
    isFallbackAccess: false,
    isLoading: false,
    error,
    userWorkspaces: [],
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const dataClient = createAdminClient() ?? supabase;
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return NextResponse.json({
        success: true,
        data: emptyWorkspaceAccess(null),
      });
    }

    const { data: accessRows, error: accessError } = await dataClient
      .from("workspace_users")
      .select("workspace_id, role, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (accessError) {
      throw accessError;
    }

    let workspaceAccessRows = (accessRows ?? []) as Array<{
      workspace_id: string;
      role: string | null;
    }>;

    if (workspaceAccessRows.length === 0) {
      const { data: membershipRows, error: membershipError } = await dataClient
        .from("workspace_memberships")
        .select("workspace_id, role, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (membershipError) {
        throw membershipError;
      }

      workspaceAccessRows = ((membershipRows ?? []) as Array<{
        workspace_id: string;
        role: string | null;
      }>).map((row) => ({
        workspace_id: row.workspace_id,
        role: normalizeWorkspaceRole(row.role),
      }));
    }

    if (workspaceAccessRows.length === 0) {
      return NextResponse.json({
        success: true,
        data: emptyWorkspaceAccess(NO_WORKSPACE_MESSAGE),
      });
    }

    const workspaceIds = Array.from(
      new Set(workspaceAccessRows.map((row) => row.workspace_id)),
    );
    const { data: workspaceRows, error: workspacesError } = await dataClient
      .from("workspaces")
      .select("id, name, slug, type, status")
      .in("id", workspaceIds);

    if (workspacesError) {
      throw workspacesError;
    }

    const workspaces = workspaceAccessRows
      .map((accessRow) => {
        const workspace = ((workspaceRows ?? []) as Array<{
          id: string;
          name: string;
          slug: string;
          type: string | null;
          status: string | null;
        }>).find((row) => row.id === accessRow.workspace_id);

        if (!workspace) {
          return null;
        }

        return {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          type: workspace.type,
          status: workspace.status ?? "active",
          role: normalizeWorkspaceRole(accessRow.role),
        } satisfies WorkspaceSummary;
      })
      .filter(Boolean) as WorkspaceSummary[];

    const currentWorkspace = selectCurrentWorkspace(workspaces);

    if (!currentWorkspace) {
      return NextResponse.json({
        success: true,
        data: {
          ...emptyWorkspaceAccess(NO_WORKSPACE_MESSAGE),
          userWorkspaces: workspaces,
        },
      });
    }

    const [
      { data: moduleRows, error: modulesError },
      { data: roleRows, error: rolesError },
    ] = await Promise.all([
      dataClient
        .from("workspace_modules")
        .select("module_key, is_enabled")
        .eq("workspace_id", currentWorkspace.id),
      dataClient
        .from("module_roles")
        .select("module_key, role")
        .eq("workspace_id", currentWorkspace.id)
        .eq("user_id", user.id),
    ]);

    if (modulesError) {
      throw modulesError;
    }

    if (rolesError) {
      throw rolesError;
    }

    const modules = ((moduleRows ?? []) as Array<{
      module_key: string;
      is_enabled: boolean | null;
    }>)
      .map((row): WorkspaceModuleAccess | null => {
        const moduleKey = normalizeModuleKey(row.module_key);
        return moduleKey
          ? {
              moduleKey,
              isEnabled: row.is_enabled ?? false,
            }
          : null;
      })
      .filter(Boolean) as WorkspaceModuleAccess[];

    const moduleRoles = ((roleRows ?? []) as Array<{
      module_key: string;
      role: string;
    }>)
      .map((row): WorkspaceModuleRole | null => {
        const moduleKey = normalizeModuleKey(row.module_key);
        return moduleKey
          ? {
              moduleKey,
              role: row.role as ModuleRole,
            }
          : null;
      })
      .filter(Boolean) as WorkspaceModuleRole[];

    return NextResponse.json({
      success: true,
      data: {
        currentWorkspace,
        modules,
        moduleRoles,
        isFallbackAccess: false,
        isLoading: false,
        error: null,
        userWorkspaces: workspaces,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Permissões indisponíveis no momento.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 },
    );
  }
}
