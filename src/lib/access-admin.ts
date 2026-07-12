import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ACCESS_ADMIN_EMAIL,
  MODULE_KEYS,
  MODULE_ROLE_OPTIONS,
  type ModuleKey,
  type ModuleRole,
  WORKSPACE_ROLE_OPTIONS,
  WORKSPACE_STATUS_OPTIONS,
  WORKSPACE_TYPE_OPTIONS,
  type WorkspaceRole,
  normalizeModuleKey,
} from "@/lib/workspace-access";

type AccessDbClient = SupabaseClient;

export type AccessWorkspace = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  status: string;
};

export type AccessWorkspaceUser = {
  id: string;
  workspaceId: string;
  userId: string;
  email: string | null;
  role: WorkspaceRole;
  status: string;
};

export type AccessWorkspaceModule = {
  id: string;
  workspaceId: string;
  moduleKey: ModuleKey;
  isEnabled: boolean;
};

export type AccessModuleRole = {
  id: string;
  workspaceId: string;
  userId: string;
  email: string | null;
  moduleKey: ModuleKey;
  role: ModuleRole;
};

export type AccessAdminData = {
  isGlobalAdmin: boolean;
  currentUserEmail: string | null;
  workspaces: AccessWorkspace[];
  workspaceUsers: AccessWorkspaceUser[];
  workspaceModules: AccessWorkspaceModule[];
  moduleRoles: AccessModuleRole[];
  stats: {
    activeWorkspaces: number;
    linkedUsers: number;
    enabledModules: number;
    configuredPermissions: number;
  };
};

type AdminContext = {
  user: User;
  dataClient: AccessDbClient;
  adminClient: AccessDbClient | null;
  isGlobalAdmin: boolean;
  manageableWorkspaceIds: string[];
};

export type AccessWorkspaceUserMutationResult = {
  createdAuthUser: boolean;
  userId: string;
  email: string | null;
  temporaryPassword: string | null;
};

export type InternalAccountMutationResult =
  AccessWorkspaceUserMutationResult & {
    workspaceId: string;
    workspaceName: string;
  };

export class AccessAdminError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
}

function asWorkspaceRole(value: unknown): WorkspaceRole {
  return WORKSPACE_ROLE_OPTIONS.includes(value as WorkspaceRole)
    ? (value as WorkspaceRole)
    : "member";
}

function asWorkspaceStatus(value: unknown) {
  return WORKSPACE_STATUS_OPTIONS.includes(
    value as (typeof WORKSPACE_STATUS_OPTIONS)[number],
  )
    ? (value as (typeof WORKSPACE_STATUS_OPTIONS)[number])
    : "active";
}

function asWorkspaceUserStatus(value: unknown) {
  if (
    value === "active" ||
    value === "inactive" ||
    value === "pending" ||
    value === "removed"
  ) {
    return value;
  }

  return "active";
}

function asWorkspaceType(value: unknown) {
  if (!value || typeof value !== "string") {
    return null;
  }

  return WORKSPACE_TYPE_OPTIONS.includes(
    value as (typeof WORKSPACE_TYPE_OPTIONS)[number],
  )
    ? value
    : null;
}

function asModuleRole(moduleKey: ModuleKey, value: unknown): ModuleRole {
  const options = MODULE_ROLE_OPTIONS[moduleKey];

  if (typeof value === "string" && options.includes(value as ModuleRole)) {
    return value as ModuleRole;
  }

  return "viewer";
}

