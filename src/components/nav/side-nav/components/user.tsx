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
import { createClient } from "@/lib/supabase/client";

export default function User() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
    setIsSigningOut(false);
  }

  return (
    <div className="flex h-16 items-center border-b border-border px-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800">
          <div className="flex items-center">
            <Image
              src="/avatar.png"
              alt="SÓ AS BRABA"
              className="mr-2 rounded-full"
              width={36}
              height={36}
            />
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium">SÓ AS BRABA</span>
              <span className="text-xs text-muted-foreground">Equipe interna</span>
            </div>
          </div>
          <ChevronDown size={16} />
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
