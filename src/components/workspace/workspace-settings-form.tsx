"use client";

import type { FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type WorkspaceSettingsFormProps = {
  initialWorkspaceName: string;
  initialDefaultMarket: string;
  initialReleaseWindowDays: number;
  initialSuggestionScoreThreshold: number;
  initialPrioritizeFollowedArtists: boolean;
  initialPrioritizeTopTracks: boolean;
};

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-start justify-between gap-4 rounded-[22px] border px-4 py-3 text-left transition ${
        checked
          ? "border-emerald-400/30 bg-emerald-500/10 text-white"
          : "border-white/10 bg-black/20 text-white/70"
      }`}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs text-white/45">{hint}</span>
      </span>
      <span
        className={`mt-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${
          checked
            ? "bg-emerald-300 text-emerald-950"
            : "bg-white/10 text-white/45"
        }`}
      >
        {checked ? "on" : "off"}
      </span>
    </button>
  );
}

export default function WorkspaceSettingsForm({
  initialWorkspaceName,
  initialDefaultMarket,
  initialReleaseWindowDays,
  initialSuggestionScoreThreshold,
  initialPrioritizeFollowedArtists,
  initialPrioritizeTopTracks,
}: WorkspaceSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [defaultMarket, setDefaultMarket] = useState(initialDefaultMarket);
  const [releaseWindowDays, setReleaseWindowDays] = useState(
    String(initialReleaseWindowDays),
  );
  const [suggestionScoreThreshold, setSuggestionScoreThreshold] = useState(
    String(initialSuggestionScoreThreshold),
  );
  const [prioritizeFollowedArtists, setPrioritizeFollowedArtists] = useState(
    initialPrioritizeFollowedArtists,
  );
  const [prioritizeTopTracks, setPrioritizeTopTracks] = useState(
    initialPrioritizeTopTracks,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceName,
          defaultMarket,
          releaseWindowDays: Number(releaseWindowDays),
          suggestionScoreThreshold: Number(suggestionScoreThreshold),
          prioritizeFollowedArtists,
          prioritizeTopTracks,
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

      setMessage("Workspace salvo.");
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
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_300px]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Workspace
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block md:col-span-1">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                Nome
              </div>
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                placeholder="Nome do workspace"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                Mercado
              </div>
              <input
                value={defaultMarket}
                onChange={(event) =>
                  setDefaultMarket(event.target.value.toUpperCase())
                }
                maxLength={2}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                placeholder="BR"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                Janela
              </div>
              <input
                type="number"
                min={1}
                max={90}
                value={releaseWindowDays}
                onChange={(event) => setReleaseWindowDays(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
              />
            </label>
          </div>

          <div className="mt-4 text-[11px] uppercase tracking-[0.16em] text-white/40">
            Curadoria
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr_1fr]">
            <label className="block">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                Score minimo
              </div>
              <input
                type="number"
                min={0}
                max={100}
                value={suggestionScoreThreshold}
                onChange={(event) =>
                  setSuggestionScoreThreshold(event.target.value)
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
              />
            </label>

            <Toggle
              checked={prioritizeFollowedArtists}
              onChange={setPrioritizeFollowedArtists}
              label="Artistas seguidos"
              hint="Pesa mais quem voce ja acompanha."
            />
            <Toggle
              checked={prioritizeTopTracks}
              onChange={setPrioritizeTopTracks}
              label="Top tracks"
              hint="Da mais peso ao seu historico forte."
            />
          </div>
        </div>

        <aside className="rounded-[22px] border border-white/10 bg-black/20 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Resumo
          </div>
          <div className="mt-3 space-y-3 text-sm text-white/70">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-white/40">
                Mercado base
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                {defaultMarket || "BR"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-white/40">
                Lancamentos
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                {releaseWindowDays || "21"} dias
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-white/40">
                Corte
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                {suggestionScoreThreshold || "70"}+
              </div>
            </div>
          </div>
        </aside>
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
