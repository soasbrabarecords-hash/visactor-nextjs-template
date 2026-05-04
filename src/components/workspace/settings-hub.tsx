import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  KeyRound,
  Link2,
  LogOut,
  Music2,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Container from "@/components/container";
import StatusBadge from "@/components/workspace/status-badge";
import type { SpotifyConnectionStatusResult } from "@/lib/spotify-user";

type SettingsHubProps = {
  spotify: SpotifyConnectionStatusResult;
  spotifyAppReady: boolean;
};

function getSpotifyProductLabel(product: string | null) {
  if (!product) {
    return "Plano nao informado";
  }

  if (product.toLowerCase() === "premium") {
    return "Spotify Premium";
  }

  return `Spotify ${product}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SettingsList({
  items,
}: {
  items: Array<{
    icon: ReactNode;
    title: string;
    description: string;
    tone: "green" | "blue" | "yellow" | "slate";
  }>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.title}
          className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/75">
            {item.icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <StatusBadge tone={item.tone} className="px-2 py-0.5 text-[10px]">
                {item.tone === "green"
                  ? "ativo"
                  : item.tone === "blue"
                    ? "cliente"
                    : item.tone === "yellow"
                      ? "proximo passo"
                      : "infra"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-white/60">{item.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function SettingsHub({
  spotify,
  spotifyAppReady,
}: SettingsHubProps) {
  const connectHref = "/api/spotify/auth/login?next=/configuracoes";
  const disconnectHref = "/api/spotify/auth/logout?next=/configuracoes";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.10),transparent_22%),radial-gradient(circle_at_right,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,#040816_0%,#030712_100%)]">
      <Container className="py-8">
        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(3,7,18,0.96))] p-6 text-white shadow-[0_24px_80px_-42px_rgba(15,23,42,0.95)] laptop:p-8">
          <div className="grid gap-6 laptop:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="blue">Central de configuracao</StatusBadge>
                <StatusBadge tone={spotify.connected ? "green" : "yellow"}>
                  {spotify.connected ? "Spotify conectado" : "Spotify pendente"}
                </StatusBadge>
                <StatusBadge tone={spotifyAppReady ? "green" : "red"}>
                  {spotifyAppReady ? "App Spotify pronta" : "Credenciais faltando"}
                </StatusBadge>
              </div>

              <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white laptop:text-[2.5rem]">
                O painel que organiza conexoes, regras editoriais e o setup que cada cliente vai precisar.
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 laptop:text-[15px]">
                A conta Spotify saiu das paginas espalhadas e agora ganhou um lugar oficial.
                Daqui a gente centraliza integracoes, playlists padrao, mercado principal
                e tudo que precisa virar configuracao de produto.
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
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Abrir Curadoria
                </a>
              </div>
            </div>

            <aside className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Integracao principal
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-white">Spotify</h3>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  <Music2 className="h-5 w-5" />
                </span>
              </div>

              {spotify.connected ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    {spotify.account.imageUrl ? (
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
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {spotify.account.displayName}
                      </div>
                      <div className="truncate text-xs text-white/50">
                        {spotify.account.email ?? spotify.account.id}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge tone="green">{getSpotifyProductLabel(spotify.account.product)}</StatusBadge>
                        <StatusBadge tone="blue">Curadoria ativa</StatusBadge>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                        Pronto para
                      </div>
                      <p className="mt-2 text-sm text-white/75">
                        Curadoria, Novidades, sugestoes de playlist e add-to-playlist direto do dashboard.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                        Observacao
                      </div>
                      <p className="mt-2 text-sm text-white/75">
                        O Web Player do Spotify ainda depende de permissao de streaming e conta Premium.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Conexao ainda nao feita
                  </div>
                  <p className="mt-2 leading-6 text-amber-50/80">
                    Conecte uma conta Spotify para liberar leitura de playlists, top artistas,
                    artistas seguidos e as sugestoes editoriais que o sistema cruza no dashboard.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </section>

        <section className="mt-8 grid gap-6 laptop:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <article className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-6 text-white shadow-[0_18px_56px_-40px_rgba(15,23,42,0.92)]">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="purple">O que vira settings</StatusBadge>
              <StatusBadge tone="blue">cliente final</StatusBadge>
            </div>
            <h3 className="mt-4 text-xl font-semibold">Configuracoes que fazem sentido por workspace</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Essa camada vai ser a base do produto para outras contas usarem sem editar codigo.
            </p>

            <div className="mt-5">
              <SettingsList
                items={[
                  {
                    icon: <Link2 className="h-4 w-4" />,
                    title: "Conexao Spotify",
                    description:
                      "Conta conectada, reconexao, status de permissao e controle do que o app pode ler da conta.",
                    tone: "green",
                  },
                  {
                    icon: <SlidersHorizontal className="h-4 w-4" />,
                    title: "Preferencias editoriais",
                    description:
                      "Mercado padrao, janela de recencia, score minimo e prioridade para artistas seguidos ou top tracks.",
                    tone: "blue",
                  },
                  {
                    icon: <Music2 className="h-4 w-4" />,
                    title: "Playlists alvo",
                    description:
                      "Escolha das playlists usadas como base de curadoria e dos destinos preferidos para sugestoes.",
                    tone: "blue",
                  },
                  {
                    icon: <KeyRound className="h-4 w-4" />,
                    title: "Credenciais por cliente",
                    description:
                      "Se voce quiser modelo BYO app, aqui entram Client ID e Client Secret do Spotify salvos no servidor.",
                    tone: "yellow",
                  },
                ]}
              />
            </div>
          </article>

          <article className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-6 text-white shadow-[0_18px_56px_-40px_rgba(15,23,42,0.92)]">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="yellow">Arquitetura do produto</StatusBadge>
              <StatusBadge tone="slate">separacao importante</StatusBadge>
            </div>
            <h3 className="mt-4 text-xl font-semibold">O que fica aqui e o que continua como infra</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Nem toda variavel do projeto deve aparecer para o cliente final. Essa tela tambem ajuda a separar isso.
            </p>

            <div className="mt-5">
              <SettingsList
                items={[
                  {
                    icon: <CheckCircle2 className="h-4 w-4" />,
                    title: "Vai para Configuracoes",
                    description:
                      "Conta Spotify, playlists padrao, regras editoriais e conexoes que o usuario precisa gerenciar sozinho.",
                    tone: "green",
                  },
                  {
                    icon: <ShieldCheck className="h-4 w-4" />,
                    title: "Continua em infra",
                    description:
                      "Supabase URL, anon key publica, service role, segredos internos e qualquer chave operacional do servidor.",
                    tone: "slate",
                  },
                  {
                    icon: <RefreshCw className="h-4 w-4" />,
                    title: "Proximo refactor",
                    description:
                      "Depois dessa tela, o passo natural e modelar workspace settings e integrations no banco para multiusuario.",
                    tone: "yellow",
                  },
                ]}
              />
            </div>
          </article>
        </section>
      </Container>
    </div>
  );
}
