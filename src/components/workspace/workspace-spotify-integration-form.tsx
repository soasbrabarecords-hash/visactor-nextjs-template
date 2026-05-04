"use client";

import type { FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type WorkspaceSpotifyIntegrationFormProps = {
  initialAppMode: "global_app" | "workspace_app";
  initialAppClientId: string | null;
  hasAppClientSecret: boolean;
};

export default function WorkspaceSpotifyIntegrationForm({
  initialAppMode,
  initialAppClientId,
  hasAppClientSecret,
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
    <form className="mt-6 rounded-[26px] border border-white/10 bg-white/[0.04] p-5" onSubmit={handleSubmit}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAppMode("global_app")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            appMode === "global_app"
              ? "bg-white text-slate-950"
              : "border border-white/10 bg-transparent text-white/70 hover:text-white"
          }`}
        >
          App global
        </button>
        <button
          type="button"
          onClick={() => setAppMode("workspace_app")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            appMode === "workspace_app"
              ? "bg-white text-slate-950"
              : "border border-white/10 bg-transparent text-white/70 hover:text-white"
          }`}
        >
          App do workspace
        </button>
      </div>

      {appMode === "workspace_app" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
              placeholder={hasAppClientSecret ? "Ja salvo. Digite so para trocar." : "Cole o Client Secret"}
            />
          </label>
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
