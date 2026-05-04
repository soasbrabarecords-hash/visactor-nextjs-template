import type { ReactNode } from "react";
import {
  BadgeCheck,
  ExternalLink,
  LogOut,
  Music2,
  PlugZap,
  Settings2,
} from "lucide-react";
import Container from "@/components/container";
import StatusBadge from "@/components/workspace/status-badge";
import WorkspaceSettingsForm from "@/components/workspace/workspace-settings-form";
import WorkspaceSpotifyIntegrationForm from "@/components/workspace/workspace-spotify-integration-form";
import type { SpotifyConnectionStatusResult } from "@/lib/spotify-user";
import type { WorkspaceContext } from "@/lib/workspaces";

type SettingsHubProps = {
  spotify: SpotifyConnectionStatusResult;
  spotifyAppReady: boolean;
  workspace: WorkspaceContext | null;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getSpotifyPlan(product: string | null) {
  if (!product) {
    return "Plano nao informado";
  }

  return product.toLowerCase() === "premium"
    ? "Spotify Premium"
    : `Spotify ${product}`;
}

function SettingsSection({
  icon,
  title,
  badge,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-white/10 py-6 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70">
            {icon}
          </span>
          <h3 className="text-base font-semibold text-white">{title}</h3>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function StatusLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/10 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-sm text-white/45">{label}</span>
      <span className="text-right text-sm font-medium text-white">{value}</span>
    </div>
  );
}

export default function SettingsHub({
  spotify,
  spotifyAppReady,
  workspace,
}: SettingsHubProps) {
  const connectHref = "/api/spotify/auth/login?next=/configuracoes";
  const disconnectHref = "/api/spotify/auth/logout?next=/configuracoes";
  const workspaceName = workspace?.workspace.name ?? "Meu workspace";
  const defaultMarket = workspace?.settings.defaultMarket ?? "BR";
  const releaseWindowDays = workspace?.settings.releaseWindowDays ?? 21;
  const suggestionScoreThreshold =
    workspace?.settings.suggestionScoreThreshold ?? 70;
  const prioritizeFollowedArtists =
    workspace?.settings.prioritizeFollowedArtists ?? true;
  const prioritizeTopTracks = workspace?.settings.prioritizeTopTracks ?? true;
  const integrationMode = workspace?.spotifyIntegration.appMode ?? "global_app";
  const spotifyModeLabel =
    integrationMode === "workspace_app" ? "App do workspace" : "App global";
  const integrationClientId = workspace?.spotifyIntegration.appClientId ?? null;
  const hasIntegrationSecret =
    workspace?.spotifyIntegration.hasAppClientSecret ?? false;

  return (
    <div className="min-h-screen bg-[#050918]">
      <Container className="py-8">
        <div className="border-b border-white/10 pb-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={workspace ? "blue" : "yellow"}>
                  {workspace ? "Workspace" : "Sync pendente"}
                </StatusBadge>
                <StatusBadge tone={spotify.connected ? "green" : "yellow"}>
                  {spotify.connected ? "Spotify conectado" : "Spotify pendente"}
                </StatusBadge>
                <StatusBadge tone={spotifyAppReady ? "green" : "red"}>
                  {spotifyAppReady ? "App pronta" : "Credenciais faltando"}
                </StatusBadge>
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">
                Configuracoes
              </h2>
              <p className="mt-1 text-sm text-white/50">{workspaceName}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={connectHref}
                className="inline-flex items-center gap-2 rounded-md bg-[#1DB954] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                <Music2 className="h-4 w-4" />
                {spotify.connected ? "Reconectar" : "Conectar Spotify"}
              </a>
              {spotify.connected ? (
                <a
                  href={disconnectHref}
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Desconectar
                </a>
              ) : null}
              <a
                href="/curadoria"
                className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Curadoria
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-8 py-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <main className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
            <SettingsSection
              icon={<Settings2 className="h-4 w-4" />}
              title="Painel"
              badge={
                <StatusBadge tone={workspace ? "blue" : "yellow"}>
                  {workspace ? "Editavel" : "Sync pendente"}
                </StatusBadge>
              }
            >
              <WorkspaceSettingsForm
                initialWorkspaceName={workspaceName}
                initialDefaultMarket={defaultMarket}
                initialReleaseWindowDays={releaseWindowDays}
                initialSuggestionScoreThreshold={suggestionScoreThreshold}
                initialPrioritizeFollowedArtists={prioritizeFollowedArtists}
                initialPrioritizeTopTracks={prioritizeTopTracks}
              />
            </SettingsSection>

            <SettingsSection
              icon={<PlugZap className="h-4 w-4" />}
              title="Spotify"
              badge={<StatusBadge tone="blue">{spotifyModeLabel}</StatusBadge>}
            >
              <WorkspaceSpotifyIntegrationForm
                initialAppMode={integrationMode}
                initialAppClientId={integrationClientId}
                hasAppClientSecret={hasIntegrationSecret}
              />
            </SettingsSection>
          </main>

          <aside className="space-y-4">
            <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4 text-white">
              <div className="flex items-center gap-3">
                {spotify.connected ? (
                  spotify.account.imageUrl ? (
                    <div
                      className="h-11 w-11 rounded-lg bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${spotify.account.imageUrl})`,
                      }}
                      aria-label={spotify.account.displayName}
                      role="img"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-sm font-semibold text-white/90">
                      {getInitials(spotify.account.displayName)}
                    </div>
                  )
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white/80">
                    <Music2 className="h-5 w-5" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-xs uppercase text-white/40">Spotify</div>
                  <div className="truncate text-sm font-semibold text-white">
                    {spotify.connected ? spotify.account.displayName : "Nao conectado"}
                  </div>
                  <div className="truncate text-xs text-white/50">
                    {spotify.connected
                      ? spotify.account.email ?? spotify.account.id
                      : "Aguardando conexao"}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge tone={spotify.connected ? "green" : "yellow"}>
                  {spotify.connected
                    ? getSpotifyPlan(spotify.account.product)
                    : "Pendente"}
                </StatusBadge>
                <StatusBadge tone={spotifyAppReady ? "blue" : "red"}>
                  {spotifyAppReady ? spotifyModeLabel : "App incompleta"}
                </StatusBadge>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4 text-white">
              <div className="mb-1 flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-emerald-300" />
                <h3 className="text-sm font-semibold">Estado do painel</h3>
              </div>
              <div className="mt-3">
                <StatusLine label="Mercado" value={defaultMarket} />
                <StatusLine
                  label="Lancamentos"
                  value={`${releaseWindowDays} dias`}
                />
                <StatusLine
                  label="Score minimo"
                  value={`${suggestionScoreThreshold}+`}
                />
                <StatusLine label="Modo Spotify" value={spotifyModeLabel} />
              </div>
            </section>
          </aside>
        </div>
      </Container>
    </div>
  );
}
