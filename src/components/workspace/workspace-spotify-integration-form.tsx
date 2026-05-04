"use client";

import { Check, ChevronDown, KeyRound, Loader2, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type WorkspaceSpotifyIntegrationFormProps = {
  initialAppMode: "global_app" | "workspace_app";
  initialAppClientId: string | null;
  hasAppClientSecret: boolean;
};

type ActiveItem = "mode" | "credentials" | null;

function IntegrationRow({
  title,
  value,
  active,
  onOpen,
  children,
}: {
  title: string;
  value: string;
  active: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-white/10 first:border-t-0">
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full grid-cols-1 gap-2 px-4 py-4 text-left transition hover:bg-white/[0.03] md:grid-cols-[220px_1fr_24px] md:items-center"
      >
        <span className="text-sm font-medium text-white">{title}</span>
        <span className="text-sm text-white/55">{value}</span>
        <ChevronDown
          className={`h-4 w-4 text-white/35 transition ${
            active ? "rotate-180" : ""
          }`}
        />
      </button>
      {active ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

function ActionBar({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Salvar
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <X className="h-4 w-4" />
        Cancelar
      </button>
    </div>
  );
}

function ModeOption({
  active,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-3 text-left transition ${
        active
          ? "border-sky-400/30 bg-sky-500/10 text-white"
          : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        {active ? <Check className="h-4 w-4 text-sky-200" /> : null}
      </span>
      <span className="mt-1 block text-xs text-white/45">{detail}</span>
    </button>
  );
}

export default function WorkspaceSpotifyIntegrationForm({
  initialAppMode,
  initialAppClientId,
  hasAppClientSecret,
}: WorkspaceSpotifyIntegrationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeItem, setActiveItem] = useState<ActiveItem>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAppMode, setSavedAppMode] = useState(initialAppMode);
  const [savedClientId, setSavedClientId] = useState(initialAppClientId ?? "");
  const [savedHasSecret, setSavedHasSecret] = useState(hasAppClientSecret);
  const [appMode, setAppMode] = useState(initialAppMode);
  const [appClientId, setAppClientId] = useState(initialAppClientId ?? "");
  const [appClientSecret, setAppClientSecret] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetDraft() {
    setAppMode(savedAppMode);
    setAppClientId(savedClientId);
    setAppClientSecret("");
    setActiveItem(null);
    setMessage(null);
    setError(null);
  }

  async function saveIntegration() {
    setMessage(null);
    setError(null);

    if (
      appMode === "workspace_app" &&
      (!appClientId.trim() || (!appClientSecret.trim() && !savedHasSecret))
    ) {
      setError("Preencha Client ID e Client Secret para usar app do workspace.");
      return;
    }

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

      setSavedAppMode(appMode);
      setSavedClientId(appClientId);
      setSavedHasSecret(savedHasSecret || Boolean(appClientSecret.trim()));
      setAppClientSecret("");
      setActiveItem(null);
      setMessage("Integracao salva.");
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsSaving(false);
    }
  }

  const busy = isSaving || isPending;
  const modeLabel =
    appMode === "workspace_app" ? "App do workspace" : "App global";
  const credentialsLabel =
    appMode === "workspace_app"
      ? savedHasSecret || appClientSecret.trim()
        ? "Client ID e Secret configurados"
        : "Credenciais pendentes"
      : "Usando credenciais globais";

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
      <IntegrationRow
        title="Modo da app"
        value={modeLabel}
        active={activeItem === "mode"}
        onOpen={() => setActiveItem(activeItem === "mode" ? null : "mode")}
      >
        <div className="grid max-w-3xl gap-2 md:grid-cols-2">
          <ModeOption
            active={appMode === "global_app"}
            title="App global"
            detail="Usa a app central do sistema."
            onClick={() => setAppMode("global_app")}
          />
          <ModeOption
            active={appMode === "workspace_app"}
            title="App do workspace"
            detail="Usa a app Spotify do cliente."
            onClick={() => setAppMode("workspace_app")}
          />
        </div>

        {appMode === "workspace_app" ? (
          <div className="mt-3 grid max-w-3xl gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase text-white/40">
                Client ID
              </span>
              <input
                value={appClientId}
                onChange={(event) => setAppClientId(event.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                placeholder="Spotify Client ID"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase text-white/40">
                Client Secret
              </span>
              <input
                type="password"
                value={appClientSecret}
                onChange={(event) => setAppClientSecret(event.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                placeholder={
                  savedHasSecret
                    ? "Ja salvo. Digite para trocar."
                    : "Spotify Client Secret"
                }
              />
            </label>
          </div>
        ) : null}

        <ActionBar saving={busy} onSave={saveIntegration} onCancel={resetDraft} />
      </IntegrationRow>

      <IntegrationRow
        title="Credenciais"
        value={credentialsLabel}
        active={activeItem === "credentials"}
        onOpen={() =>
          setActiveItem(activeItem === "credentials" ? null : "credentials")
        }
      >
        {appMode === "workspace_app" ? (
          <div className="grid max-w-3xl gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase text-white/40">
                Client ID
              </span>
              <input
                value={appClientId}
                onChange={(event) => setAppClientId(event.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                placeholder="Spotify Client ID"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase text-white/40">
                Client Secret
              </span>
              <input
                type="password"
                value={appClientSecret}
                onChange={(event) => setAppClientSecret(event.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                placeholder={
                  savedHasSecret
                    ? "Ja salvo. Digite para trocar."
                    : "Spotify Client Secret"
                }
              />
            </label>
          </div>
        ) : (
          <div className="flex max-w-3xl items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/60">
            <KeyRound className="h-4 w-4 text-white/40" />
            As credenciais globais continuam no ambiente do servidor.
          </div>
        )}
        <ActionBar saving={busy} onSave={saveIntegration} onCancel={resetDraft} />
      </IntegrationRow>

      {message ? (
        <div className="border-t border-white/10 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="border-t border-white/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}
