import "server-only";
import { getCurrentWorkspaceSelection } from "@/lib/workspaces";

export async function getLabelWorkspaceId(): Promise<string | null> {
  const context = await getCurrentWorkspaceSelection().catch(() => null);
  return context?.workspace.id ?? null;
}

export async function requireLabelWorkspaceId(): Promise<string> {
  const workspaceId = await getLabelWorkspaceId();

  if (!workspaceId) {
    throw new Error("Nenhum workspace ativo foi encontrado para esta conta.");
  }

  return workspaceId;
}
