"use client";

import { ChevronDown, LogOut } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentWorkspace } from "@/hooks/use-workspace-access";
import { createClient } from "@/lib/supabase/client";

export default function User() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const workspace = useCurrentWorkspace();

  async function handleSignOut() {
    setIsSigningOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
    setIsSigningOut(false);
  }

  return (
    <div className="mb-3">
      <div className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
        Workspace atual
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition hover:bg-slate-200 dark:hover:bg-slate-800">
          <div className="flex min-w-0 flex-1 items-center">
            <Image
              src="/avatar.png"
              alt="SÓ AS BRABA"
              className="mr-3 rounded-full"
              width={40}
              height={40}
            />
            <div className="min-w-0 flex-1 text-left">
              <span className="block truncate whitespace-nowrap text-sm font-semibold text-foreground">
                {workspace?.name ?? "Sem workspace"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {workspace
                  ? workspace.type === "internal"
                    ? "Equipe interna"
                    : "Workspace ativo"
                  : "Acesso pendente"}
              </span>
            </div>
          </div>
          <ChevronDown size={18} className="ml-3 shrink-0" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void handleSignOut();
            }}
            disabled={isSigningOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isSigningOut ? "Saindo..." : "Sair"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
