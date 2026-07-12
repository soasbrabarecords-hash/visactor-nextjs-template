"use client";

import {
  Building2,
  Check,
  ChevronsUpDown,
  Loader2,
  LogOut,
  RefreshCw,
  Settings2,
  ShieldCheck,
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

function workspaceTypeLabel(type: string | null | undefined) {
  if (type === "internal") {
    return "Equipe interna";
  }

  if (type === "label") {
    return "Selo";
  }

  if (type === "artist") {
    return "Artista";
  }

  if (type === "agency") {
    return "Agência";
  }

  if (type === "client") {
    return "Cliente";
  }

  return "Workspace ativo";
}

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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<
    string | null
  >(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const isGlobalAdmin = workspaceAccess.isGlobalAdmin;
  const canManageTeam =
    isGlobalAdmin || workspace?.role === "owner" || workspace?.role === "admin";
  const accountName =
    workspaceAccess.currentUserName ?? workspaceAccess.currentUserEmail;

  async function endSession(destination: string) {
    setIsSigningOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace(destination);
    router.refresh();
    setIsSigningOut(false);
  }

  async function handleSignOut() {
    await endSession("/login");
  }

  async function handleSwitchAccount() {
    await endSession("/login?switch=1");
  }

  async function handleSwitchWorkspace(workspaceId: string) {
    if (workspaceId === workspace?.id || switchingWorkspaceId) {
      return;
    }

    setMenuError(null);
    setSwitchingWorkspaceId(workspaceId);

    try {
      const response = await fetch("/api/workspace/current", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspaceId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        setMenuError(payload?.message ?? "Nao foi possivel trocar workspace.");
        return;
      }

      await workspaceAccess.refreshWorkspaceAccess();
      router.refresh();
    } finally {
      setSwitchingWorkspaceId(null);
    }
  }

  return (
    <div className="mb-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="group flex w-full items-center justify-between rounded-2xl border border-transparent px-2.5 py-2 text-left transition hover:border-border hover:bg-accent/70">
          <div className="flex min-w-0 flex-1 items-center">
            <AccountAvatar
              name={workspace?.name}
              avatarUrl={workspaceAccess.currentUserAvatarUrl}
              className="mr-3 h-9 w-9"
            />
            <div className="min-w-0 flex-1 text-left">
              <span className="block truncate whitespace-nowrap text-sm font-semibold text-foreground">
                {workspace?.name ?? "Sem workspace"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {workspace
                  ? workspaceTypeLabel(workspace.type)
                  : "Acesso pendente"}
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
          className="w-80 rounded-2xl border-border bg-popover p-2 text-popover-foreground shadow-2xl"
        >
          <DropdownMenuLabel className="flex items-center gap-3 px-3 py-2.5">
            <AccountAvatar
              name={accountName}
              avatarUrl={workspaceAccess.currentUserAvatarUrl}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {workspaceAccess.currentUserName ?? "Conta atual"}
              </div>
              <div className="truncate text-xs font-normal text-muted-foreground">
                {workspaceAccess.currentUserEmail ?? "Conta nao identificada"}
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="mx-2" />

          <DropdownMenuLabel className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
            Trocar workspace
          </DropdownMenuLabel>

          <div className="grid gap-1">
            {workspaceAccess.userWorkspaces.length > 0 ? (
              workspaceAccess.userWorkspaces.map((item) => {
                const active = item.id === workspace?.id;
                const isSwitching = switchingWorkspaceId === item.id;

                return (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleSwitchWorkspace(item.id);
                    }}
                    disabled={active || Boolean(switchingWorkspaceId)}
                    className={cn(
                      "rounded-xl px-3 py-2.5 focus:bg-accent",
                      active && "bg-accent",
                    )}
                  >
                    <Building2 className="mr-2.5 h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {item.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {workspaceTypeLabel(item.type)}
                      </div>
                    </div>
                    {isSwitching ? (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />
                    ) : active ? (
                      <Check className="ml-2 h-4 w-4 text-emerald-300" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50">
                Nenhum workspace vinculado.
              </div>
            )}
          </div>

          {menuError ? (
            <div className="mt-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {menuError}
            </div>
          ) : null}

          <DropdownMenuSeparator className="mx-2" />

          {canManageTeam ? (
            <DropdownMenuItem
              asChild
              className="rounded-xl px-3 py-2.5 focus:bg-accent"
            >
              <Link href="/settings/access">
                <ShieldCheck className="mr-2.5 h-4 w-4 text-muted-foreground" />
                {isGlobalAdmin ? "Administração global" : "Equipe do workspace"}
              </Link>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void handleSwitchAccount();
            }}
            disabled={isSigningOut}
            className="rounded-xl px-3 py-2.5 focus:bg-accent"
          >
            <RefreshCw className="mr-2.5 h-4 w-4 text-muted-foreground" />
            Entrar com outra conta
          </DropdownMenuItem>

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
            {isSigningOut ? "Saindo..." : "Sair"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