async function getCurrentAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const dataClient = (adminClient ?? supabase) as AccessDbClient;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AccessAdminError("Sessão indisponível.", 401);
  }

  const isGlobalAdmin = user.email?.toLowerCase() === ACCESS_ADMIN_EMAIL;

  const { data: workspaceUsers } = await dataClient
    .from("workspace_users")
    .select("workspace_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const { data: memberships } = await dataClient
    .from("workspace_memberships")
    .select("workspace_id, role")
    .eq("user_id", user.id);

  const workspaceUserIds = (
    (workspaceUsers ?? []) as Array<{
      workspace_id: string;
      role: string | null;
      status: string | null;
    }>
  )
    .filter((row) => row.role === "owner" || row.role === "admin")
    .map((row) => row.workspace_id);

  const membershipIds = (
    (memberships ?? []) as Array<{
      workspace_id: string;
      role: string | null;
    }>
  )
    .filter((row) => row.role === "owner" || row.role === "admin")
    .map((row) => row.workspace_id);

  const manageableWorkspaceIds = Array.from(
    new Set([...workspaceUserIds, ...membershipIds]),
  );

  if (!isGlobalAdmin && manageableWorkspaceIds.length === 0) {
    throw new AccessAdminError(
      "Você não tem permissão para gerenciar acessos deste workspace.",
      403,
    );
  }

  return {
    user,
    dataClient,
    adminClient: adminClient as AccessDbClient | null,
    isGlobalAdmin,
    manageableWorkspaceIds,
  };
}

async function listAuthUsers(adminClient: AccessDbClient | null) {
  if (!adminClient) {
    return [];
  }

  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    return [];
  }

  return data.users.map((user) => ({
    id: user.id,
    email: user.email ?? null,
  }));
}

async function resolveUserIdByEmail(
  adminClient: AccessDbClient | null,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !adminClient) {
    return null;
  }

  const users = await listAuthUsers(adminClient);
  return (
    users.find((user) => user.email?.toLowerCase() === normalizedEmail)?.id ??
    null
  );
}

function generateTemporaryPassword() {
  return `Sab-${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}!9`;
}

async function resolveOrCreateAuthUserByEmail({
  adminClient,
  email,
  temporaryPassword,
  displayName,
}: {
  adminClient: AccessDbClient | null;
  email: string;
  temporaryPassword?: string | null;
  displayName?: string | null;
}): Promise<AccessWorkspaceUserMutationResult | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  if (!adminClient) {
    throw new AccessAdminError(
      "Para criar ou localizar usuário por e-mail, configure SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const existingUserId = await resolveUserIdByEmail(
    adminClient,
    normalizedEmail,
  );

  if (existingUserId) {
    return {
      createdAuthUser: false,
      userId: existingUserId,
      email: normalizedEmail,
      temporaryPassword: null,
    };
  }

  const password = temporaryPassword?.trim() || generateTemporaryPassword();

  if (password.length < 8) {
    throw new AccessAdminError(
      "A senha temporária precisa ter pelo menos 8 caracteres.",
    );
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      created_from: "so_as_braba_access_management",
      ...(displayName?.trim() ? { full_name: displayName.trim() } : {}),
    },
  });

  if (error || !data.user?.id) {
    throw new AccessAdminError(
      error?.message ?? "Não foi possível criar o usuário no Auth.",
    );
  }

  return {
    createdAuthUser: true,
    userId: data.user.id,
    email: normalizedEmail,
    temporaryPassword: password,
  };
}

function ensureWorkspaceAllowed(context: AdminContext, workspaceId: string) {
  if (context.isGlobalAdmin) {
    return;
  }

  if (!context.manageableWorkspaceIds.includes(workspaceId)) {
    throw new AccessAdminError(
      "Você não tem permissão para gerenciar acessos deste workspace.",
      403,
    );
  }
}

