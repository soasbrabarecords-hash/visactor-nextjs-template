"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LabelArtist, TrackParticipant } from "@/lib/label-os";
import {
  parsePercentageInput,
  formatPercentage,
  sumPercentages,
  isPercentageEqual,
} from "@/lib/percentage";

const ROLES: { value: string; label: string }[] = [
  { value: "main_artist", label: "Artista Principal" },
  { value: "featured_artist", label: "Artista Feat." },
  { value: "producer", label: "Produtor" },
  { value: "composer", label: "Compositor" },
  { value: "label", label: "Gravadora" },
  { value: "publisher", label: "Publisher" },
  { value: "manager", label: "Manager" },
  { value: "other", label: "Outro" },
];

type Props = {
  trackId: string;
  artists: LabelArtist[];
  participants: TrackParticipant[];
};

function sumField(
  participants: TrackParticipant[],
  field: keyof Pick<
    TrackParticipant,
    "royalty_percentage" | "publishing_percentage" | "master_percentage"
  >,
): number {
  return sumPercentages(participants.map((p) => p[field]));
}

function totalColor(total: number): string {
  if (isPercentageEqual(total, 100)) return "text-green-700 dark:text-green-400";
  if (total > 100) return "text-red-700 dark:text-red-400";
  return "text-slate-600 dark:text-slate-400";
}

function totalBg(total: number): string {
  if (isPercentageEqual(total, 100)) return "bg-green-50 dark:bg-green-950";
  if (total > 100) return "bg-red-50 dark:bg-red-950";
  return "bg-slate-50 dark:bg-slate-800";
}

export default function AddParticipantForm({
  trackId,
  artists,
  participants,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // string state to allow comma/dot while typing
  const [royalty, setRoyalty] = useState("0");
  const [publishing, setPublishing] = useState("0");
  const [master, setMaster] = useState("0");

  const savedRoyalty = sumField(participants, "royalty_percentage");
  const savedPublishing = sumField(participants, "publishing_percentage");
  const savedMaster = sumField(participants, "master_percentage");

  const previewRoyalty = sumPercentages([savedRoyalty, royalty]);
  const previewPublishing = sumPercentages([savedPublishing, publishing]);
  const previewMaster = sumPercentages([savedMaster, master]);

  const hasOverflow =
    previewRoyalty > 100 + 0.01 ||
    previewPublishing > 100 + 0.01 ||
    previewMaster > 100 + 0.01;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (hasOverflow) {
      setError("A soma de alguma porcentagem ultrapassa 100%. Corrija antes de salvar.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const body = {
      artist_id: formData.get("artist_id") as string,
      role: formData.get("role") as string,
      royalty_percentage: parsePercentageInput(royalty),
      publishing_percentage: parsePercentageInput(publishing),
      master_percentage: parsePercentageInput(master),
    };

    try {
      const res = await fetch(`/api/label-os/tracks/${trackId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Erro ao adicionar participante.");
      }

      router.refresh();
      (e.target as HTMLFormElement).reset();
      setRoyalty("0");
      setPublishing("0");
      setMaster("0");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">Adicionar participante</h3>

      {/* Totais acumulados */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {(
          [
            { label: "Royalties", current: previewRoyalty },
            { label: "Publishing", current: previewPublishing },
            { label: "Master", current: previewMaster },
          ] as const
        ).map(({ label, current }) => (
          <div
            key={label}
            className={`rounded-md px-3 py-2 text-center text-sm ${totalBg(current)}`}
          >
            <div className={`font-medium ${totalColor(current)}`}>{label}</div>
            <div className={`text-lg font-semibold ${totalColor(current)}`}>
              {formatPercentage(current)}
            </div>
          </div>
        ))}
      </div>

      {hasOverflow && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          ⚠️ A soma ultrapassa 100% em um ou mais campos. Ajuste as porcentagens.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Artista */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="artist_id">
              Artista <span className="text-red-500">*</span>
            </label>
            <select
              id="artist_id"
              name="artist_id"
              required
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
            >
              <option value="">Selecione...</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.artist_name ?? a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="role">
              Papel <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              name="role"
              required
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
            >
              <option value="">Selecione...</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Porcentagens */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="royalty_percentage">
              Royalties %
            </label>
            <input
              id="royalty_percentage"
              name="royalty_percentage"
              type="text"
              inputMode="decimal"
              value={royalty}
              onChange={(e) => setRoyalty(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="publishing_percentage">
              Publishing %
            </label>
            <input
              id="publishing_percentage"
              name="publishing_percentage"
              type="text"
              inputMode="decimal"
              value={publishing}
              onChange={(e) => setPublishing(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="master_percentage">
              Master %
            </label>
            <input
              id="master_percentage"
              name="master_percentage"
              type="text"
              inputMode="decimal"
              value={master}
              onChange={(e) => setMaster(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading || hasOverflow}
            className="rounded-md bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            {loading ? "Adicionando..." : "Adicionar participante"}
          </button>
        </div>
      </form>
    </div>
  );
}
