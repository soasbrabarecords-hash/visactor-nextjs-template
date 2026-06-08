export const MODULE_KEYS = ["playlist_os", "label_os", "artist_os"] as const;
export const ACCESS_ADMIN_EMAIL = "contato@soasbraba.com";
export const ACCESS_ADMIN_USER_ID = "a4456937-e1af-4e32-91ba-32d66f1f661b";
export const GLOBAL_SPOTIFY_APP_WORKSPACE_SLUG = "so-as-braba-records";
export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export function canUseGlobalSpotifyApp(
  workspace: { slug?: string | null } | null | undefined,
) {
  return workspace?.slug === GLOBAL_SPOTIFY_APP_WORKSPACE_SLUG;
}

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type ModuleRole =
  | "admin"
  | "manager"
  | "financeiro"
  | "artista"
  | "equipe"
  | "curador"
  | "analista"
  | "cliente"
  | "label_manager"
  | "juridico"
  | "viewer";

export const WORKSPACE_ROLE_OPTIONS = ["owner", "admin", "member", "viewer"] as const;
export const WORKSPACE_STATUS_OPTIONS = ["active", "paused", "archived"] as const;
export const WORKSPACE_TYPE_OPTIONS = ["internal", "label", "artist", "agency", "client"] as const;

export const MODULE_ROLE_OPTIONS: Record<ModuleKey, readonly ModuleRole[]> = {
  playlist_os: ["admin", "curador", "analista", "cliente", "viewer"],
  label_os: ["admin", "label_manager", "financeiro", "juridico", "artista", "viewer"],
  artist_os: ["admin", "manager", "financeiro", "artista", "equipe", "viewer"],
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  playlist_os: "Playlist OS",
  label_os: "Label OS",
  artist_os: "Artist OS",
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  status: string;
  role: WorkspaceRole;
};

export type WorkspaceModuleAccess = {
  moduleKey: ModuleKey;
  isEnabled: boolean;
};

export type WorkspaceModuleRole = {
  moduleKey: ModuleKey;
  role: ModuleRole;
};

export type WorkspaceAccessSnapshot = {
  currentWorkspace: WorkspaceSummary | null;
  modules: WorkspaceModuleAccess[];
  moduleRoles: WorkspaceModuleRole[];
  isFallbackAccess: boolean;
};

const MANAGER_ROLES_BY_MODULE: Record<ModuleKey, ModuleRole[]> = {
  playlist_os: ["admin", "curador"],
  label_os: ["admin", "label_manager", "financeiro", "juridico"],
  artist_os: ["admin", "manager", "financeiro"],
};

export function selectCurrentWorkspace<T extends WorkspaceSummary>(
  workspaces: T[],
  preferredWorkspaceId?: string | null,
): T | null {
  const activeWorkspaces = workspaces.filter(
    (workspace) => workspace.status === "active",
  );

  if (activeWorkspaces.length === 0) {
    return null;
  }

  if (preferredWorkspaceId) {
    const preferredWorkspace = activeWorkspaces.find(
      (workspace) => workspace.id === preferredWorkspaceId,
    );

    if (preferredWorkspace) {
      return preferredWorkspace;
    }
  }

  const defaultWorkspace = activeWorkspaces.find(
    (workspace) => workspace.slug === "so-as-braba-records",
  );

  if (defaultWorkspace) {
    return defaultWorkspace;
  }

  if (activeWorkspaces.length === 1) {
    return activeWorkspaces[0];
  }

  return activeWorkspaces[0];
}

export function normalizeModuleKey(value: string): ModuleKey | null {
  return MODULE_KEYS.includes(value as ModuleKey) ? (value as ModuleKey) : null;
}

export function canAccessModule(
  moduleKey: ModuleKey,
  snapshot: WorkspaceAccessSnapshot,
) {
  const moduleAccess = snapshot.modules.find(
    (moduleItem) => moduleItem.moduleKey === moduleKey,
  );

  if (!moduleAccess?.isEnabled) {
    return false;
  }

  if (snapshot.currentWorkspace?.role === "owner" || snapshot.currentWorkspace?.role === "admin") {
    return true;
  }

  return snapshot.moduleRoles.some((role) => role.moduleKey === moduleKey);
}

export function canManageModule(
  moduleKey: ModuleKey,
  snapshot: WorkspaceAccessSnapshot,
) {
  if (snapshot.currentWorkspace?.role === "owner" || snapshot.currentWorkspace?.role === "admin") {
    return true;
  }

  const role = snapshot.moduleRoles.find(
    (moduleRole) => moduleRole.moduleKey === moduleKey,
  )?.role;

  return role ? MANAGER_ROLES_BY_MODULE[moduleKey].includes(role) : false;
}