export async function getAccessAdminData(): Promise<AccessAdminData> {
  const context = await getCurrentAdminContext();
  const authUsers = await listAuthUsers(context.adminClient);
  const emailByUserId = new Map(authUsers.map((user) => [user.id, user.email]));

  let workspaceQuery = context.dataClient
    .from("workspaces")
    .select("id, name, slug, type, status")
    .order("created_at", { ascending: true });

  if (!context.isGlobalAdmin) {
    workspaceQuery = workspaceQuery.in("id", context.manageableWorkspaceIds);
  }

  const { data: workspaceRows, error: workspacesError } = await workspaceQuery;

  if (workspacesError) {
    throw new AccessAdminError(workspacesError.message);
  }

  const workspaces = (
    (workspaceRows ?? []) as Array<{
      id: string;
      name: string;
      slug: string;
      type: string | null;
      status: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    status: row.status ?? "active",
  }));

  const workspaceIds = workspaces.map((workspace) => workspace.id);

  if (workspaceIds.length === 0) {
    return {
      isGlobalAdmin: context.isGlobalAdmin,
      currentUserEmail: context.user.email ?? null,
      workspaces: [],
      workspaceUsers: [],
      workspaceModules: [],
      moduleRoles: [],
      stats: {
        activeWorkspaces: 0,
        linkedUsers: 0,
        enabledModules: 0,
        configuredPermissions: 0,
      },
    };
  }

  const [
    { data: userRows, error: usersError },
    { data: moduleRows, error: modulesError },
    { data: roleRows, error: rolesError },
  ] = await Promise.all([
    context.dataClient
      .from("workspace_users")
      .select("id, workspace_id, user_id, role, status")
      .in("workspace_id", workspaceIds)
      .order("created_at", { ascending: true }),
    context.dataClient
      .from("workspace_modules")
      .select("id, workspace_id, module_key, is_enabled")
      .in("workspace_id", workspaceIds)
      .order("module_key", { ascending: true }),
    context.dataClient
      .from("module_roles")
      .select("id, workspace_id, user_id, module_key, role")
      .in("workspace_id", workspaceIds)
      .order("module_key", { ascending: true }),
  ]);

  if (usersError) {
    throw new AccessAdminError(usersError.message);
  }

  if (modulesError) {
    throw new AccessAdminError(modulesError.message);
  }

  if (rolesError) {
    throw new AccessAdminError(rolesError.message);
  }

  const workspaceUsers = (
    (userRows ?? []) as Array<{
      id: string;
      workspace_id: string;
      user_id: string;
      role: string | null;
      status: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    email: emailByUserId.get(row.user_id) ?? null,
    role: asWorkspaceRole(row.role),
    status: row.status ?? "active",
  }));

  const workspaceModules = (
    (moduleRows ?? []) as Array<{
      id: string;
      workspace_id: string;
      module_key: string;
      is_enabled: boolean | null;
    }>
  )
    .map((row): AccessWorkspaceModule | null => {
      const moduleKey = normalizeModuleKey(row.module_key);

      return moduleKey
        ? {
            id: row.id,
            workspaceId: row.workspace_id,
            moduleKey,
            isEnabled: row.is_enabled ?? false,
          }
        : null;
    })
    .filter(Boolean) as AccessWorkspaceModule[];

  const moduleRoles = (
    (roleRows ?? []) as Array<{
      id: string;
      workspace_id: string;
      user_id: string;
      module_key: string;
      role: string;
    }>
  )
    .map((row): AccessModuleRole | null => {
      const moduleKey = normalizeModuleKey(row.module_key);

      return moduleKey
        ? {
            id: row.id,
            workspaceId: row.workspace_id,
            userId: row.user_id,
            email: emailByUserId.get(row.user_id) ?? null,
            moduleKey,
            role: asModuleRole(moduleKey, row.role),
          }
        : null;
    })
    .filter(Boolean) as AccessModuleRole[];

  return {
    isGlobalAdmin: context.isGlobalAdmin,
    currentUserEmail: context.user.email ?? null,
    workspaces,
    workspaceUsers,
    workspaceModules,
    moduleRoles,
    stats: {
      activeWorkspaces: workspaces.filter(
        (workspace) => workspace.status === "active",
      ).length,
      linkedUsers: workspaceUsers.length,
      enabledModules: workspaceModules.filter(
        (moduleItem) => moduleItem.isEnabled,
      ).length,
      configuredPermissions: moduleRoles.length,
    },
  };
}

