"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_MODULES,
  DEFAULT_MODULE_ROLES,
  DEFAULT_WORKSPACE,
  MODULE_KEYS,
  canAccessModule as canAccessModuleFromSnapshot,
  canManageModule as canManageModuleFromSnapshot,
  normalizeModuleKey,
  type ModuleKey,
  type ModuleRole,
  type WorkspaceAccessSnapshot,
  type WorkspaceModuleAccess,
  type WorkspaceModuleRole,
  type WorkspaceRole,
  type WorkspaceSummary,
} from "@/lib/workspace-access";

type WorkspaceAccessContextValue = WorkspaceAccessSnapshot & {
  isLoading: boolean;
  error: string | null;
  userWorkspaces: WorkspaceSummary[];
  canAccessModule: (moduleKey: ModuleKey) => boolean;
  canManageModule: (moduleKey: ModuleKey) => boolean;
};

const WorkspaceAccessContext = createContext<WorkspaceAccessContextValue | null>(
  null,
);

function normalizeWorkspaceRole(role: string | null | undefined): WorkspaceRole {
  if (role === "owner" || role === "admin" || role === "viewer") {
    return role;
  }

  return "member";
}

function buildFallbackState(error: string | null = null): WorkspaceAccessContextValue {
  const snapshot: WorkspaceAccessSnapshot = {
    currentWorkspace: DEFAULT_WORKSPACE,
    modules: DEFAULT_MODULES,
    moduleRoles: DEFAULT_MODULE_ROLES,
    isFallbackAccess: true,
  };

  return {
    ...snapshot,
    isLoading: false,
    error,
    userWorkspaces: [DEFAULT_WORKSPACE],
    canAccessModule: (moduleKey) => canAccessModuleFromSnapshot(moduleKey, snapshot),
    canManageModule: (moduleKey) => canManageModuleFromSnapshot(moduleKey, snapshot),
  };
}

async function fetchWorkspaceAccess(): Promise<
  Omit<WorkspaceAccessContextValue, "canAccessModule" | "canManageModule">
> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return {
      currentWorkspace: null,
      modules: [],
      moduleRoles: [],
      isFallbackAccess: false,
      isLoading: false,
      error: null,
      userWorkspaces: [],
    };
  }

  const { data: accessRows, error: accessError } = await supabase
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
    const { data: membershipRows } = await supabase
      .from("workspace_memberships")
      .select("workspace_id, role, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    workspaceAccessRows = ((membershipRows ?? []) as Array<{
      workspace_id: string;
      role: string | null;
    }>).map((row) => ({
      workspace_id: row.workspace_id,
      role: normalizeWorkspaceRole(row.role),
    }));
  }

  if (workspaceAccessRows.length === 0) {
    return {
      currentWorkspace: DEFAULT_WORKSPACE,
      modules: DEFAULT_MODULES,
      moduleRoles: DEFAULT_MODULE_ROLES,
      isFallbackAccess: true,
      isLoading: false,
      error: null,
      userWorkspaces: [DEFAULT_WORKSPACE],
    };
  }

  const workspaceIds = workspaceAccessRows.map((row) => row.workspace_id);
  const { data: workspaceRows, error: workspacesError } = await supabase
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

  const currentWorkspace = workspaces[0] ?? DEFAULT_WORKSPACE;

  const [{ data: moduleRows, error: modulesError }, { data: roleRows, error: rolesError }] =
    await Promise.all([
      supabase
        .from("workspace_modules")
        .select("module_key, is_enabled")
        .eq("workspace_id", currentWorkspace.id),
      supabase
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

  const isFallbackAccess = modules.length === 0;

  return {
    currentWorkspace,
    modules: isFallbackAccess ? DEFAULT_MODULES : modules,
    moduleRoles: isFallbackAccess ? DEFAULT_MODULE_ROLES : moduleRoles,
    isFallbackAccess,
    isLoading: false,
    error: null,
    userWorkspaces: workspaces.length > 0 ? workspaces : [DEFAULT_WORKSPACE],
  };
}

export function WorkspaceAccessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    Omit<WorkspaceAccessContextValue, "canAccessModule" | "canManageModule">
  >({
    currentWorkspace: null,
    modules: MODULE_KEYS.map((moduleKey) => ({ moduleKey, isEnabled: true })),
    moduleRoles: [],
    isFallbackAccess: true,
    isLoading: true,
    error: null,
    userWorkspaces: [],
  });

  useEffect(() => {
    let isMounted = true;

    fetchWorkspaceAccess()
      .then((nextState) => {
        if (isMounted) {
          setState(nextState);
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Permissões indisponíveis no momento.";

        setState(buildFallbackState(message));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<WorkspaceAccessContextValue>(() => {
    const snapshot: WorkspaceAccessSnapshot = {
      currentWorkspace: state.currentWorkspace,
      modules: state.modules,
      moduleRoles: state.moduleRoles,
      isFallbackAccess: state.isFallbackAccess,
    };

    return {
      ...state,
      canAccessModule: (moduleKey) =>
        canAccessModuleFromSnapshot(moduleKey, snapshot),
      canManageModule: (moduleKey) =>
        canManageModuleFromSnapshot(moduleKey, snapshot),
    };
  }, [state]);

  return (
    <WorkspaceAccessContext.Provider value={value}>
      {children}
    </WorkspaceAccessContext.Provider>
  );
}

export function useWorkspaceAccess() {
  const context = useContext(WorkspaceAccessContext);

  if (!context) {
    return buildFallbackState("WorkspaceAccessProvider não foi inicializado.");
  }

  return context;
}

export function useCurrentWorkspace() {
  return useWorkspaceAccess().currentWorkspace;
}

export function useUserWorkspaces() {
  return useWorkspaceAccess().userWorkspaces;
}

export function useWorkspaceModules() {
  return useWorkspaceAccess().modules;
}

export function useModuleAccess(moduleKey: ModuleKey) {
  return useWorkspaceAccess().canAccessModule(moduleKey);
}

export function useModuleManageAccess(moduleKey: ModuleKey) {
  return useWorkspaceAccess().canManageModule(moduleKey);
}

export function useModuleRole(moduleKey: ModuleKey) {
  return (
    useWorkspaceAccess().moduleRoles.find(
      (moduleRole) => moduleRole.moduleKey === moduleKey,
    )?.role ?? null
  );
}

export {
  canAccessModuleFromSnapshot as canAccessModule,
  canManageModuleFromSnapshot as canManageModule,
};
