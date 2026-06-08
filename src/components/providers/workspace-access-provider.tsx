"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  canAccessModule as canAccessModuleFromSnapshot,
  canManageModule as canManageModuleFromSnapshot,
  type ModuleKey,
  type WorkspaceAccessSnapshot,
  type WorkspaceSummary,
} from "@/lib/workspace-access";

type WorkspaceAccessContextValue = WorkspaceAccessSnapshot & {
  isLoading: boolean;
  error: string | null;
  currentUserEmail: string | null;
  userWorkspaces: WorkspaceSummary[];
  canAccessModule: (moduleKey: ModuleKey) => boolean;
  canManageModule: (moduleKey: ModuleKey) => boolean;
  refreshWorkspaceAccess: () => Promise<void>;
};

const WorkspaceAccessContext = createContext<WorkspaceAccessContextValue | null>(
  null,
);

function buildBlockedState(error: string | null = null): WorkspaceAccessContextValue {
  const snapshot: WorkspaceAccessSnapshot = {
    currentWorkspace: null,
    modules: [],
    moduleRoles: [],
    isFallbackAccess: false,
  };

  return {
    ...snapshot,
    isLoading: false,
    error,
    currentUserEmail: null,
    userWorkspaces: [],
    canAccessModule: (moduleKey) => canAccessModuleFromSnapshot(moduleKey, snapshot),
    canManageModule: (moduleKey) => canManageModuleFromSnapshot(moduleKey, snapshot),
    refreshWorkspaceAccess: async () => {},
  };
}

async function fetchWorkspaceAccess(): Promise<
  Omit<
    WorkspaceAccessContextValue,
    "canAccessModule" | "canManageModule" | "refreshWorkspaceAccess"
  >
> {
  const response = await fetch("/api/workspace/access", {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: Omit<
      WorkspaceAccessContextValue,
      "canAccessModule" | "canManageModule" | "refreshWorkspaceAccess"
    >;
    message?: string;
  } | null;

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.message ?? "Permissões indisponíveis no momento.");
  }

  return payload.data;
}

export function WorkspaceAccessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    Omit<
      WorkspaceAccessContextValue,
      "canAccessModule" | "canManageModule" | "refreshWorkspaceAccess"
    >
  >({
    currentWorkspace: null,
    modules: [],
    moduleRoles: [],
    isFallbackAccess: false,
    isLoading: true,
    error: null,
    currentUserEmail: null,
    userWorkspaces: [],
  });

  const refreshWorkspaceAccess = useCallback(async () => {
    const nextState = await fetchWorkspaceAccess();
    setState(nextState);
  }, []);

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

        setState(buildBlockedState(message));
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
      refreshWorkspaceAccess,
    };
  }, [refreshWorkspaceAccess, state]);

  return (
    <WorkspaceAccessContext.Provider value={value}>
      {children}
    </WorkspaceAccessContext.Provider>
  );
}

export function useWorkspaceAccess() {
  const context = useContext(WorkspaceAccessContext);

  if (!context) {
    return buildBlockedState("WorkspaceAccessProvider não foi inicializado.");
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