async function ensureWorkspaceDefaults(
  client: AccessDbClient,
  workspaceId: string,
) {
  await Promise.all([
    client.from("workspace_settings").upsert(
      {
        workspace_id: workspaceId,
      },
      { onConflict: "workspace_id" },
    ),
    client.from("workspace_integrations").upsert(
      {
        workspace_id: workspaceId,
        provider: "spotify",
        app_mode: "workspace_app",
        connection_status: "not_connected",
      },
      { onConflict: "workspace_id,provider", ignoreDuplicates: true },
    ),
    client.from("workspace_integrations").upsert(
      {
        workspace_id: workspaceId,
        provider: "openai",
        app_mode: "global_app",
        connection_status: "not_connected",
      },
      { onConflict: "workspace_id,provider", ignoreDuplicates: true },
    ),
  ]);
}

export async function upsertAccessWorkspace(input: {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  type?: string | null;
  status?: string | null;
}) {
  const context = await getCurrentAdminContext();
  const name = input.name?.trim();

  if (!name) {
    throw new AccessAdminError("Informe o nome do workspace.");
  }

  const slug = slugify(input.slug?.trim() || name);

  if (!slug) {
    throw new AccessAdminError("Informe um slug válido.");
  }

  const payload = {
    name,
    slug,
    type: asWorkspaceType(input.type),
    status: asWorkspaceStatus(input.status),
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    ensureWorkspaceAllowed(context, input.id);

    const { error } = await context.dataClient
      .from("workspaces")
      .update(payload)
      .eq("id", input.id);

    if (error) {
      throw new AccessAdminError(error.message);
    }

    return;
  }

  throw new AccessAdminError(
    "Novos workspaces são criados junto com a conta na Administração global.",
    403,
  );
}

export async function createInternalAccount(input: {
  displayName?: string | null;
  email?: string | null;
  temporaryPassword?: string | null;
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  workspaceType?: string | null;
  enabledModules?: string[] | null;
}): Promise<InternalAccountMutationResult> {
  const context = await getCurrentAdminContext();

  if (!context.isGlobalAdmin) {
    throw new AccessAdminError(
      "Somente o administrador global pode criar novas contas.",
      403,
    );
  }

  const displayName = input.displayName?.trim();
  const workspaceName = input.workspaceName?.trim();
  const email = input.email?.trim().toLowerCase();

  if (!displayName || !workspaceName || !email) {
    throw new AccessAdminError(
      "Nome, e-mail e nome do workspace são obrigatórios.",
    );
  }

  const workspaceSlug = slugify(input.workspaceSlug?.trim() || workspaceName);

  if (!workspaceSlug) {
    throw new AccessAdminError("Informe um slug válido para o workspace.");
  }

  const { data: existingWorkspace, error: workspaceLookupError } =
    await context.dataClient
      .from("workspaces")
      .select("id")
      .eq("slug", workspaceSlug)
      .maybeSingle();

  if (workspaceLookupError) {
    throw new AccessAdminError(workspaceLookupError.message);
  }

  if (existingWorkspace) {
    throw new AccessAdminError("Este slug já está em uso por outro workspace.");
  }

  const authUser = await resolveOrCreateAuthUserByEmail({
    adminClient: context.adminClient,
    email,
    temporaryPassword: input.temporaryPassword,
    displayName,
  });

  if (!authUser) {
    throw new AccessAdminError("Não foi possível criar a conta de acesso.");
  }

  const workspaceId = crypto.randomUUID();
  const enabledModules = new Set(
    (input.enabledModules ?? [])
      .map((moduleKey) => normalizeModuleKey(moduleKey))
      .filter(Boolean) as ModuleKey[],
  );
  const { error: workspaceError } = await context.dataClient
    .from("workspaces")
    .insert({
      id: workspaceId,
      name: workspaceName,
      slug: workspaceSlug,
      type: asWorkspaceType(input.workspaceType),
      status: "active",
      owner_user_id: authUser.userId,
      updated_at: new Date().toISOString(),
    });

  if (workspaceError) {
    throw new AccessAdminError(workspaceError.message);
  }

  const [
    { error: userError },
    { error: membershipError },
    { error: modulesError },
  ] = await Promise.all([
    context.dataClient.from("workspace_users").upsert(
      {
        workspace_id: workspaceId,
        user_id: authUser.userId,
        role: "owner",
        status: "active",
      },
      { onConflict: "workspace_id,user_id" },
    ),
    context.dataClient.from("workspace_memberships").upsert(
      {
        workspace_id: workspaceId,
        user_id: authUser.userId,
        role: "owner",
      },
      { onConflict: "workspace_id,user_id" },
    ),
    context.dataClient.from("workspace_modules").upsert(
      MODULE_KEYS.map((moduleKey) => ({
        workspace_id: workspaceId,
        module_key: moduleKey,
        is_enabled: enabledModules.has(moduleKey),
      })),
      { onConflict: "workspace_id,module_key" },
    ),
  ]);

  const setupError = userError ?? membershipError ?? modulesError;

  if (setupError) {
    throw new AccessAdminError(
      `A conta foi criada, mas a configuração do workspace falhou: ${setupError.message}`,
    );
  }

  await ensureWorkspaceDefaults(context.dataClient, workspaceId);

  return {
    ...authUser,
    workspaceId,
    workspaceName,
  };
}

