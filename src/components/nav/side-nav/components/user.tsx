"use client";

import {
  Check,
  ChevronsUpDown,
  Loader2,
  LogOut,
  Plus,
  Settings2,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ConnectedAccount = {
  userId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  updatedAt: string;
  isCurrent: boolean;
};

function getInitials(value: string | null | undefined) {
  return (value?.trim() || "Conta")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function AccountAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-label={name ? `Avatar de ${name}` : "Avatar da conta"}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-1 ring-inset ring-white/10",
        className,
      )}
      style={
        avatarUrl
          ? {
              backgroundImage: `url(${avatarUrl})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      {avatarUrl ? null : getInitials(name)}
    </span>
  );
}

export default function User() {
  const router = useRouter();
  const workspaceAccess = useWorkspaceAccess();
  const workspace = workspaceAccess.currentWorkspace;
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [hasLoadedAccounts, setHasLoadedAccounts] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(
    null,
  );
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const isGlobalAdmin = workspaceAccess.isGlobalAdmin;
  const canManageTeam =
    isGlobalAdmin || workspace?.role === "owner" || workspace?.role === "admin";
  const accountName =
    workspaceAccess.currentUserName ?? workspaceAccess.currentUserEmail;

  async function loadAccounts() {
    if (hasLoadedAccounts || isLoadingAccounts) {
      return;
    }

    setIsLoadingAccounts(true);
    try {
      const response = await fetch("/api/auth/accounts", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        accounts?: ConnectedAccount[];
        message?: string;
      } | null;

      if (!response.ok || !payload?.success || !payload.accounts) {
        throw new Error(
          payload?.message ?? "Não foi possível carregar as contas conectadas.",
        );
      }

      setAccounts(payload.accounts);
      setHasLoadedAccounts(true);
    } catch (loadError) {
      setMenuError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar as contas conectadas.",
      );
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setMenuError(null);

    await fetch("/api/auth/accounts", { method: "DELETE" });
    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
    setIsSigningOut(false);
  }

  async function handleSwitchAccount(userId: string) {
    if (
      switchingAccountId ||
      accounts.some((item) => item.userId === userId && item.isCurrent)
    ) {
      return;
    }

    setMenuError(null);
    setSwitchingAccountId(userId);

    const response = await fetch("/api/auth/accounts/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      message?: string;
    } | null;

    if (!response.ok || !payload?.success) {
      setMenuError(payload?.message ?? "Não foi possível trocar de conta.");
      setSwitchingAccountId(null);
      return;
    }

    window.location.assign("/dashboard");
  }

  async function handleAddAccount() {
    setIsAddingAccount(true);
    setMenuError(null);

    const response = await fetch("/api/auth/accounts", { method: "POST" });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      message?: string;
    } | null;

    if (!response.ok || !payload?.success) {
      setMenuError(
        payload?.message ?? "Não foi possível proteger a conta atual.",
      );
      setIsAddingAccount(false);
      return;
    }

    window.location.assign("/login?mode=add&next=/dashboard");
  }

  return (
    <div className="mb-1">
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            void loadAccounts();
          }
        }}
      >
        <DropdownMenuTrigger className="group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/70">
          <div className="flex min-w-0 flex-1 items-center">
            <AccountAvatar
              name={accountName}
              avatarUrl={workspaceAccess.currentUserAvatarUrl}
              className="mr-3 h-9 w-9"
            />
            <div className="min-w-0 flex-1 text-left">
              <span className="block truncate whitespace-nowrap text-sm font-semibold text-foreground">
                {workspaceAccess.currentUserName ?? "Conta atual"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {workspaceAccess.currentUserEmail ?? "Conta não identificada"}
              </span>
            </div>
          </div>
          <ChevronsUpDown
            size={18}
            className="ml-3 shrink-0 text-muted-foreground transition group-hover:text-foreground"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          side="top"
          sideOffset={10}
          className="w-80 rounded-xl border-border bg-popover p-2 text-popover-foreground shadow-sm"
        >
          <DropdownMenuLabel className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
            Contas conectadas
          </DropdownMenuLabel>

          <div className="grid gap-1">
            {isLoadingAccounts ? (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando contas...
              </div>
            ) : (
              accounts.map((account) => {
                const isSwitching = switchingAccountId === account.userId;
                const label = account.displayName ?? account.email ?? "Conta";

                return (
                  <DropdownMenuItem
                    key={account.userId}
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleSwitchAccount(account.userId);
                    }}
                    disabled={account.isCurrent || Boolean(switchingAccountId)}
                    className={cn(
                      "rounded-xl px-3 py-2.5 focus:bg-accent",
                      account.isCurrent && "bg-accent/70",
                    )}
                  >
                    <AccountAvatar
                      name={label}
                      avatarUrl={account.avatarUrl}
                      className="mr-2.5 h-8 w-8 text-[10px]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {account.displayName ?? "Conta"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {account.email ?? "E-mail não informado"}
                      </div>
                    </div>
                    {isSwitching ? (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />
                    ) : account.isCurrent ? (
                      <Check className="ml-2 h-4 w-4 text-emerald-500" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })
            )}

            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void handleAddAccount();
              }}
              disabled={isAddingAccount || Boolean(switchingAccountId)}
              className="rounded-xl border border-dashed border-border/80 px-3 py-2.5 focus:bg-accent"
            >
              {isAddingAccount ? (
                <Loader2 className="mr-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Plus className="mr-2.5 h-4 w-4 text-muted-foreground" />
              )}
              {isAddingAccount ? "Abrindo login..." : "Adicionar conta"}
            </DropdownMenuItem>
          </div>

          {menuError ? (
            <div className="mx-1 mt-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {menuError}
            </div>
          ) : null}

          <DropdownMenuSeparator className="mx-2" />

          {workspace ? (
            <DropdownMenuLabel className="px-3 py-1.5 text-[11px] font-normal text-muted-foreground">
              Painel ativo: {workspace.name}
            </DropdownMenuLabel>
          ) : null}

          {canManageTeam ? (
            <DropdownMenuItem
              asChild
              className="rounded-xl px-3 py-2.5 focus:bg-accent"
            >
              <Link href="/settings/access">
                <ShieldCheck className="mr-2.5 h-4 w-4 text-muted-foreground" />
                Gestão de acessos
              </Link>
            </DropdownMenuItem>
          ) : null}

          {isGlobalAdmin ? (
            <DropdownMenuItem
              asChild
              className="rounded-xl px-3 py-2.5 focus:bg-accent"
            >
              <Link href="/settings/admin">
                <UserPlus className="mr-2.5 h-4 w-4 text-muted-foreground" />
                Administração global
              </Link>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem
            asChild
            className="rounded-xl px-3 py-2.5 focus:bg-accent"
          >
            <Link href="/configuracoes">
              <Settings2 className="mr-2.5 h-4 w-4 text-muted-foreground" />
              Configurações
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void handleSignOut();
            }}
            disabled={isSigningOut}
            className="rounded-xl px-3 py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            {isSigningOut ? (
              <Loader2 className="mr-2.5 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2.5 h-4 w-4" />
            )}
            {isSigningOut ? "Saindo..." : "Sair de todas as contas"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
