"use client";

import { usePathname } from "next/navigation";
import { SideNav } from "@/components/nav";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login";

  if (isAuthRoute) {
    return <div className="min-h-[100dvh]">{children}</div>;
  }

  return (
    <div className="flex min-h-[100dvh]">
      <SideNav />
      <div className="flex-grow overflow-auto">{children}</div>
    </div>
  );
}