export async function upsertAccessWorkspaceUser(input: {
  workspaceId?: string | null;
  userId?: string | null;
  email?: string | null;
  temporaryPassword?: string | null;
  role?: string | null;
  status?: string | null;
}): Promise<AccessWorkspaceUserMutationResult> {
  const context = await getCurrentAdminContext();
  const workspaceId = input.workspaceId?.trim();

  if (!workspaceId) {
    throw new AccessAdminError("Selecione um workspace.");
  }

  ensureWorkspaceAllowed(context, workspaceId);

  const emailResult =
    !input.userId?.trim() && input.email
      ? await resolveOrCreateAuthUserByEmail({
          adminClient: context.adminClient,
          email: input.email,
          temporaryPassword: input.temporaryPassword,
        })
      : null;
  const resolvedUserId = input.userId?.trim() || emailResult?.userId || null;

  if (!resolvedUserId) {
    throw new AccessAdminError(
      "Informe um user_id válido ou um e-mail para criar/vincular a conta.",
    );
  }

  const role = asWorkspaceRole(input.role);
  const status = asWorkspaceUserStatus(input.status);
  const membershipRole =
    role === "owner" || role === "admin" || role === "viewer" ? role : "editor";

  const { error } = await context.dataClient.from("workspace_users").upsert(
    {
      workspace_id: workspaceId,
      user_id: resolvedUserId,
      role,
      status,
    },
    { onConflict: "workspace_id,user_id" },
  );

  if (error) {
    throw new AccessAdminError(error.message);
  }

  await context.dataClient.from("workspace_memberships").upsert(
    {
      workspace_id: workspaceId,
      user_id: resolvedUserId,
      role: membershipRole,
    },
    { onConflict: "workspace_id,user_id" },
  );

  return (
    emailResult ?? {
      createdAuthUser: false,
      userId: resolvedUserId,
      email: input.email?.trim().toLowerCase() || null,
      temporaryPassword: null,
    }
  );
}

export async function removeAccessWorkspaceUser(input: {
  workspaceId?: string | null;
  userId?: string | null;
}) {
  const context = await getCurrentAdminContext();
  const workspaceId = input.workspaceId?.trim();
  const userId = input.userId?.trim();

  if (!workspaceId || !userId) {
    throw new AccessAdminError("Workspace e usuário são obrigatórios.");
  }

  ensureWorkspaceAllowed(context, workspaceId);

  await context.dataClient
    .from("module_roles")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  await context.dataClient
    .from("workspace_users")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  await context.dataClient
    .from("workspace_memberships")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
}

