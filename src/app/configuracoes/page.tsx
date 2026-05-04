import { TopNav } from "@/components/nav";
import SettingsHub from "@/components/workspace/settings-hub";
import { fetchSpotifyConnectionStatus } from "@/lib/spotify-user";
import { getCurrentWorkspaceContext } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const { result: spotify } = await fetchSpotifyConnectionStatus();
  const workspace = await getCurrentWorkspaceContext().catch(() => null);
  const spotifyAppReady = Boolean(
    process.env.SPOTIFY_CLIENT_ID?.trim() &&
      process.env.SPOTIFY_CLIENT_SECRET?.trim(),
  );

  return (
    <>
      <TopNav title="Configuracoes" />
      <SettingsHub
        spotify={spotify}
        spotifyAppReady={spotifyAppReady}
        workspace={workspace}
      />
    </>
  );
}
