"use client";

import { ChartThemeProvider } from "@/components/providers/chart-theme-provider";
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
      <ChartThemeProvider>
        <WorkspaceAccessProvider>{children}</WorkspaceAccessProvider>
      </ChartThemeProvider>
    </ModeThemeProvider>
  );
}
