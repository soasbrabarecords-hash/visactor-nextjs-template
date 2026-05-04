"use client";

import { Check, ChevronDown, Loader2, Save, X } from "lucide-react";
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

type ActiveItem = "name" | "market" | "window" | "score" | "priorities" | null;

type SavedState = {
  workspaceName: string;
  defaultMarket: string;
  releaseWindowDays: string;
  suggestionScoreThreshold: string;
  prioritizeFollowedArtists: boolean;
  prioritizeTopTracks: boolean;
};

const MARKET_OPTIONS = [
  { value: "BR", label: "Brasil" },
  { value: "US", label: "Estados Unidos" },
  { value: "PT", label: "Portugal" },
  { value: "MX", label: "Mexico" },
  { value: "AR", label: "Argentina" },
  { value: "CO", label: "Colombia" },
  { value: "GB", label: "Reino Unido" },
];

const WINDOW_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "21", label: "21 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
];

function SettingRow({
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

function ToggleButton({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
        checked
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          checked
            ? "border-emerald-300 bg-emerald-300 text-emerald-950"
            : "border-white/20"
        }`}
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      {label}
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
  const [activeItem, setActiveItem] = useState<ActiveItem>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedState>({
    workspaceName: initialWorkspaceName,
    defaultMarket: initialDefaultMarket,
    releaseWindowDays: String(initialReleaseWindowDays),
    suggestionScoreThreshold: String(initialSuggestionScoreThreshold),
    prioritizeFollowedArtists: initialPrioritizeFollowedArtists,
    prioritizeTopTracks: initialPrioritizeTopTracks,
  });
  const [workspaceName, setWorkspaceName] = useState(saved.workspaceName);
  const [defaultMarket, setDefaultMarket] = useState(saved.defaultMarket);
  const [releaseWindowDays, setReleaseWindowDays] = useState(
    saved.releaseWindowDays,
  );
  const [suggestionScoreThreshold, setSuggestionScoreThreshold] = useState(
    saved.suggestionScoreThreshold,
  );
  const [prioritizeFollowedArtists, setPrioritizeFollowedArtists] = useState(
    saved.prioritizeFollowedArtists,
  );
  const [prioritizeTopTracks, setPrioritizeTopTracks] = useState(
    saved.prioritizeTopTracks,
  );

  function resetDraft() {
    setWorkspaceName(saved.workspaceName);
    setDefaultMarket(saved.defaultMarket);
    setReleaseWindowDays(saved.releaseWindowDays);
    setSuggestionScoreThreshold(saved.suggestionScoreThreshold);
    setPrioritizeFollowedArtists(saved.prioritizeFollowedArtists);
    setPrioritizeTopTracks(saved.prioritizeTopTracks);
    setActiveItem(null);
    setError(null);
    setMessage(null);
  }

  async function saveSettings() {
    setError(null);
    setMessage(null);
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

      const nextSaved = {
        workspaceName,
        defaultMarket,
        releaseWindowDays,
        suggestionScoreThreshold,
        prioritizeFollowedArtists,
        prioritizeTopTracks,
      };
      setSaved(nextSaved);
      setActiveItem(null);
      setMessage("Alteracao salva.");
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsSaving(false);
    }
  }

  const busy = isSaving || isPending;

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
      <SettingRow
        title="Nome do workspace"
        value={workspaceName || "Meu workspace"}
        active={activeItem === "name"}
        onOpen={() => setActiveItem(activeItem === "name" ? null : "name")}
      >
        <input
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          className="w-full max-w-xl rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
          placeholder="Nome do workspace"
        />
        <ActionBar saving={busy} onSave={saveSettings} onCancel={resetDraft} />
      </SettingRow>

      <SettingRow
        title="Mercado principal"
        value={defaultMarket}
        active={activeItem === "market"}
        onOpen={() => setActiveItem(activeItem === "market" ? null : "market")}
      >
        <select
          value={defaultMarket}
          onChange={(event) => setDefaultMarket(event.target.value)}
          className="w-full max-w-sm rounded-md border border-white/10 bg-[#070b18] px-3 py-2 text-sm text-white outline-none transition focus:border-white/25"
        >
          {MARKET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value} - {option.label}
            </option>
          ))}
        </select>
        <ActionBar saving={busy} onSave={saveSettings} onCancel={resetDraft} />
      </SettingRow>

      <SettingRow
        title="Janela de lancamentos"
        value={`${releaseWindowDays} dias`}
        active={activeItem === "window"}
        onOpen={() => setActiveItem(activeItem === "window" ? null : "window")}
      >
        <select
          value={releaseWindowDays}
          onChange={(event) => setReleaseWindowDays(event.target.value)}
          className="w-full max-w-sm rounded-md border border-white/10 bg-[#070b18] px-3 py-2 text-sm text-white outline-none transition focus:border-white/25"
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ActionBar saving={busy} onSave={saveSettings} onCancel={resetDraft} />
      </SettingRow>

      <SettingRow
        title="Score minimo"
        value={`${suggestionScoreThreshold}+`}
        active={activeItem === "score"}
        onOpen={() => setActiveItem(activeItem === "score" ? null : "score")}
      >
        <div className="flex max-w-xl flex-wrap items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={suggestionScoreThreshold}
            onChange={(event) => setSuggestionScoreThreshold(event.target.value)}
            className="min-w-64 flex-1 accent-emerald-300"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={suggestionScoreThreshold}
            onChange={(event) => setSuggestionScoreThreshold(event.target.value)}
            className="w-24 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-white/25"
          />
        </div>
        <ActionBar saving={busy} onSave={saveSettings} onCancel={resetDraft} />
      </SettingRow>

      <SettingRow
        title="Prioridades"
        value={[
          prioritizeFollowedArtists ? "artistas seguidos" : null,
          prioritizeTopTracks ? "top tracks" : null,
        ]
          .filter(Boolean)
          .join(" + ") || "sem prioridade extra"}
        active={activeItem === "priorities"}
        onOpen={() =>
          setActiveItem(activeItem === "priorities" ? null : "priorities")
        }
      >
        <div className="flex flex-wrap gap-2">
          <ToggleButton
            checked={prioritizeFollowedArtists}
            onChange={setPrioritizeFollowedArtists}
            label="Artistas seguidos"
          />
          <ToggleButton
            checked={prioritizeTopTracks}
            onChange={setPrioritizeTopTracks}
            label="Top tracks"
          />
        </div>
        <ActionBar saving={busy} onSave={saveSettings} onCancel={resetDraft} />
      </SettingRow>

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
