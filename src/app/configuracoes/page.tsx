import { TopNav } from "@/components/nav";
import SettingsHub from "@/components/workspace/settings-hub";
import {
  fetchSpotifyConnectionStatus,
  getSpotifyRedirectUri,
} from "@/lib/spotify-user";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceContext } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const [{ result: spotify }, workspace, { data: userData }] =
    await Promise.all([
      fetchSpotifyConnectionStatus(),
      getCurrentWorkspaceContext().catch(() => null),
      supabase.auth.getUser(),
    ]);
  const metadata = userData.user?.user_metadata ?? {};
  const displayName = [
    metadata.display_name,
    metadata.full_name,
    metadata.name,
  ].find(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );
  const avatarUrl = [metadata.avatar_url, metadata.picture].find(
    (value): value is string =>
      typeof value === "string" && /^https?:\/\//i.test(value.trim()),
  );
  const spotifyAppReady = Boolean(
    workspace?.spotifyIntegration.appClientId &&
    workspace.spotifyIntegration.hasAppClientSecret,
  );
  const openaiReady = Boolean(process.env.OPENAI_API_KEY?.trim());
  const spotifyRedirectUri = getSpotifyRedirectUri(
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://system.soasbraba.com",
  );

  return (
    <>
      <TopNav title="Configuracoes" />
      <SettingsHub
        spotify={spotify}
        spotifyAppReady={spotifyAppReady}
        openaiReady={openaiReady}
        workspace={workspace}
        spotifyRedirectUri={spotifyRedirectUri}
        account={{
          displayName: displayName?.trim() ?? "",
          avatarUrl: avatarUrl?.trim() ?? "",
          email: userData.user?.email ?? null,
        }}
      />
    </>
  );
}
