import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  KeyRound,
  LogOut,
  Music2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Container from "@/components/container";
import StatusBadge from "@/components/workspace/status-badge";
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
    <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-white shadow-[0_18px_56px_-42px_rgba(15,23,42,0.95)]">
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

export default function SettingsHub({
  spotify,
  spotifyAppReady,
  workspace,
}: SettingsHubProps) {
  const connectHref = "/api/spotify/auth/login?next=/configuracoes";
  const disconnectHref = "/api/spotify/auth/logout?next=/configuracoes";
  const spotifyModeLabel =
    workspace?.spotifyIntegration.appMode === "workspace_app"
      ? "App do workspace"
      : "App global";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.10),transparent_22%),radial-gradient(circle_at_right,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,#040816_0%,#030712_100%)]">
      <Container className="py-8">
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(3,7,18,0.96))] p-6 text-white shadow-[0_24px_80px_-42px_rgba(15,23,42,0.95)] laptop:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="blue">Settings</StatusBadge>
            <StatusBadge tone={spotify.connected ? "green" : "yellow"}>
              {spotify.connected ? "Spotify conectado" : "Spotify pendente"}
            </StatusBadge>
            <StatusBadge tone={spotifyAppReady ? "green" : "red"}>
              {spotifyAppReady ? "App pronta" : "Credenciais faltando"}
            </StatusBadge>
          </div>

          <div className="mt-5 grid gap-6 laptop:grid-cols-[minmax(0,1.15fr)_360px]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Configuracoes do workspace
              </h2>
              <p className="mt-2 text-sm text-white/60">
                {workspace ? workspace.workspace.name : "Conexao, regras e setup."}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={connectHref}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
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
              </div>
            </div>

            <aside className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
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

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            value={workspace?.settings.defaultMarket ?? "BR"}
            hint="Mercado principal."
            tone="blue"
          />
          <MiniCard
            icon={<KeyRound className="h-5 w-5" />}
            title="Credenciais"
            value={spotifyModeLabel}
            hint={
              workspace?.spotifyIntegration.appMode === "workspace_app"
                ? "Modo por cliente."
                : "Fallback seguro ativo."
            }
            tone={workspace?.spotifyIntegration.appMode === "workspace_app" ? "yellow" : "blue"}
          />
          <MiniCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Infra"
            value="Segredos internos"
            hint="Ficam fora do cliente."
            tone="slate"
          />
        </section>

        {workspace ? (
          <section className="mt-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-5 text-white shadow-[0_18px_56px_-42px_rgba(15,23,42,0.95)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                  Integracao Spotify
                </div>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  Modo da app
                </h3>
              </div>
              <StatusBadge
                tone={
                  workspace.spotifyIntegration.appMode === "workspace_app"
                    ? "yellow"
                    : "blue"
                }
              >
                {spotifyModeLabel}
              </StatusBadge>
            </div>

            <WorkspaceSpotifyIntegrationForm
              initialAppMode={workspace.spotifyIntegration.appMode}
              initialAppClientId={workspace.spotifyIntegration.appClientId}
              hasAppClientSecret={workspace.spotifyIntegration.hasAppClientSecret}
            />
          </section>
        ) : null}

        <section className="mt-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-5 text-white shadow-[0_18px_56px_-42px_rgba(15,23,42,0.95)]">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            <span className="text-sm font-medium text-white">Proximo passo</span>
          </div>
          <p className="mt-2 text-sm text-white/55">
            Ativar edicao de regras e modo de app por workspace.
          </p>
        </section>
      </Container>
    </div>
  );
}
