"use client";

import {
  BriefcaseBusiness,
  CheckCircle2,
  Layers3,
  LockKeyhole,
  PencilLine,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/workspace/status-badge";
import { cn } from "@/lib/utils";
import {
  MODULE_KEYS,
  MODULE_LABELS,
  MODULE_ROLE_OPTIONS,
  type ModuleKey,
  WORKSPACE_ROLE_OPTIONS,
  WORKSPACE_STATUS_OPTIONS,
  WORKSPACE_TYPE_OPTIONS,
} from "@/lib/workspace-access";

type AccessWorkspace = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  status: string;
};

type AccessWorkspaceUser = {
  id: string;
  workspaceId: string;
  userId: string;
  email: string | null;
  role: string;
  status: string;
};

type AccessWorkspaceModule = {
  id: string;
  workspaceId: string;
  moduleKey: ModuleKey;
  isEnabled: boolean;
};

type AccessModuleRole = {
  id: string;
  workspaceId: string;
  userId: string;
  email: string | null;
  moduleKey: ModuleKey;
  role: string;
};

type AccessAdminData = {
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

type AccessApiResponse = {
  success: boolean;
  message?: string;
  data?: AccessAdminData;
  mutation?: {
    createdAuthUser: boolean;
    userId: string;
    email: string | null;
    temporaryPassword: string | null;
    workspaceId?: string;
    workspaceName?: string;
  } | null;
};

type AccessTab =
  "overview" | "accounts" | "workspaces" | "users" | "modules" | "permissions";

const tabs: Array<{ key: AccessTab; label: string; href: string }> = [
  { key: "overview", label: "Resumo", href: "/settings/access" },
  {
    key: "accounts",
    label: "Criar conta",
    href: "/settings/access/accounts",
  },
  {
    key: "workspaces",
    label: "Workspaces",
    href: "/settings/access/workspaces",
  },
  { key: "users", label: "Usuários", href: "/settings/access/users" },
  { key: "modules", label: "Módulos", href: "/settings/access/modules" },
  {
    key: "permissions",
    label: "Permissões",
    href: "/settings/access/permissions",
  },
];
const WORKSPACE_USER_STATUS_OPTIONS = [
  "active",
  "pending",
  "inactive",
  "removed",
] as const;
const EMPTY_USER_FORM = {
  workspaceId: "",
  userId: "",
  email: "",
  temporaryPassword: "",
  role: "member",
  status: "active",
};
const EMPTY_ACCOUNT_FORM = {
  displayName: "",
  email: "",
  temporaryPassword: "",
  workspaceName: "",
  workspaceSlug: "",
  workspaceType: "client",
};

function getWorkspaceName(data: AccessAdminData | null, workspaceId: string) {
  return (
    data?.workspaces.find((workspace) => workspace.id === workspaceId)?.name ??
    "Workspace"
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring/30"
    >
      {children}
    </select>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "green" | "blue" | "yellow" | "slate";
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground">
          {icon}
        </span>
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
        {value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export default function AccessManagementPanel({
  initialTab = "overview",
}: {
  initialTab?: AccessTab;
}) {
  const [data, setData] = useState<AccessAdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdCredential, setCreatedCredential] = useState<{
    email: string;
    userId: string;
    temporaryPassword: string;
    workspaceName?: string;
  } | null>(null);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [accountModules, setAccountModules] = useState<
    Record<ModuleKey, boolean>
  >({
    playlist_os: true,
    label_os: false,
    artist_os: false,
  });
  const [workspaceForm, setWorkspaceForm] = useState({
    id: "",
    name: "",
    slug: "",
    type: "internal",
    status: "active",
  });
  const [userForm, setUserForm] = useState({
    ...EMPTY_USER_FORM,
  });
  const [editingWorkspaceUserId, setEditingWorkspaceUserId] = useState<
    string | null
  >(null);
  const [moduleWorkspaceId, setModuleWorkspaceId] = useState("");
  const [moduleDraft, setModuleDraft] = useState<Record<ModuleKey, boolean>>({
    playlist_os: true,
    label_os: true,
    artist_os: true,
  });
  const [permissionWorkspaceId, setPermissionWorkspaceId] = useState("");
  const [permissionUserId, setPermissionUserId] = useState("");
  const [permissionDraft, setPermissionDraft] = useState<
    Record<ModuleKey, string>
  >({
    playlist_os: "viewer",
    label_os: "viewer",
    artist_os: "viewer",
  });

  async function loadAccessData() {
    setIsLoading(true);
    setError(null);

    const response = await fetch("/api/settings/access", {
      cache: "no-store",
    });
    const payload = (await response.json()) as AccessApiResponse;

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message ?? "Nao foi possivel carregar acessos.");
    }

    setData(payload.data);
  }

  async function runAction(body: Record<string, unknown>, message: string) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    setCreatedCredential(null);

    try {
      const response = await fetch("/api/settings/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as AccessApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message ?? "Nao foi possivel salvar.");
      }

      setData(payload.data);
      setSuccess(message);
      if (
        payload.mutation?.createdAuthUser &&
        payload.mutation.email &&
        payload.mutation.temporaryPassword
      ) {
        setCreatedCredential({
          email: payload.mutation.email,
          userId: payload.mutation.userId,
          temporaryPassword: payload.mutation.temporaryPassword,
          workspaceName: payload.mutation.workspaceName,
        });
      }
      return true;
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Nao foi possivel salvar.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function resetUserForm(workspaceId = userForm.workspaceId) {
    setEditingWorkspaceUserId(null);
    setUserForm({
      ...EMPTY_USER_FORM,
      workspaceId,
    });
  }

  function editWorkspaceUser(user: AccessWorkspaceUser) {
    setError(null);
    setSuccess(null);
    setCreatedCredential(null);
    setEditingWorkspaceUserId(user.id);
    setUserForm({
      workspaceId: user.workspaceId,
      userId: user.userId,
      email: user.email ?? "",
      temporaryPassword: "",
      role: user.role,
      status: user.status,
    });
  }

  useEffect(() => {
    loadAccessData()
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar acessos.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!data || data.workspaces.length === 0) {
      return;
    }

    const firstWorkspaceId = data.workspaces[0].id;

    setUserForm((current) => ({
      ...current,
      workspaceId: current.workspaceId || firstWorkspaceId,
    }));
    setModuleWorkspaceId((current) => current || firstWorkspaceId);
    setPermissionWorkspaceId((current) => current || firstWorkspaceId);
  }, [data]);

  useEffect(() => {
    if (!data || !moduleWorkspaceId) {
      return;
    }

    setModuleDraft(
      MODULE_KEYS.reduce(
        (draft, moduleKey) => ({
          ...draft,
          [moduleKey]: Boolean(
            data.workspaceModules.find(
              (moduleItem) =>
                moduleItem.workspaceId === moduleWorkspaceId &&
                moduleItem.moduleKey === moduleKey,
            )?.isEnabled,
          ),
        }),
        {} as Record<ModuleKey, boolean>,
      ),
    );
  }, [data, moduleWorkspaceId]);

  useEffect(() => {
    if (!data || !permissionWorkspaceId || !permissionUserId) {
      return;
    }

    setPermissionDraft(
      MODULE_KEYS.reduce(
        (draft, moduleKey) => ({
          ...draft,
          [moduleKey]:
            data.moduleRoles.find(
              (role) =>
                role.workspaceId === permissionWorkspaceId &&
                role.userId === permissionUserId &&
                role.moduleKey === moduleKey,
            )?.role ?? MODULE_ROLE_OPTIONS[moduleKey][0],
        }),
        {} as Record<ModuleKey, string>,
      ),
    );
  }, [data, permissionWorkspaceId, permissionUserId]);

  const selectedWorkspaceUsers = useMemo(
    () =>
      data?.workspaceUsers.filter(
        (user) => user.workspaceId === userForm.workspaceId,
      ) ?? [],
    [data, userForm.workspaceId],
  );

  const permissionWorkspaceUsers = useMemo(
    () =>
      data?.workspaceUsers.filter(
        (user) => user.workspaceId === permissionWorkspaceId,
      ) ?? [],
    [data, permissionWorkspaceId],
  );

  const activePermissionModules = useMemo(
    () =>
      MODULE_KEYS.filter((moduleKey) =>
        data?.workspaceModules.some(
          (moduleItem) =>
            moduleItem.workspaceId === permissionWorkspaceId &&
            moduleItem.moduleKey === moduleKey &&
            moduleItem.isEnabled,
        ),
      ),
    [data, permissionWorkspaceId],
  );

  useEffect(() => {
    if (!permissionUserId && permissionWorkspaceUsers.length > 0) {
      setPermissionUserId(permissionWorkspaceUsers[0].userId);
    }
  }, [permissionUserId, permissionWorkspaceUsers]);

  if (isLoading) {
    return (
      <Container className="py-6">
        <div className="h-[520px] animate-pulse rounded-[34px] border border-white/10 bg-white/[0.04]" />
      </Container>
    );
  }

  if (error && !data) {
    return (
      <Container className="py-6">
        <section className="rounded-[34px] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(15,23,42,0.94))] p-8 text-white">
          <div className="bg-amber-300/12 mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-amber-100 ring-1 ring-inset ring-amber-200/15">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            Acesso negado
          </h1>
          <p className="text-white/64 mt-3 max-w-xl text-sm leading-6">
            {error ||
              "Você não tem permissão para gerenciar acessos deste workspace."}
          </p>
        </section>
      </Container>
    );
  }

  if (
    !isLoading &&
    data &&
    !data.isGlobalAdmin &&
    (initialTab === "workspaces" || initialTab === "accounts")
  ) {
    return (
      <Container className="py-6">
        <section className="rounded-[28px] border border-white/10 bg-slate-950 p-8 text-white">
          <LockKeyhole className="h-5 w-5 text-white/50" />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">
            Administração global restrita
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
            Criação de contas e edição de workspaces estão disponíveis somente
            para o administrador global. Você continua podendo gerenciar a
            equipe do seu workspace.
          </p>
          <Link
            href="/settings/access/users"
            className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Gerenciar equipe
          </Link>
        </section>
      </Container>
    );
  }

  const visibleTabs = data?.isGlobalAdmin
    ? tabs
    : tabs
        .filter((tab) => tab.key !== "workspaces" && tab.key !== "accounts")
        .map((tab) =>
          tab.key === "users" ? { ...tab, label: "Equipe" } : tab,
        );

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background">
      <Container className="max-w-6xl py-5">
        <section className="border-b border-border/70 pb-5 text-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="blue">Configurações</StatusBadge>
            <StatusBadge tone={data?.isGlobalAdmin ? "green" : "yellow"}>
              {data?.isGlobalAdmin ? "Admin global" : "Equipe do workspace"}
            </StatusBadge>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.035em]">
                {data?.isGlobalAdmin
                  ? "Administração global"
                  : "Equipe do workspace"}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                {data?.isGlobalAdmin
                  ? "Crie workspaces e controle usuários, módulos e permissões."
                  : "Gerencie usuários, módulos e permissões apenas do workspace atual."}
              </p>
            </div>
            <div className="rounded-full border border-border bg-card px-3.5 py-2 text-xs text-muted-foreground shadow-sm">
              Admin: {data?.currentUserEmail ?? "sessão atual"}
            </div>
          </div>
        </section>

        <nav className="mt-4 flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                tab.key === initialTab
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {success}
          </div>
        ) : null}
        {createdCredential ? (
          <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-foreground">
            <div className="font-semibold">Conta criada no Auth</div>
            <div className="mt-2 grid gap-1 text-muted-foreground">
              <span>E-mail: {createdCredential.email}</span>
              <span>User ID: {createdCredential.userId}</span>
              {createdCredential.workspaceName ? (
                <span>Workspace: {createdCredential.workspaceName}</span>
              ) : null}
              <span>
                Senha temporária:{" "}
                <code className="rounded-md bg-muted px-2 py-1 text-foreground">
                  {createdCredential.temporaryPassword}
                </code>
              </span>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {initialTab === "overview" ? (
          <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<BriefcaseBusiness className="h-5 w-5" />}
              label="Workspaces ativos"
              value={data?.stats.activeWorkspaces ?? 0}
              tone="green"
            />
            <StatCard
              icon={<UsersRound className="h-5 w-5" />}
              label="Usuários vinculados"
              value={data?.stats.linkedUsers ?? 0}
              tone="blue"
            />
            <StatCard
              icon={<Layers3 className="h-5 w-5" />}
              label="Módulos ativos"
              value={data?.stats.enabledModules ?? 0}
              tone="yellow"
            />
            <StatCard
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Permissões"
              value={data?.stats.configuredPermissions ?? 0}
              tone="slate"
            />
          </section>
        ) : null}

        {initialTab === "accounts" && data?.isGlobalAdmin ? (
          <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-sm">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                <UserPlus className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Nova conta interna</h2>
                <p className="text-xs text-muted-foreground">
                  Cria o login, o workspace próprio e os módulos iniciais.
                </p>
              </div>
            </div>
            <form
              className="p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction(
                  {
                    action: "create_account",
                    account: {
                      ...accountForm,
                      enabledModules: MODULE_KEYS.filter(
                        (moduleKey) => accountModules[moduleKey],
                      ),
                    },
                  },
                  "Conta e workspace criados.",
                ).then((saved) => {
                  if (saved) {
                    setAccountForm(EMPTY_ACCOUNT_FORM);
                  }
                });
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Nome do usuário
                  </span>
                  <Input
                    required
                    value={accountForm.displayName}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Nome completo"
                    className="h-10 rounded-xl"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    E-mail de acesso
                  </span>
                  <Input
                    required
                    type="email"
                    value={accountForm.email}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="usuario@empresa.com"
                    className="h-10 rounded-xl"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Senha temporária
                  </span>
                  <Input
                    type="password"
                    minLength={8}
                    value={accountForm.temporaryPassword}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        temporaryPassword: event.target.value,
                      }))
                    }
                    placeholder="Gerada automaticamente se vazio"
                    className="h-10 rounded-xl"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Nome do workspace
                  </span>
                  <Input
                    required
                    value={accountForm.workspaceName}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        workspaceName: event.target.value,
                      }))
                    }
                    placeholder="Empresa ou projeto"
                    className="h-10 rounded-xl"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Slug opcional
                  </span>
                  <Input
                    value={accountForm.workspaceSlug}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        workspaceSlug: event.target.value,
                      }))
                    }
                    placeholder="gerado-pelo-nome"
                    className="h-10 rounded-xl"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Tipo
                  </span>
                  <select
                    value={accountForm.workspaceType}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        workspaceType: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    {WORKSPACE_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="mt-5">
                <legend className="text-xs font-medium text-muted-foreground">
                  Módulos iniciais
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {MODULE_KEYS.map((moduleKey) => (
                    <label
                      key={moduleKey}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={accountModules[moduleKey]}
                        onChange={(event) =>
                          setAccountModules((current) => ({
                            ...current,
                            [moduleKey]: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded"
                      />
                      {MODULE_LABELS[moduleKey]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  Não cria cadastro público nem expõe este fluxo na tela
                  inicial.
                </p>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-full px-5"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {isSaving ? "Criando..." : "Criar conta"}
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {initialTab === "workspaces" ? (
          <section className="mt-5 grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <form
              className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 text-white"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction(
                  {
                    action: "upsert_workspace",
                    workspace: workspaceForm,
                  },
                  workspaceForm.id
                    ? "Workspace atualizado."
                    : "Workspace criado.",
                );
              }}
            >
              <div className="text-lg font-semibold">
                {workspaceForm.id ? "Editar workspace" : "Novo workspace"}
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <FieldLabel>Nome</FieldLabel>
                  <Input
                    value={workspaceForm.name}
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="mt-1 rounded-2xl border-white/10 bg-slate-950/70 text-white"
                    placeholder="SÓ AS BRABA Records"
                  />
                </div>
                <div>
                  <FieldLabel>Slug</FieldLabel>
                  <Input
                    value={workspaceForm.slug}
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({
                        ...current,
                        slug: event.target.value,
                      }))
                    }
                    className="mt-1 rounded-2xl border-white/10 bg-slate-950/70 text-white"
                    placeholder="so-as-braba-records"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Tipo</FieldLabel>
                    <SelectField
                      value={workspaceForm.type}
                      onChange={(value) =>
                        setWorkspaceForm((current) => ({
                          ...current,
                          type: value,
                        }))
                      }
                    >
                      {WORKSPACE_TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <FieldLabel>Status</FieldLabel>
                    <SelectField
                      value={workspaceForm.status}
                      onChange={(value) =>
                        setWorkspaceForm((current) => ({
                          ...current,
                          status: value,
                        }))
                      }
                    >
                      {WORKSPACE_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  disabled={isSaving}
                  className="rounded-full bg-white text-slate-950 hover:bg-white/90"
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
                {workspaceForm.id ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    onClick={() =>
                      setWorkspaceForm({
                        id: "",
                        name: "",
                        slug: "",
                        type: "internal",
                        status: "active",
                      })
                    }
                  >
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </form>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 text-white">
              <div className="mb-3 text-lg font-semibold">Workspaces</div>
              {data?.workspaces.length ? (
                <div className="space-y-2">
                  {data.workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      type="button"
                      onClick={() =>
                        setWorkspaceForm({
                          id: workspace.id,
                          name: workspace.name,
                          slug: workspace.slug,
                          type: workspace.type ?? "internal",
                          status: workspace.status,
                        })
                      }
                      className="grid w-full gap-2 rounded-[22px] border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.06] laptop:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div>
                        <div className="font-semibold">{workspace.name}</div>
                        <div className="mt-1 text-xs text-white/45">
                          {workspace.slug}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge
                          tone={
                            workspace.status === "active" ? "green" : "yellow"
                          }
                        >
                          {workspace.status}
                        </StatusBadge>
                        <StatusBadge tone="blue">
                          {workspace.type ?? "sem tipo"}
                        </StatusBadge>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState text="Nenhum workspace cadastrado." />
              )}
            </div>
          </section>
        ) : null}

        {initialTab === "users" ? (
          <section className="mt-5 grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <form
              className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 text-white"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction(
                  {
                    action: "upsert_workspace_user",
                    workspaceUser: userForm,
                  },
                  editingWorkspaceUserId
                    ? "Acesso do usuário atualizado."
                    : "Usuário salvo no workspace.",
                ).then((saved) => {
                  if (saved && editingWorkspaceUserId) {
                    resetUserForm(userForm.workspaceId);
                  }
                });
              }}
            >
              <div className="text-lg font-semibold">
                {editingWorkspaceUserId
                  ? "Editar usuário"
                  : "Adicionar usuário"}
              </div>
              <p className="mt-1 text-sm text-white/50">
                {editingWorkspaceUserId
                  ? "Ajuste role e status sem remover o usuário do workspace."
                  : "Use e-mail para criar ou vincular uma conta. Se ela ainda não existir, o sistema cria com senha temporária."}
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <FieldLabel>Workspace</FieldLabel>
                  <SelectField
                    value={userForm.workspaceId}
                    onChange={(value) =>
                      setUserForm((current) => ({
                        ...current,
                        workspaceId: value,
                      }))
                    }
                  >
                    {data?.workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <div>
                  <FieldLabel>E-mail</FieldLabel>
                  <Input
                    value={userForm.email}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="mt-1 rounded-2xl border-white/10 bg-slate-950/70 text-white"
                    placeholder="usuario@email.com"
                  />
                </div>
                <div>
                  <FieldLabel>User ID</FieldLabel>
                  <Input
                    value={userForm.userId}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        userId: event.target.value,
                      }))
                    }
                    className="mt-1 rounded-2xl border-white/10 bg-slate-950/70 text-white"
                    placeholder="uuid do auth.users"
                  />
                </div>
                <div>
                  <FieldLabel>Senha temporária</FieldLabel>
                  <Input
                    value={userForm.temporaryPassword}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        temporaryPassword: event.target.value,
                      }))
                    }
                    className="mt-1 rounded-2xl border-white/10 bg-slate-950/70 text-white"
                    placeholder="opcional, geramos se ficar vazio"
                  />
                  <p className="text-white/38 mt-1 text-xs">
                    {editingWorkspaceUserId
                      ? "Ignorada no modo edição."
                      : "Usada somente quando o e-mail ainda não existe no Auth."}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Role geral</FieldLabel>
                    <SelectField
                      value={userForm.role}
                      onChange={(value) =>
                        setUserForm((current) => ({ ...current, role: value }))
                      }
                    >
                      {WORKSPACE_ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <FieldLabel>Status</FieldLabel>
                    <SelectField
                      value={userForm.status}
                      onChange={(value) =>
                        setUserForm((current) => ({
                          ...current,
                          status: value,
                        }))
                      }
                    >
                      {WORKSPACE_USER_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={isSaving}
                  className="rounded-full bg-white text-slate-950 hover:bg-white/90"
                >
                  {editingWorkspaceUserId
                    ? "Atualizar usuário"
                    : "Salvar usuário"}
                </Button>
                {editingWorkspaceUserId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    onClick={() => resetUserForm(userForm.workspaceId)}
                  >
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </form>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 text-white">
              <div className="mb-3 text-lg font-semibold">
                Usuários em {getWorkspaceName(data, userForm.workspaceId)}
              </div>
              {selectedWorkspaceUsers.length ? (
                <div className="space-y-2">
                  {selectedWorkspaceUsers.map((user) => (
                    <div
                      key={user.id}
                      className="grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.035] p-4 laptop:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          {user.email ?? user.userId}
                        </div>
                        <div className="text-white/42 mt-1 truncate text-xs">
                          {user.userId}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          tone={user.role === "owner" ? "green" : "blue"}
                        >
                          {user.role}
                        </StatusBadge>
                        <StatusBadge
                          tone={user.status === "active" ? "green" : "yellow"}
                        >
                          {user.status}
                        </StatusBadge>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-full border-sky-300/20 bg-sky-400/10 px-3 text-xs text-sky-50 hover:bg-sky-400/20 hover:text-white"
                          onClick={() => editWorkspaceUser(user)}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-full border-red-400/20 bg-red-500/10 px-3 text-xs text-red-100 hover:bg-red-500/20 hover:text-red-50"
                          onClick={() =>
                            void runAction(
                              {
                                action: "remove_workspace_user",
                                workspaceUser: {
                                  workspaceId: user.workspaceId,
                                  userId: user.userId,
                                },
                              },
                              "Usuário removido.",
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Nenhum usuário vinculado a este workspace." />
              )}
            </div>
          </section>
        ) : null}

        {initialTab === "modules" ? (
          <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-white">
            <div className="grid gap-4 laptop:grid-cols-[320px_minmax(0,1fr)]">
              <div>
                <div className="text-lg font-semibold">
                  Módulos por workspace
                </div>
                <p className="mt-1 text-sm text-white/50">
                  Ative somente os OS disponíveis para o workspace selecionado.
                </p>
                <div className="mt-4">
                  <FieldLabel>Workspace</FieldLabel>
                  <SelectField
                    value={moduleWorkspaceId}
                    onChange={setModuleWorkspaceId}
                  >
                    {data?.workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {MODULE_KEYS.map((moduleKey) => (
                  <label
                    key={moduleKey}
                    className={cn(
                      "cursor-pointer rounded-[24px] border p-4 transition",
                      moduleDraft[moduleKey]
                        ? "border-emerald-300/25 bg-emerald-300/10"
                        : "border-white/10 bg-white/[0.035]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {MODULE_LABELS[moduleKey]}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {moduleKey}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={moduleDraft[moduleKey]}
                        onChange={(event) =>
                          setModuleDraft((current) => ({
                            ...current,
                            [moduleKey]: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4"
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <Button
              disabled={isSaving || !moduleWorkspaceId}
              className="mt-5 rounded-full bg-white text-slate-950 hover:bg-white/90"
              onClick={() =>
                void runAction(
                  {
                    action: "update_modules",
                    modules: {
                      workspaceId: moduleWorkspaceId,
                      modules: MODULE_KEYS.map((moduleKey) => ({
                        moduleKey,
                        isEnabled: moduleDraft[moduleKey],
                      })),
                    },
                  },
                  "Módulos atualizados.",
                )
              }
            >
              <CheckCircle2 className="h-4 w-4" />
              Salvar módulos
            </Button>
          </section>
        ) : null}

        {initialTab === "permissions" ? (
          <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-white">
            <div className="grid gap-4 laptop:grid-cols-2">
              <div>
                <FieldLabel>Workspace</FieldLabel>
                <SelectField
                  value={permissionWorkspaceId}
                  onChange={(value) => {
                    setPermissionWorkspaceId(value);
                    const firstUser = data?.workspaceUsers.find(
                      (user) => user.workspaceId === value,
                    );
                    setPermissionUserId(firstUser?.userId ?? "");
                  }}
                >
                  {data?.workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div>
                <FieldLabel>Usuário</FieldLabel>
                <SelectField
                  value={permissionUserId}
                  onChange={setPermissionUserId}
                >
                  {permissionWorkspaceUsers.map((user) => (
                    <option key={user.id} value={user.userId}>
                      {user.email ?? user.userId}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {activePermissionModules.length ? (
                activePermissionModules.map((moduleKey) => (
                  <div
                    key={moduleKey}
                    className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4"
                  >
                    <div className="font-semibold">
                      {MODULE_LABELS[moduleKey]}
                    </div>
                    <div className="mt-3">
                      <FieldLabel>Role no módulo</FieldLabel>
                      <SelectField
                        value={permissionDraft[moduleKey]}
                        onChange={(value) =>
                          setPermissionDraft((current) => ({
                            ...current,
                            [moduleKey]: value,
                          }))
                        }
                      >
                        {MODULE_ROLE_OPTIONS[moduleKey].map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                ))
              ) : (
                <div className="md:col-span-3">
                  <EmptyState text="Ative módulos neste workspace antes de definir permissões." />
                </div>
              )}
            </div>

            <Button
              disabled={
                isSaving ||
                !permissionWorkspaceId ||
                !permissionUserId ||
                activePermissionModules.length === 0
              }
              className="mt-5 rounded-full bg-white text-slate-950 hover:bg-white/90"
              onClick={() =>
                void runAction(
                  {
                    action: "update_permissions",
                    permissions: {
                      workspaceId: permissionWorkspaceId,
                      userId: permissionUserId,
                      roles: activePermissionModules.map((moduleKey) => ({
                        moduleKey,
                        role: permissionDraft[moduleKey],
                      })),
                    },
                  },
                  "Permissões atualizadas.",
                )
              }
            >
              <ShieldCheck className="h-4 w-4" />
              Salvar permissões
            </Button>
          </section>
        ) : null}
      </Container>
    </div>
  );
}
