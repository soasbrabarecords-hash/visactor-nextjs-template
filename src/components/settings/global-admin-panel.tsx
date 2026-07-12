"use client";

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LockKeyhole,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/workspace/status-badge";
import {
  MODULE_KEYS,
  MODULE_LABELS,
  type ModuleKey,
  WORKSPACE_TYPE_OPTIONS,
} from "@/lib/workspace-access";

type GlobalAdminResponse = {
  success: boolean;
  message?: string;
  data?: {
    currentUserEmail: string | null;
    totalAccounts: number;
    activeAccounts: number;
  };
  mutation?: {
    createdAuthUser: boolean;
    userId: string;
    email: string | null;
    temporaryPassword: string | null;
    workspaceId: string;
    workspaceName: string;
  };
};

const EMPTY_FORM = {
  displayName: "",
  email: "",
  temporaryPassword: "",
  workspaceName: "",
  workspaceSlug: "",
  workspaceType: "client",
};

export default function GlobalAdminPanel() {
  const [adminData, setAdminData] = useState<
    GlobalAdminResponse["data"] | null
  >(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    playlist_os: true,
    label_os: false,
    artist_os: false,
  });
  const [credential, setCredential] = useState<
    GlobalAdminResponse["mutation"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/admin/accounts", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as GlobalAdminResponse;

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message ?? "Acesso global indisponível.");
        }

        setAdminData(payload.data);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Acesso global indisponível.",
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    setCredential(null);

    try {
      const response = await fetch("/api/settings/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          enabledModules: MODULE_KEYS.filter((moduleKey) => modules[moduleKey]),
        }),
      });
      const payload = (await response.json()) as GlobalAdminResponse;

      if (!response.ok || !payload.success || !payload.mutation) {
        throw new Error(payload.message ?? "Não foi possível criar a conta.");
      }

      setCredential(payload.mutation);
      setSuccess("Conta e painel individual criados.");
      setForm(EMPTY_FORM);
      setAdminData((current) =>
        current
          ? {
              ...current,
              totalAccounts: current.totalAccounts + 1,
              activeAccounts: current.activeAccounts + 1,
            }
          : current,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível criar a conta.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Container className="max-w-5xl py-5">
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
      </Container>
    );
  }

  if (!adminData) {
    return (
      <Container className="max-w-5xl py-5">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <LockKeyhole className="h-5 w-5 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Área global restrita</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error ?? "Disponível somente para a conta contato@soasbraba.com."}
          </p>
          <Button asChild variant="outline" className="mt-5 rounded-full">
            <Link href="/settings/access">Abrir Gestão de acessos</Link>
          </Button>
        </section>
      </Container>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background">
      <Container className="max-w-5xl py-5">
        <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="green">Admin global</StatusBadge>
              <span className="text-xs text-muted-foreground">
                {adminData.currentUserEmail}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">
              Administração global
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie uma nova conta SaaS com workspace e painel independentes.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/settings/access">
              Gestão de acessos <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </header>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <span className="font-semibold">{adminData.totalAccounts}</span>{" "}
              <span className="text-muted-foreground">contas criadas</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <div className="text-sm">
              <span className="font-semibold">{adminData.activeAccounts}</span>{" "}
              <span className="text-muted-foreground">painéis ativos</span>
            </div>
          </div>
        </div>

        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {credential ? (
          <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm">
            <div className="font-semibold">Acesso criado</div>
            <div className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
              <span>E-mail: {credential.email}</span>
              <span>Workspace: {credential.workspaceName}</span>
              <span className="sm:col-span-2">
                Senha temporária:{" "}
                <code className="rounded-md bg-muted px-2 py-1 text-foreground">
                  {credential.temporaryPassword ?? "Conta já existente"}
                </code>
              </span>
            </div>
          </div>
        ) : null}

        <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
              <UserPlus className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Criar nova conta</h2>
              <p className="text-xs text-muted-foreground">
                O novo usuário será owner do próprio workspace.
              </p>
            </div>
          </div>

          <form className="p-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Nome do responsável
                </span>
                <Input
                  required
                  value={form.displayName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                  placeholder="Nome completo"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  E-mail de acesso
                </span>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                  placeholder="usuario@empresa.com"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Senha temporária
                </span>
                <Input
                  type="password"
                  minLength={8}
                  value={form.temporaryPassword}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      temporaryPassword: event.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                  placeholder="Gerada automaticamente se vazio"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Nome do workspace
                </span>
                <Input
                  required
                  value={form.workspaceName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      workspaceName: event.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                  placeholder="Empresa, selo ou projeto"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Slug opcional
                </span>
                <Input
                  value={form.workspaceSlug}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      workspaceSlug: event.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                  placeholder="gerado-pelo-nome"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Tipo de operação
                </span>
                <select
                  value={form.workspaceType}
                  onChange={(event) =>
                    setForm((current) => ({
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
                      checked={modules[moduleKey]}
                      onChange={(event) =>
                        setModules((current) => ({
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

            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Cadastro interno; não existe signup público.
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
      </Container>
    </div>
  );
}
