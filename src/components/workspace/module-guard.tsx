"use client";

import { LockKeyhole } from "lucide-react";
import Container from "@/components/container";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import type { ModuleKey } from "@/lib/workspace-access";

export default function ModuleGuard({
  moduleKey,
  children,
}: {
  moduleKey: ModuleKey;
  children: React.ReactNode;
}) {
  const { currentWorkspace, error, isLoading, canAccessModule } =
    useWorkspaceAccess();

  if (isLoading) {
    return (
      <Container className="py-8">
        <div className="h-56 animate-pulse rounded-[32px] border border-border bg-card/70" />
      </Container>
    );
  }

  if (!currentWorkspace || !canAccessModule(moduleKey)) {
    const hasWorkspace = Boolean(currentWorkspace);

    return (
      <Container className="py-8">
        <section className="relative overflow-hidden rounded-[32px] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(15,23,42,0.92))] p-8 text-white shadow-[0_28px_90px_-70px_rgba(251,191,36,0.5)]">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/12 text-amber-100 ring-1 ring-inset ring-amber-200/15">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            {hasWorkspace ? "Acesso negado" : "Nenhum workspace vinculado"}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/64">
            {hasWorkspace
              ? "Você não tem permissão para acessar este módulo neste workspace."
              : error ?? "Nenhum workspace vinculado. Peça acesso a um administrador."}
          </p>
        </section>
      </Container>
    );
  }

  return <>{children}</>;
}