export async function updateAccessWorkspaceModules(input: {
  workspaceId?: string | null;
  modules?: Array<{ moduleKey?: string; isEnabled?: boolean }>;
}) {
  const context = await getCurrentAdminContext();
  const workspaceId = input.workspaceId?.trim();

  if (!workspaceId) {
    throw new AccessAdminError("Selecione um workspace.");
  }

  ensureWorkspaceAllowed(context, workspaceId);

  const modules = (input.modules ?? [])
    .map((moduleItem) => {
      const moduleKey = moduleItem.moduleKey
        ? normalizeModuleKey(moduleItem.moduleKey)
        : null;

      return moduleKey
        ? {
            workspace_id: workspaceId,
            module_key: moduleKey,
            is_enabled: Boolean(moduleItem.isEnabled),
            updated_at: new Date().toISOString(),
          }
        : null;
    })
    .filter(Boolean) as Array<{
    workspace_id: string;
    module_key: ModuleKey;
    is_enabled: boolean;
    updated_at: string;
  }>;

  if (modules.length === 0) {
    throw new AccessAdminError("Selecione ao menos um módulo.");
  }

  const { error } = await context.dataClient
    .from("workspace_modules")
    .upsert(modules, { onConflict: "workspace_id,module_key" });

  if (error) {
    throw new AccessAdminError(error.message);
  }

  const disabledModuleKeys = modules
    .filter((moduleItem) => !moduleItem.is_enabled)
    .map((moduleItem) => moduleItem.module_key);

  if (disabledModuleKeys.length > 0) {
    await context.dataClient
      .from("module_roles")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("module_key", disabledModuleKeys);
  }
}

export async function updateAccessModuleRoles(input: {
  workspaceId?: string | null;
  userId?: string | null;
  roles?: Array<{ moduleKey?: string; role?: string }>;
}) {
  const context = await getCurrentAdminContext();
  const workspaceId = input.workspaceId?.trim();
  const userId = input.userId?.trim();

  if (!workspaceId || !userId) {
    throw new AccessAdminError("Workspace e usuário são obrigatórios.");
  }

  ensureWorkspaceAllowed(context, workspaceId);

  const { data: activeModuleRows, error: modulesError } =
    await context.dataClient
      .from("workspace_modules")
      .select("module_key, is_enabled")
      .eq("workspace_id", workspaceId)
      .eq("is_enabled", true);

  if (modulesError) {
    throw new AccessAdminError(modulesError.message);
  }

  const activeModuleKeys = new Set(
    ((activeModuleRows ?? []) as Array<{ module_key: string }>)
      .map((row) => normalizeModuleKey(row.module_key))
      .filter(Boolean) as ModuleKey[],
  );

  const roles = (input.roles ?? [])
    .map((roleItem) => {
      const moduleKey = roleItem.moduleKey
        ? normalizeModuleKey(roleItem.moduleKey)
        : null;

      if (!moduleKey) {
        return null;
      }

      if (!activeModuleKeys.has(moduleKey)) {
        throw new AccessAdminError(
          "Não é possível configurar role de módulo inativo.",
        );
      }

      return {
        workspace_id: workspaceId,
        user_id: userId,
        module_key: moduleKey,
        role: asModuleRole(moduleKey, roleItem.role),
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as Array<{
    workspace_id: string;
    user_id: string;
    module_key: ModuleKey;
    role: ModuleRole;
    updated_at: string;
  }>;

  if (roles.length === 0) {
    throw new AccessAdminError("Nenhuma permissão selecionada.");
  }

  const { error } = await context.dataClient
    .from("module_roles")
    .upsert(roles, { onConflict: "workspace_id,user_id,module_key" });

  if (error) {
    throw new AccessAdminError(error.message);
  }
}
