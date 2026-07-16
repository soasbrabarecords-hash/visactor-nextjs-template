import {
  ArrowUpRight,
  Bot,
  Building2,
  ChevronDown,
  CircleUserRound,
  LogOut,
  Music2,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import Container from "@/components/container";
import AccountProfileForm from "@/components/settings/account-profile-form";
import StatusBadge from "@/components/workspace/status-badge";
import WorkspaceSettingsForm from "@/components/workspace/workspace-settings-form";
import WorkspaceSpotifyIntegrationForm from "@/components/workspace/workspace-spotify-integration-form";
import type { WorkspaceContext } from "@/lib/workspaces";

type SettingsHubProps = {
  spotifyConnected: boolean;
  spotifyAppReady: boolean;
  openaiReady: boolean;
  workspace: WorkspaceContext | null;
  spotifyRedirectUri: string;
  account: {
    displayName: string;
    avatarUrl: string;
    email: string | null;
  };
};

function SettingsSection({
  icon,
  title,
  description,
  status,
  children,
  open = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  status?: ReactNode;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      className="group border-b border-border/70 last:border-b-0"
      open={open}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition hover:bg-muted/45 [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground ring-1 ring-inset ring-border/70">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {description}
          </span>
        </span>
        {status}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/60 bg-muted/20 px-4 py-4">
        {children}
      </div>
    </details>
  );
}

export default function SettingsHub({
  spotifyConnected,
  spotifyAppReady,
  openaiReady,
  workspace,
  spotifyRedirectUri,
  account,
}: SettingsHubProps) {
  const workspaceName = workspace?.workspace.name ?? "Acesso pendente";
  const openaiModel =
    process.env.PLAYLISTS_AI_MODEL ?? "alibaba/qwen3.5-flash";

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background">
      <Container className="max-w-5xl py-5">
        <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge tone="slate">Configurações</StatusBadge>
              <StatusBadge tone={workspace ? "green" : "yellow"}>
                {workspace ? "Workspace ativo" : "Acesso pendente"}
              </StatusBadge>
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {workspaceName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Conta, preferências e integrações em um só lugar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/curadoria"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
            >
              Abrir curadoria <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <a
              href="/api/spotify/auth/login?next=/configuracoes"
              aria-disabled={!workspace || !spotifyAppReady}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-3.5 text-sm font-medium text-background transition hover:opacity-85 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <Music2 className="h-3.5 w-3.5" />
              {spotifyConnected ? "Reconectar" : "Conectar Spotify"}
            </a>
            {spotifyConnected ? (
              <a
                href="/api/spotify/auth/logout?next=/configuracoes"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" /> Desconectar
              </a>
            ) : null}
          </div>
        </header>

        <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <SettingsSection
            icon={<CircleUserRound className="h-4 w-4" />}
            title="Conta"
            description={account.email ?? "Perfil pessoal"}
          >
            <AccountProfileForm
              initialDisplayName={account.displayName}
              initialAvatarUrl={account.avatarUrl}
              email={account.email}
            />
          </SettingsSection>

          {workspace ? (
            <>
              <SettingsSection
                icon={<Building2 className="h-4 w-4" />}
                title="Workspace"
                description="Nome, mercado e regras da curadoria"
              >
                <WorkspaceSettingsForm
                  initialWorkspaceName={workspaceName}
                  initialDefaultMarket={
                    workspace.settings.defaultMarket ?? "BR"
                  }
                  initialReleaseWindowDays={
                    workspace.settings.releaseWindowDays ?? 21
                  }
                  initialSuggestionScoreThreshold={
                    workspace.settings.suggestionScoreThreshold ?? 70
                  }
                  initialPrioritizeFollowedArtists={
                    workspace.settings.prioritizeFollowedArtists ?? true
                  }
                  initialPrioritizeTopTracks={
                    workspace.settings.prioritizeTopTracks ?? true
                  }
                />
              </SettingsSection>

              <SettingsSection
                icon={<Music2 className="h-4 w-4" />}
                title="Spotify"
                description="Aplicativo exclusivo deste workspace"
                status={
                  <StatusBadge
                    tone={
                      spotifyAppReady
                        ? spotifyConnected
                          ? "green"
                          : "blue"
                        : "yellow"
                    }
                  >
                    {spotifyAppReady
                      ? spotifyConnected
                        ? "Conectado"
                        : "Pronto"
                      : "Configurar"}
                  </StatusBadge>
                }
                open={!spotifyAppReady}
              >
                <WorkspaceSpotifyIntegrationForm
                  initialAppClientId={
                    workspace.spotifyIntegration.appClientId ?? null
                  }
                  hasAppClientSecret={
                    workspace.spotifyIntegration.hasAppClientSecret ?? false
                  }
                  spotifyRedirectUri={spotifyRedirectUri}
                />
              </SettingsSection>

              <SettingsSection
                icon={<Bot className="h-4 w-4" />}
                title="Inteligência do Playlist OS"
                description="Agente nativo, seguro e separado por workspace"
                status={
                  <StatusBadge tone={openaiReady ? "green" : "yellow"}>
                    {openaiReady ? "Ativo" : "Ativação interna"}
                  </StatusBadge>
                }
                open={!openaiReady}
              >
                <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {openaiReady
                          ? "Agente Sol disponível"
                          : "Ativação do agente pendente"}
                      </p>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {openaiReady
                          ? "O Playlist OS usa a inteligência central do sistema e consulta somente os dados permitidos deste workspace. Nenhuma chave ou conexão individual é necessária."
                          : "O agente será autenticado automaticamente pelo AI Gateway da Vercel. Usuários e workspaces não precisam cadastrar chave, escolher modelo ou conectar uma conta do ChatGPT."}
                      </p>
                      {openaiReady ? (
                        <p className="mt-2 text-xs text-muted-foreground/75">
                          Modelo operacional: {openaiModel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </SettingsSection>
            </>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Peça a um administrador para vincular sua conta a um workspace.
            </div>
          )}
        </section>
      </Container>
    </div>
  );
}
