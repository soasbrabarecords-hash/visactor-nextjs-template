"use client";

import {
  Building2,
  Check,
  ChevronsUpDown,
  Loader2,
  LogOut,
  Settings2,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import Image from "next/image";
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
import { ACCESS_ADMIN_EMAIL } from "@/lib/workspace-access";
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

export default function User() {
  const router = useRouter();
  const workspaceAccess = useWorkspaceAccess();
  const workspace = workspaceAccess.currentWorkspace;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const isGlobalAdmin =
    workspaceAccess.currentUserEmail?.toLowerCase() === ACCESS_ADMIN_EMAIL;
  const canManageAccess =
    isGlobalAdmin || workspace?.role === "owner" || workspace?.role === "admin";

  async function handleSignOut() {
    setIsSigningOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
    setIsSigningOut(false);
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
      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
          }
        | null;

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
      <div className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
        Workspace atual
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="group flex w-full items-center justify-between rounded-[22px] border border-transparent px-3 py-2.5 text-left transition hover:border-white/70 hover:bg-white/55 hover:shadow-[0_12px_30px_rgba(15,23,42,0.10)] dark:hover:border-white/12 dark:hover:bg-white/[0.075] dark:hover:shadow-[0_14px_34px_rgba(0,0,0,0.28)]">
          <div className="flex min-w-0 flex-1 items-center">
            <Image
              src="/avatar.png"
              alt="SÓ AS BRABA"
              className="mr-3 rounded-full"
              width={42}
              height={42}
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
          className="w-72 rounded-[22px] border-white/10 bg-slate-950/96 p-2 text-white shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        >
          <DropdownMenuLabel className="px-3 py-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              <UserCircle className="h-4 w-4" />
              Conta atual
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-white">
              {workspaceAccess.currentUserEmail ?? "Conta nao identificada"}
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="mx-2 bg-white/10" />

          <DropdownMenuLabel className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
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
                      "rounded-2xl px-3 py-2.5 text-white/78 focus:bg-white/10 focus:text-white",
                      active && "bg-white/10 text-white",
                    )}
                  >
                    <Building2 className="mr-2.5 h-4 w-4 text-sky-200/80" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {item.name}
                      </div>
                      <div className="truncate text-xs text-white/45">
                        {workspaceTypeLabel(item.type)}
                      </div>
                    </div>
                    {isSwitching ? (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin text-white/70" />
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

          <DropdownMenuSeparator className="mx-2 bg-white/10" />

          {canManageAccess ? (
            <DropdownMenuItem
              asChild
              className="rounded-2xl px-3 py-2.5 text-white/78 focus:bg-white/10 focus:text-white"
            >
              <Link href="/settings/access">
                <ShieldCheck className="mr-2.5 h-4 w-4 text-emerald-200/80" />
                Gestão de Acessos
              </Link>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem
            asChild
            className="rounded-2xl px-3 py-2.5 text-white/78 focus:bg-white/10 focus:text-white"
          >
            <Link href="/configuracoes">
              <Settings2 className="mr-2.5 h-4 w-4 text-sky-200/80" />
              Configurações
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void handleSignOut();
            }}
            disabled={isSigningOut}
            className="rounded-2xl px-3 py-2.5 text-red-100 focus:bg-red-500/12 focus:text-red-50"
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
