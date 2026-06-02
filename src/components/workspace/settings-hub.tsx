import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  KeyRound,
  LogOut,
  Music2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Container from "@/components/container";
import StatusBadge from "@/components/workspace/status-badge";
import WorkspaceOpenAIIntegrationForm from "@/components/workspace/workspace-openai-integration-form";
import WorkspaceSettingsForm from "@/components/workspace/workspace-settings-form";
import WorkspaceSpotifyIntegrationForm from "@/components/workspace/workspace-spotify-integration-form";
import type { SpotifyConnectionStatusResult } from "@/lib/spotify-user";
import type { WorkspaceContext } from "@/lib/workspaces";

const REQUIRED_SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-email",
  "user-read-private",
] as const;

type SettingsHubProps = {
  spotify: SpotifyConnectionStatusResult;
  spotifyAppReady: boolean;
  openaiReady: boolean;
  workspace: WorkspaceContext | null;
  spotifyRedirectUri: string;
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

function parseSpotifyScopes(scopes: string | null | undefined) {
  return new Set(
    scopes
      ?.split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean) ?? [],
  );
}

function formatTokenDate(value: string | null | undefined) {
  if (!value) {
    return "Sem validade";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Validade invalida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function HealthItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "blue" | "yellow" | "red" | "slate";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
      <div
        className={`mt-1 text-sm font-semibold ${
          tone === "green"
            ? "text-emerald-200"
            : tone === "blue"
              ? "text-sky-200"
              : tone === "yellow"
                ? "text-amber-200"
                : tone === "red"
                  ? "text-red-200"
                  : "text-white/70"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MiniCard({
  icon,
  title,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  hint: string;
  tone: "green" | "blue" | "yellow" | "slate";
}) {
  return (
    <article className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-white shadow-[0_18px_56px_-42px_rgba(15,23,42,0.95)]">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80">
          {icon}
        </span>
        <StatusBadge tone={tone} className="px-2 py-0.5 text-[10px]">
          {tone === "green"
            ? "ativo"
            : tone === "blue"
              ? "base"
              : tone === "yellow"
                ? "em breve"
                : "infra"}
        </StatusBadge>
      </div>
      <div className="mt-4 text-[11px] uppercase tracking-[0.16em] text-white/40">
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      <p className="mt-1 text-sm text-white/55">{hint}</p>
    </article>
  );
}

function SectionCard({
  eyebrow,
  title,
  badge,
  children,
}: {
  eyebrow: string;
  title: string;
  badge: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-white shadow-[0_18px_56px_-42px_rgba(15,23,42,0.95)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            {eyebrow}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

export default function SettingsHub({
  spotify,
  spotifyAppReady,
  openaiReady,
  workspace,
  spotifyRedirectUri,
}: SettingsHubProps) {
  const connectHref = "/api/spotify/auth/login?next=/configuracoes";
  const disconnectHref = "/api/spotify/auth/logout?next=/configuracoes";
  const spotifyModeLabel =
    workspace?.spotifyIntegration.appMode === "workspace_app"
      ? "App do workspace"
      : "App global";
  const workspaceName = workspace?.workspace.name ?? "Acesso pendente";
  const defaultMarket = workspace?.settings.defaultMarket ?? "BR";
  const releaseWindowDays = workspace?.settings.releaseWindowDays ?? 21;
  const suggestionScoreThreshold =
    workspace?.settings.suggestionScoreThreshold ?? 70;
  const prioritizeFollowedArtists =
    workspace?.settings.prioritizeFollowedArtists ?? true;
  const prioritizeTopTracks = workspace?.settings.prioritizeTopTracks ?? true;
  const integrationMode = workspace?.spotifyIntegration.appMode ?? "global_app";
  const integrationClientId = workspace?.spotifyIntegration.appClientId ?? null;
  const hasIntegrationSecret =
    workspace?.spotifyIntegration.hasAppClientSecret ?? false;
  const hasSpotifyAccessToken =
    workspace?.spotifyIntegration.hasAccessToken ?? false;
  const hasSpotifyRefreshToken =
    workspace?.spotifyIntegration.hasRefreshToken ?? false;
  const spotifySessionSaved = hasSpotifyAccessToken || hasSpotifyRefreshToken;
  const grantedSpotifyScopes = parseSpotifyScopes(
    workspace?.spotifyIntegration.grantedScopes,
  );
  const missingSpotifyScopes = REQUIRED_SPOTIFY_SCOPES.filter(
    (scope) => !grantedSpotifyScopes.has(scope),
  );
  const spotifyTokenExpiresAt = workspace?.spotifyIntegration.tokenExpiresAt ?? null;
  const openaiMode = workspace?.openaiIntegration.appMode ?? "global_app";
  const openaiModeLabel =
    openaiMode === "workspace_app" ? "Chave do workspace" : "Chave global";
  const openaiModel =
    workspace?.openaiIntegration.model ??
    process.env.OPENAI_PLAYLISTS_MODEL ??
    process.env.OPENAI_MODEL ??
    "gpt-5.5";
  const hasOpenAIWorkspaceKey = workspace?.openaiIntegration.hasApiKey ?? false;
  const effectiveOpenAIReady =
    openaiMode === "workspace_app" ? hasOpenAIWorkspaceKey : openaiReady;

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.10),transparent_22%),radial-gradient(circle_at_right,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,#040816_0%,#030712_100%)]">
      <Container className="py-5">
        <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(3,7,18,0.96))] p-5 text-white shadow-[0_24px_80px_-42px_rgba(15,23,42,0.95)] laptop:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="blue">Settings</StatusBadge>
            <StatusBadge tone={spotify.connected ? "green" : "yellow"}>
              {spotify.connected ? "Spotify conectado" : "Spotify pendente"}
            </StatusBadge>
            <StatusBadge tone={spotifyAppReady ? "green" : "red"}>
              {spotifyAppReady ? "App pronta" : "Credenciais faltando"}
            </StatusBadge>
            <StatusBadge tone={effectiveOpenAIReady ? "green" : "yellow"}>
              {effectiveOpenAIReady ? "ChatGPT ativo" : "ChatGPT pendente"}
            </StatusBadge>
          </div>

          <div className="mt-4 grid gap-5 laptop:grid-cols-[minmax(0,1.15fr)_340px]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Configuracoes do workspace
              </h2>
              <p className="mt-1.5 text-sm text-white/60">
                {workspaceName}
              </p>
              <p className="mt-2 text-sm text-white/45">
                Ajuste regras da curadoria e a integracao logo abaixo.
              </p>
              {!workspace ? (
                <p className="mt-3 text-sm text-amber-200/80">
                  Nenhum workspace vinculado. Peça acesso a um administrador.
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={connectHref}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition ${
                    workspace
                      ? "bg-[#1DB954] hover:brightness-110"
                      : "pointer-events-none bg-white/10 text-white/45"
                  }`}
                  aria-disabled={!workspace}
                >
                  <Music2 className="h-4 w-4" />
                  {spotify.connected ? "Reconectar Spotify" : "Conectar Spotify"}
                </a>

                {spotify.connected ? (
                  <a
                    href={disconnectHref}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    Desconectar
                  </a>
                ) : null}

                <a
                  href="/curadoria"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Abrir Curadoria
                </a>

                <a
                  href="/settings/access"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-5 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/35 hover:bg-emerald-300/15"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Gestão de Acessos
                </a>
              </div>
            </div>

            <aside className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                {spotify.connected ? (
                  spotify.account.imageUrl ? (
                    <div
                      className="h-14 w-14 rounded-2xl bg-cover bg-center"
                      style={{ backgroundImage: `url(${spotify.account.imageUrl})` }}
                      aria-label={spotify.account.displayName}
                      role="img"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white/90">
                      {getInitials(spotify.account.displayName)}
                    </div>
                  )
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                    <Music2 className="h-5 w-5" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                    Spotify
                  </div>
                  <div className="truncate text-base font-semibold text-white">
                    {spotify.connected ? spotify.account.displayName : "Nao conectado"}
                  </div>
                  <div className="truncate text-xs text-white/50">
                    {spotify.connected
                      ? spotify.account.email ?? spotify.account.id
                      : "Conecte para liberar curadoria"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge tone={spotify.connected ? "green" : "yellow"}>
                  {spotify.connected
                    ? getSpotifyPlan(spotify.account.product)
                    : "Aguardando conexao"}
                </StatusBadge>
                <StatusBadge tone={spotifyAppReady ? "blue" : "red"}>
                  {spotifyAppReady ? spotifyModeLabel : "App incompleta"}
                </StatusBadge>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MiniCard
            icon={<Music2 className="h-5 w-5" />}
            title="Integracao"
            value="Spotify"
            hint={spotify.connected ? "Conta conectada." : "Conectar conta."}
            tone={spotify.connected ? "green" : "yellow"}
          />
          <MiniCard
            icon={<SlidersHorizontal className="h-5 w-5" />}
            title="Curadoria"
            value={defaultMarket}
            hint="Mercado principal."
            tone="blue"
          />
          <MiniCard
            icon={<KeyRound className="h-5 w-5" />}
            title="Spotify App"
            value={spotifyModeLabel}
            hint={
              integrationMode === "workspace_app"
                ? spotifySessionSaved
                  ? "Sessao salva no workspace."
                  : "Reconecte para salvar token."
                : "Fallback seguro ativo."
            }
            tone={
              integrationMode === "workspace_app" && spotifySessionSaved
                ? "green"
                : integrationMode === "workspace_app"
                  ? "yellow"
                  : "blue"
            }
          />
          <MiniCard
            icon={<Bot className="h-5 w-5" />}
            title="Playlists IA"
            value={openaiModel}
            hint={effectiveOpenAIReady ? openaiModeLabel : "Conectar OpenAI."}
            tone={effectiveOpenAIReady ? "green" : "yellow"}
          />
        </section>

        {workspace ? (
          <>
            <SectionCard
              eyebrow="Workspace"
              title="Regras e preferencias"
              badge={<StatusBadge tone="blue">Editavel</StatusBadge>}
            >
              <WorkspaceSettingsForm
                initialWorkspaceName={workspaceName}
                initialDefaultMarket={defaultMarket}
                initialReleaseWindowDays={releaseWindowDays}
                initialSuggestionScoreThreshold={suggestionScoreThreshold}
                initialPrioritizeFollowedArtists={prioritizeFollowedArtists}
                initialPrioritizeTopTracks={prioritizeTopTracks}
              />
            </SectionCard>

            <SectionCard
              eyebrow="Integracao Spotify"
              title="Modo da app"
              badge={
                <StatusBadge
                  tone={
                    integrationMode === "workspace_app" && !spotifySessionSaved
                      ? "yellow"
                      : integrationMode === "workspace_app" &&
                          missingSpotifyScopes.length > 0
                        ? "yellow"
                        : integrationMode === "workspace_app"
                          ? "green"
                          : "blue"
                  }
                >
                  {integrationMode === "workspace_app" && !spotifySessionSaved
                    ? "Token ausente"
                    : integrationMode === "workspace_app" &&
                        missingSpotifyScopes.length > 0
                      ? "Reautorizar"
                      : spotifyModeLabel}
                </StatusBadge>
              }
            >
              <WorkspaceSpotifyIntegrationForm
                initialAppMode={integrationMode}
                initialAppClientId={integrationClientId}
                hasAppClientSecret={hasIntegrationSecret}
                spotifyRedirectUri={spotifyRedirectUri}
              />
              <div className="mt-3 rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                      Diagnostico seguro
                    </div>
                    <p className="mt-1 text-sm text-white/55">
                      Status salvo neste workspace. Segredos nunca aparecem aqui.
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      spotifySessionSaved && missingSpotifyScopes.length === 0
                        ? "green"
                        : spotifySessionSaved
                          ? "yellow"
                          : "red"
                    }
                  >
                    {spotifySessionSaved
                      ? missingSpotifyScopes.length === 0
                        ? "sessao ok"
                        : "escopos pendentes"
                      : "token ausente"}
                  </StatusBadge>
                  <a
                    href="/api/spotify/debug/workspace"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    Testar leitura
                  </a>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <HealthItem
                    label="Client ID"
                    value={integrationClientId ? "Salvo" : "Faltando"}
                    tone={integrationClientId ? "green" : "red"}
                  />
                  <HealthItem
                    label="Client Secret"
                    value={hasIntegrationSecret ? "Salvo" : "Faltando"}
                    tone={hasIntegrationSecret ? "green" : "red"}
                  />
                  <HealthItem
                    label="Sessao Spotify"
                    value={spotifySessionSaved ? "Token salvo" : "Reconectar"}
                    tone={spotifySessionSaved ? "green" : "yellow"}
                  />
                  <HealthItem
                    label="Refresh token"
                    value={hasSpotifyRefreshToken ? "Salvo" : "Ausente"}
                    tone={hasSpotifyRefreshToken ? "green" : "yellow"}
                  />
                  <HealthItem
                    label="Conta vinculada"
                    value={
                      workspace.spotifyIntegration.providerAccountLabel ||
                      workspace.spotifyIntegration.providerAccountId ||
                      "Nao vinculada"
                    }
                    tone={
                      workspace.spotifyIntegration.providerAccountId
                        ? "blue"
                        : "yellow"
                    }
                  />
                  <HealthItem
                    label="Validade"
                    value={formatTokenDate(spotifyTokenExpiresAt)}
                    tone={spotifyTokenExpiresAt ? "blue" : "slate"}
                  />
                  <HealthItem
                    label="Escopos"
                    value={
                      missingSpotifyScopes.length === 0
                        ? "OK"
                        : `${missingSpotifyScopes.length} faltando`
                    }
                    tone={missingSpotifyScopes.length === 0 ? "green" : "yellow"}
                  />
                  <HealthItem
                    label="Workspace"
                    value={workspace.workspace.name}
                    tone="blue"
                  />
                </div>
                {missingSpotifyScopes.length > 0 ? (
                  <p className="mt-3 text-xs leading-5 text-amber-100/80">
                    Escopos faltando: {missingSpotifyScopes.join(", ")}. Clique em
                    Reconectar Spotify para autorizar novamente.
                  </p>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Integracao ChatGPT"
              title="OpenAI para Playlists IA"
              badge={
                <StatusBadge tone={effectiveOpenAIReady ? "green" : "yellow"}>
                  {effectiveOpenAIReady ? "Ativo" : "Pendente"}
                </StatusBadge>
              }
            >
              <WorkspaceOpenAIIntegrationForm
                initialAppMode={openaiMode}
                initialModel={openaiModel}
                hasApiKey={hasOpenAIWorkspaceKey}
                globalOpenAIReady={openaiReady}
              />
            </SectionCard>
          </>
        ) : (
          <section className="mt-3 rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-5 text-white">
            <h3 className="text-base font-semibold">Acesso pendente</h3>
            <p className="mt-2 text-sm text-white/60">
              Nenhum workspace vinculado. Peça acesso a um administrador.
            </p>
          </section>
        )}

        <section className="mt-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-white shadow-[0_18px_56px_-42px_rgba(15,23,42,0.95)]">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            <span className="text-sm font-medium text-white">
              {workspace ? "Workspace ativo" : "Workspace pendente"}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/55">
            Regras, credenciais e conexao ficam centralizadas nesta tela.
          </p>
        </section>
      </Container>
    </div>
  );
}
