"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LabelArtist, TrackParticipant } from "@/lib/label-os";

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

function sumPercent(
  participants: TrackParticipant[],
  field: keyof Pick<
    TrackParticipant,
    "royalty_percentage" | "publishing_percentage" | "master_percentage"
  >,
): number {
  return participants.reduce((acc, p) => acc + (Number(p[field]) || 0), 0);
}

export default function AddParticipantForm({
  trackId,
  artists,
  participants,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // live totals including what's already saved
  const [royalty, setRoyalty] = useState(0);
  const [publishing, setPublishing] = useState(0);
  const [master, setMaster] = useState(0);

  const savedRoyalty = sumPercent(participants, "royalty_percentage");
  const savedPublishing = sumPercent(participants, "publishing_percentage");
  const savedMaster = sumPercent(participants, "master_percentage");

  const previewRoyalty = savedRoyalty + royalty;
  const previewPublishing = savedPublishing + publishing;
  const previewMaster = savedMaster + master;

  const hasOverflow =
    previewRoyalty > 100 || previewPublishing > 100 || previewMaster > 100;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      royalty_percentage: Number(formData.get("royalty_percentage") ?? 0),
      publishing_percentage: Number(formData.get("publishing_percentage") ?? 0),
      master_percentage: Number(formData.get("master_percentage") ?? 0),
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
      // reset form
      (e.target as HTMLFormElement).reset();
      setRoyalty(0);
      setPublishing(0);
      setMaster(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

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
            className={`rounded-md px-3 py-2 text-center text-sm ${
              current > 100
                ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                : current === 100
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                  : "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            <div className="font-medium">{label}</div>
            <div className="text-lg font-semibold">{current}%</div>
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
              type="number"
              min={0}
              max={100}
              step={0.01}
              defaultValue={0}
              onChange={(e) => setRoyalty(Number(e.target.value) || 0)}
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
              type="number"
              min={0}
              max={100}
              step={0.01}
              defaultValue={0}
              onChange={(e) => setPublishing(Number(e.target.value) || 0)}
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
              type="number"
              min={0}
              max={100}
              step={0.01}
              defaultValue={0}
              onChange={(e) => setMaster(Number(e.target.value) || 0)}
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
