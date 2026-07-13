"use client";

import { ModeThemeProvider } from "@/components/providers/mode-theme-provider";
import { WorkspaceAccessProvider } from "@/components/providers/workspace-access-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ModeThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <WorkspaceAccessProvider>{children}</WorkspaceAccessProvider>
    </ModeThemeProvider>
  );
}
