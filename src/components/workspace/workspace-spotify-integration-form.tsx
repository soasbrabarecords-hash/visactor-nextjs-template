"use client";

import { Check, Copy, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

type WorkspaceSpotifyIntegrationFormProps = {
  initialAppClientId: string | null;
  hasAppClientSecret: boolean;
  spotifyRedirectUri: string;
};

export default function WorkspaceSpotifyIntegrationForm({
  initialAppClientId,
  hasAppClientSecret,
  spotifyRedirectUri,
}: WorkspaceSpotifyIntegrationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
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
          appClientId,
          appClientSecret,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;

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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rounded-xl border border-border bg-background/70 p-3">
        <div className="text-xs font-semibold text-foreground">
          Redirect URI
        </div>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
            {spotifyRedirectUri}
          </code>
          <button
            type="button"
            onClick={() => {
              void copyRedirectUri();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent"
          >
            {redirectCopied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {redirectCopied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Cadastre exatamente esta URL em Spotify Developers antes de conectar.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            Client ID
          </div>
          <input
            value={appClientId}
            onChange={(event) => setAppClientId(event.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
            placeholder="Cole o Client ID"
          />
        </label>

        <label className="block">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            Client Secret
          </div>
          <input
            type="password"
            value={appClientSecret}
            onChange={(event) => setAppClientSecret(event.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
            placeholder={
              hasAppClientSecret
                ? "Ja salvo. Digite so para trocar."
                : "Cole o Client Secret"
            }
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSaving || isPending}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving || isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar
        </button>

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </form>
  );
}
