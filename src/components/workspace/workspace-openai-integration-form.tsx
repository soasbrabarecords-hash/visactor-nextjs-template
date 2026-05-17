"use client";

import type { FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type WorkspaceOpenAIIntegrationFormProps = {
  initialAppMode: "global_app" | "workspace_app";
  initialModel: string | null;
  hasApiKey: boolean;
  globalOpenAIReady: boolean;
};

const modelOptions = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"];

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
          ? "border-emerald-400/30 bg-emerald-500/10 text-white"
          : "border-white/10 bg-black/20 text-white/70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        <span
          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
            active ? "bg-white text-slate-950" : "bg-white/10 text-white/45"
          }`}
        >
          {active ? "ativo" : "off"}
        </span>
      </div>
      <p className="mt-2 text-xs text-white/45">{hint}</p>
    </button>
  );
}

export default function WorkspaceOpenAIIntegrationForm({
  initialAppMode,
  initialModel,
  hasApiKey,
  globalOpenAIReady,
}: WorkspaceOpenAIIntegrationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [appMode, setAppMode] = useState<"global_app" | "workspace_app">(
    initialAppMode,
  );
  const [model, setModel] = useState(initialModel ?? "gpt-5.5");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings/openai-integration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appMode,
          model,
          apiKey,
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

      setApiKey("");
      setMessage("OpenAI salva.");
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
          title="Chave global"
          hint={
            globalOpenAIReady
              ? "Usa a chave do Vercel."
              : "Configure no Vercel ou use workspace."
          }
          onClick={() => setAppMode("global_app")}
        />
        <ModeCard
          active={appMode === "workspace_app"}
          title="Chave do workspace"
          hint="Cada cliente usa a propria OpenAI key."
          onClick={() => setAppMode("workspace_app")}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <label className="block">
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-white/45">
            Modelo
          </div>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
          >
            {modelOptions.map((option) => (
              <option key={option} value={option} className="bg-slate-950">
                {option}
              </option>
            ))}
          </select>
        </label>

        {appMode === "workspace_app" ? (
          <label className="block">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-white/45">
              API Key
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
              placeholder={
                hasApiKey
                  ? "Ja salva. Digite so para trocar."
                  : "Cole sua OpenAI API key"
              }
            />
          </label>
        ) : (
          <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/55">
            {globalOpenAIReady
              ? "Chave global ativa no servidor."
              : "Chave global ausente. Use a chave do workspace."}
          </div>
        )}
      </div>

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
