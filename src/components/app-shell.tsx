"use client";

import { usePathname } from "next/navigation";
import { SideNav } from "@/components/nav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login";

  if (isAuthRoute) {
    return <div className="theme-adaptive min-h-[100dvh]">{children}</div>;
  }

  return (
    <div className="flex min-h-[100dvh]">
      <SideNav />
      <main className="theme-adaptive min-w-0 flex-grow overflow-auto">
        {children}
      </main>
    </div>
  );
}
