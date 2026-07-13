"use client";

import { useWorkspaceAccess } from "@/hooks/use-workspace-access";

export function useSpotifyAccountPlaylistsCacheKey() {
  const { currentWorkspace, currentUserEmail, isLoading } =
    useWorkspaceAccess();

  if (isLoading) {
    return undefined;
  }

  return `${currentWorkspace?.id ?? "current-workspace"}:${
    currentUserEmail ?? "current-user"
  }`;
}
