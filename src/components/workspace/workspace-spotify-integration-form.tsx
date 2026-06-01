"use client";

import type { FormEvent } from "react";
import { Check, Copy, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type WorkspaceSpotifyIntegrationFormProps = {
  initialAppMode: "global_app" | "workspace_app";
  initialAppClientId: string | null;
  hasAppClientSecret: boolean;
  spotifyRedirectUri: string;
};

function ModeCard({
  active,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border p-4 text-left transition ${
        active
          ? "border-sky-400/30 bg-sky-500/10 text-white"
          : "border-white/10 bg-black/20 text-white/70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        <span
          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
            active
              ? "bg-white text-slate-950"
              : "bg-white/10 text-white/45"
          }`}
        >
          {active ? "ativo" : "off"}
        </span>
      </div>
      <p className="mt-2 text-xs text-white/45">{hint}</p>
    </button>
  );
}

export default function WorkspaceSpotifyIntegrationForm({
  initialAppMode,
  initialAppClientId,
  hasAppClientSecret,
  spotifyRedirectUri,
}: WorkspaceSpotifyIntegrationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [appMode, setAppMode] = useState<"global_app" | "workspace_app">(
    initialAppMode,
  );
  const [appClientId, setAppClientId] = useState(initialAppClientId ?? "");
  const [appClientSecret, setAppClientSecret] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redirectCopied, setRedirectCopied] = useState(false);

  async function copyRedirectUri() {
    if (!navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(spotifyRedirectUri);
    setRedirectCopied(true);
    window.setTimeout(() => setRedirectCopied(false), 1800);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings/spotify-integration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appMode,
          appClientId,
          appClientSecret,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
          }
        | null;

      if (!response.ok || !data?.success) {
        setError(data?.message ?? "Nao foi possivel salvar.");
        return;
      }

      setAppClientSecret("");
      setMessage("Configuracao salva.");
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <ModeCard
          active={appMode === "global_app"}
          title="App global"
          hint="Usa a configuracao central do sistema."
          onClick={() => setAppMode("global_app")}
        />
        <ModeCard
          active={appMode === "workspace_app"}
          title="App do workspace"
          hint="Cada cliente usa a propria app do Spotify."
          onClick={() => setAppMode("workspace_app")}
        />
      </div>

      {appMode === "workspace_app" ? (
        <div className="mt-4 rounded-[22px] border border-white/10 bg-black/20 p-4">
          <div className="mb-4 rounded-[20px] border border-sky-400/20 bg-sky-500/10 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-100/75">
              Redirect URI obrigatório
            </div>
            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/85">
                {spotifyRedirectUri}
              </code>
              <button
                type="button"
                onClick={() => {
                  void copyRedirectUri();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                {redirectCopied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {redirectCopied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-sky-50/58">
              Cadastre exatamente esta URL em Spotify Developers antes de conectar.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                Client ID
              </div>
              <input
                value={appClientId}
                onChange={(event) => setAppClientId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                placeholder="Cole o Client ID"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                Client Secret
              </div>
              <input
                type="password"
                value={appClientSecret}
                onChange={(event) => setAppClientSecret(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                placeholder={
                  hasAppClientSecret
                    ? "Ja salvo. Digite so para trocar."
                    : "Cole o Client Secret"
                }
              />
            </label>
          </div>

          <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/85">
            Depois de salvar as chaves, clique em Conectar Spotify no topo para vincular as playlists deste workspace.
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSaving || isPending}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving || isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar
        </button>

        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </form>
  );
}
