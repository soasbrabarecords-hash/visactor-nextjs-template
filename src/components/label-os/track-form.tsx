"use client";

import {
  ArrowRight,
  Check,
  Disc3,
  FileAudio2,
  FileImage,
  FileText,
  Music4,
  Search,
  Users2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ChangeEvent, ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";
import EntityCombobox from "@/components/label-os/entity-combobox";
import type { LabelEntity } from "@/lib/label-entities-types";
import type { LabelArtist } from "@/lib/label-os-types";
import { uploadLabelOsFile } from "@/lib/label-os-upload-client";
import {
  formatPercentage,
  isPercentageEqual,
  parsePercentageInput,
  sumPercentages,
} from "@/lib/percentage";

const GENRE_GROUPS = [
  {
    value: "Pop",
    label: "Pop",
    subgenres: ["Dance Pop", "Teen Pop", "Latin Pop", "Indie Pop", "Synth Pop"],
  },
  {
    value: "Funk",
    label: "Funk",
    subgenres: [
      "Funk BR",
      "Funk Mandelão",
      "Funk Pop",
      "Funk Proibidão",
      "Funk Melody",
    ],
  },
  {
    value: "Hip-Hop/Rap",
    label: "Hip-Hop / Rap",
    subgenres: ["Trap", "Boom Bap", "Drill", "Rap Acústico", "Conscious Rap"],
  },
  {
    value: "R&B / Soul",
    label: "R&B / Soul",
    subgenres: ["Contemporary R&B", "Neo Soul", "Alt R&B", "Soul Pop"],
  },
  {
    value: "Eletrônico",
    label: "Eletrônico",
    subgenres: ["House", "Tech House", "Dance", "Afro House", "Phonk"],
  },
  {
    value: "Sertanejo",
    label: "Sertanejo",
    subgenres: ["Universitário", "Romântico", "Agronejo", "Sertanejo Pop"],
  },
  {
    value: "Pagode / Samba",
    label: "Pagode / Samba",
    subgenres: ["Pagode", "Samba", "Pagode Romântico", "Samba Pop"],
  },
  {
    value: "Forró",
    label: "Forró",
    subgenres: ["Piseiro", "Forró Eletrônico", "Xote", "Forronejo"],
  },
  {
    value: "Afro / Latin",
    label: "Afro / Latin",
    subgenres: ["Afrobeats", "Amapiano", "Reggaeton", "Latin Urban"],
  },
  {
    value: "Rock / Alternativo",
    label: "Rock / Alternativo",
    subgenres: ["Alt Rock", "Indie Rock", "Pop Rock", "Punk Rock"],
  },
] as const;

const FONOGRAMA_TARGETS = {
  interpretes: 41.7,
  produtores: 41.7,
  musicos: 16.6,
};

const INPUT_CLASS =
  "w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-sky-200/24 focus:bg-white/[0.055]";

type SplitRow = { entity: LabelEntity | null; pct: string };

type TrackData = {
  title: string;
  version: string;
  genre: string;
  subgenre: string;
  explicit: boolean;
  release_date: string;
  lyrics: string;
  coverFile: File | null;
  audioFile: File | null;
  contractFile: File | null;
};

type ArtistTag = {
  id: string;
  name: string;
  artistName: string;
};

type TrackFormProps = {
  artists: LabelArtist[];
};

function totalColor(total: number, target: number): string {
  if (total > target + 0.01) return "text-rose-300";
  if (isPercentageEqual(total, target)) return "text-sky-100";
  return "text-amber-200";
}

function totalBg(total: number, target: number): string {
  if (total > target + 0.01)
    return "border-rose-300/18 bg-rose-300/[0.08] text-rose-100";
  if (isPercentageEqual(total, target))
    return "border-sky-200/18 bg-sky-200/[0.08] text-sky-100";
  return "border-amber-200/18 bg-amber-200/[0.08] text-amber-100";
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.62),rgba(11,16,27,0.82))] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <Icon className="h-[18px] w-[18px] text-sky-100" />
        </div>
        <div>
          <div className="text-base font-semibold text-white">{title}</div>
          <div className="text-white/54 mt-1 text-sm">{description}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function StepIndicator({ current }: { current: number }) {
  const steps = [
    "Track",
    "Obra",
    "Fonograma",
    "Royalties",
    "Resumo e contrato",
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;

        return (
          <div key={label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition",
                  active
                    ? "border-sky-200/20 bg-sky-200/[0.1] text-white"
                    : done
                      ? "border-white/10 bg-white/[0.08] text-white"
                      : "text-white/42 border-white/10 bg-white/[0.03]",
                ].join(" ")}
              >
                {done ? <Check className="h-4 w-4" /> : step}
              </div>
              <div className="text-sm font-medium text-white/70">{label}</div>
            </div>
            {index < steps.length - 1 ? (
              <div className="h-px w-8 bg-white/10" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ArtistTagSelector({
  artists,
  selectedArtists,
  onChange,
}: {
  artists: LabelArtist[];
  selectedArtists: ArtistTag[];
  onChange: (artists: ArtistTag[]) => void;
}) {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return artists
      .filter((artist) => {
        const artistName = artist.artist_name ?? artist.name;
        return (
          artistName.toLowerCase().includes(normalized) ||
          artist.name.toLowerCase().includes(normalized)
        );
      })
      .filter(
        (artist) =>
          !selectedArtists.some((selected) => selected.id === artist.id),
      )
      .slice(0, 8)
      .map((artist) => ({
        id: artist.id,
        name: artist.name,
        artistName: artist.artist_name ?? artist.name,
      }));
  }, [artists, query, selectedArtists]);

  function addArtist(artist: ArtistTag) {
    onChange([...selectedArtists, artist]);
    setQuery("");
  }

  function removeArtist(id: string) {
    onChange(selectedArtists.filter((artist) => artist.id !== id));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    if (options.length > 0) {
      addArtist(options[0]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium text-white">Artistas</label>
        <div className="text-white/52 text-sm">
          Digite para buscar no banco de artistas e confirme com Enter.
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
        <div className="flex flex-wrap gap-2">
          {selectedArtists.map((artist) => (
            <span
              key={artist.id}
              className="border-sky-200/16 inline-flex items-center gap-2 rounded-full border bg-sky-200/[0.08] px-3 py-2 text-sm font-medium text-sky-50"
            >
              {artist.artistName}
              <button
                type="button"
                onClick={() => removeArtist(artist.id)}
                className="rounded-full text-sky-100/70 transition hover:text-white"
                aria-label={`Remover ${artist.artistName}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}

          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar artista cadastrado..."
              className="placeholder:text-white/28 focus:border-sky-200/24 w-full rounded-2xl border border-white/10 bg-white/[0.035] py-3 pl-10 pr-4 text-sm text-white outline-none focus:bg-white/[0.055]"
            />
          </div>
        </div>

        {query.trim() ? (
          <div className="mt-3 rounded-[18px] border border-white/10 bg-black/15 p-2">
            {options.length > 0 ? (
              <div className="space-y-1">
                {options.map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    onClick={() => addArtist(artist)}
                    className="text-white/82 flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition hover:bg-white/[0.06]"
                  >
                    <span>{artist.artistName}</span>
                    {artist.name !== artist.artistName ? (
                      <span className="text-white/38 text-xs">
                        {artist.name}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-white/45">
                Nenhum artista encontrado.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SplitEditor({
  rows,
  onChange,
  target,
  label,
}: {
  rows: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
  target: number;
  label: string;
}) {
  const total = sumPercentages(rows.map((row) => row.pct));

  function addRow() {
    onChange([...rows, { entity: null, pct: "0" }]);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateEntity(index: number, entity: LabelEntity | null) {
    onChange(
      rows.map((row, currentIndex) =>
        currentIndex === index ? { ...row, entity } : row,
      ),
    );
  }

  function updatePct(index: number, pct: string) {
    onChange(
      rows.map((row, currentIndex) =>
        currentIndex === index ? { ...row, pct } : row,
      ),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className={`text-sm font-semibold ${totalColor(total, target)}`}>
          {formatPercentage(total)} / {formatPercentage(target)}
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={`${label}-${index}`}
            className="flex flex-col gap-2 rounded-[22px] border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center"
          >
            <div className="flex-1">
              <EntityCombobox
                value={row.entity}
                onChange={(entity) => updateEntity(index, entity)}
                placeholder="Buscar entidade..."
              />
            </div>
            <div className="relative w-full sm:w-32">
              <input
                type="text"
                inputMode="decimal"
                value={row.pct}
                onChange={(event) => updatePct(index, event.target.value)}
                placeholder="0"
                className={INPUT_CLASS}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/35">
                %
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="text-white/64 inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm font-medium transition hover:bg-white/[0.06] hover:text-white"
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="border-white/12 text-white/78 inline-flex h-10 items-center rounded-full border bg-white/[0.04] px-4 text-sm font-medium transition hover:bg-white/[0.07] hover:text-white"
      >
        + Adicionar linha
      </button>
    </div>
  );
}

export default function TrackForm({ artists }: TrackFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArtists, setSelectedArtists] = useState<ArtistTag[]>([]);

  const [trackData, setTrackData] = useState<TrackData>({
    title: "",
    version: "",
    genre: "",
    subgenre: "",
    explicit: false,
    release_date: "",
    lyrics: "",
    coverFile: null,
    audioFile: null,
    contractFile: null,
  });

  const [obraRows, setObraRows] = useState<SplitRow[]>([
    { entity: null, pct: "0" },
  ]);
  const [interpretes, setInterpretes] = useState<SplitRow[]>([
    { entity: null, pct: "0" },
  ]);
  const [produtores, setProdutores] = useState<SplitRow[]>([
    { entity: null, pct: "0" },
  ]);
  const [musicos, setMusicos] = useState<SplitRow[]>([
    { entity: null, pct: "0" },
  ]);
  const [royaltyRows, setRoyaltyRows] = useState<SplitRow[]>([
    { entity: null, pct: "0" },
  ]);

  const selectedGenre = useMemo(
    () => GENRE_GROUPS.find((group) => group.value === trackData.genre) ?? null,
    [trackData.genre],
  );

  const coverPreviewUrl = useMemo(
    () =>
      trackData.coverFile ? URL.createObjectURL(trackData.coverFile) : null,
    [trackData.coverFile],
  );

  const audioPreviewUrl = useMemo(
    () =>
      trackData.audioFile ? URL.createObjectURL(trackData.audioFile) : null,
    [trackData.audioFile],
  );

  function updateFile(
    key: "coverFile" | "audioFile" | "contractFile",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null;
    setTrackData((current) => ({ ...current, [key]: file }));
  }

  function validateStep1(): string | null {
    if (!trackData.title.trim()) return "Título da música é obrigatório.";
    if (selectedArtists.length === 0) return "Selecione pelo menos um artista.";
    if (!trackData.genre) return "Selecione o gênero principal.";
    if (!trackData.subgenre) return "Selecione o subgênero.";
    return null;
  }

  function validateStep2(): string | null {
    if (obraRows.some((row) => !row.entity)) {
      return "Selecione uma entidade em todos os campos de Obra.";
    }
    const total = sumPercentages(obraRows.map((row) => row.pct));
    if (!isPercentageEqual(total, 100)) {
      return `Obra: soma deve ser 100% (atual: ${formatPercentage(total)}).`;
    }
    return null;
  }

  function validateStep3(): string | null {
    const groups: [string, SplitRow[], number][] = [
      ["Intérpretes", interpretes, FONOGRAMA_TARGETS.interpretes],
      ["Produtores fonográficos", produtores, FONOGRAMA_TARGETS.produtores],
      ["Músicos", musicos, FONOGRAMA_TARGETS.musicos],
    ];

    for (const [name, rows, target] of groups) {
      if (rows.some((row) => !row.entity)) {
        return `Selecione uma entidade em todos os campos de ${name}.`;
      }
      const total = sumPercentages(rows.map((row) => row.pct));
      if (!isPercentageEqual(total, target)) {
        return `${name}: soma deve ser ${formatPercentage(target)} (atual: ${formatPercentage(total)}).`;
      }
    }

    return null;
  }

  function validateStep4(): string | null {
    if (royaltyRows.some((row) => !row.entity)) {
      return "Selecione uma entidade em todos os campos de Royalties Share.";
    }
    const total = sumPercentages(royaltyRows.map((row) => row.pct));
    if (!isPercentageEqual(total, 100)) {
      return `Royalties Share: soma deve ser 100% (atual: ${formatPercentage(total)}).`;
    }
    return null;
  }

  function goNext() {
    const validator =
      step === 1 ? validateStep1 : step === 2 ? validateStep2 : validateStep3;
    const message = validator();
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((current) => current + 1);
  }

  function goBack() {
    setError(null);
    setStep((current) => current - 1);
  }

  async function handleSubmit() {
    const message = validateStep4();
    if (message) {
      setError(message);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const coverUrl = await uploadLabelOsFile(
        trackData.coverFile,
        "label-covers",
      );
      const audioUrl = await uploadLabelOsFile(
        trackData.audioFile,
        "label-audio",
      );
      const contractUrl = await uploadLabelOsFile(
        trackData.contractFile,
        "label-contracts",
      );

      const trackRes = await fetch("/api/label-os/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trackData.title,
          version: trackData.version || null,
          genre: trackData.genre || null,
          subgenre: trackData.subgenre || null,
          bpm: null,
          key: null,
          explicit: trackData.explicit,
          release_date: trackData.release_date || null,
          notes: null,
          lyrics: trackData.lyrics || null,
          status: "draft",
          cover_url: coverUrl,
          audio_url: audioUrl,
          contract_url: contractUrl,
          isrc: null,
          upc: null,
        }),
      });

      if (!trackRes.ok) {
        throw new Error(await readApiError(trackRes, "Erro ao salvar track."));
      }

      const track = (await trackRes.json()) as { id: string };
      const trackId = track.id;

      const participants = [
        ...selectedArtists.map((artist) => ({
          track_id: trackId,
          artist_id: artist.id,
          entity_id: null,
          role: "main_artist",
          royalty_percentage: 0,
          publishing_percentage: 0,
          master_percentage: 0,
        })),
        ...obraRows.map((row) => ({
          track_id: trackId,
          entity_id: row.entity!.id,
          artist_id: null,
          role: "composer",
          royalty_percentage: 0,
          publishing_percentage: parsePercentageInput(row.pct),
          master_percentage: 0,
        })),
        ...interpretes.map((row) => ({
          track_id: trackId,
          entity_id: row.entity!.id,
          artist_id: null,
          role: "main_artist",
          royalty_percentage: 0,
          publishing_percentage: 0,
          master_percentage: parsePercentageInput(row.pct),
        })),
        ...produtores.map((row) => ({
          track_id: trackId,
          entity_id: row.entity!.id,
          artist_id: null,
          role: "producer",
          royalty_percentage: 0,
          publishing_percentage: 0,
          master_percentage: parsePercentageInput(row.pct),
        })),
        ...musicos.map((row) => ({
          track_id: trackId,
          entity_id: row.entity!.id,
          artist_id: null,
          role: "other",
          royalty_percentage: 0,
          publishing_percentage: 0,
          master_percentage: parsePercentageInput(row.pct),
        })),
        ...royaltyRows.map((row) => ({
          track_id: trackId,
          entity_id: row.entity!.id,
          artist_id: null,
          role: "label",
          royalty_percentage: parsePercentageInput(row.pct),
          publishing_percentage: 0,
          master_percentage: 0,
        })),
      ];

      const participantResponses = await Promise.all(
        participants.map(async (participant) => {
          const response = await fetch(
            `/api/label-os/tracks/${trackId}/participants`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(participant),
            },
          );

          if (!response.ok) {
            throw new Error(
              await readApiError(
                response,
                "Erro ao salvar participantes da track.",
              ),
            );
          }

          return response;
        }),
      );

      void participantResponses;

      router.push(`/label-os/tracks/${trackId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  const buttonPrimary =
    "inline-flex h-11 items-center rounded-full bg-[linear-gradient(180deg,#f6f8fb,#dbe7ff)] px-5 text-sm font-medium text-slate-900 transition hover:bg-[linear-gradient(180deg,#ffffff,#e3ecff)] disabled:opacity-60";
  const buttonSecondary =
    "inline-flex h-11 items-center rounded-full border border-white/12 bg-white/5 px-5 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white";

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {error ? (
        <div className="border-rose-300/18 rounded-2xl border bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.72),rgba(11,16,27,0.88))] shadow-[0_24px_120px_rgba(0,0,0,0.26)] backdrop-blur-xl">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.14),transparent_44%),radial-gradient(circle_at_top_right,rgba(196,181,253,0.12),transparent_42%)] px-6 py-6">
            <div className="text-white/42 text-xs uppercase tracking-[0.2em]">
              Dados principais
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Cadastro claro da track.
            </h2>
            <p className="text-white/56 mt-2 max-w-2xl text-sm leading-6">
              Título, versão, artistas, gênero, capa e áudio em uma primeira
              leitura mais limpa.
            </p>
          </div>

          <div className="grid gap-5 p-6 laptop:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-5">
              <Section
                icon={FileImage}
                title="Capa da faixa"
                description="A arte fica visível logo no topo e acompanha a leitura do cadastro."
              >
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03]">
                    {coverPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverPreviewUrl}
                        alt={trackData.title || "Preview da capa"}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]">
                        <div className="text-center text-white/40">
                          <FileImage className="mx-auto h-10 w-10" />
                          <div className="mt-3 text-sm">Preview da capa</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white">
                      Selecionar capa
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => updateFile("coverFile", event)}
                      className="text-white/58 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2.5 file:font-medium file:text-white"
                    />
                  </label>
                </div>
              </Section>

              <Section
                icon={FileAudio2}
                title="Áudio"
                description="Suba o WAV ou MP3 e confira o preview antes de seguir."
              >
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white">
                      Selecionar áudio
                    </span>
                    <input
                      type="file"
                      accept="audio/wav,audio/mpeg,audio/mp3"
                      onChange={(event) => updateFile("audioFile", event)}
                      className="text-white/58 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2.5 file:font-medium file:text-white"
                    />
                  </label>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    {audioPreviewUrl ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio
                        controls
                        src={audioPreviewUrl}
                        className="w-full"
                      />
                    ) : (
                      <div className="text-white/42 text-sm">
                        Preview do áudio aparece aqui.
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            </div>

            <div className="space-y-5">
              <Section
                icon={Music4}
                title="Identidade da faixa"
                description="Os campos que realmente importam para subir um lançamento com leitura rápida."
              >
                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
                    <div className="flex flex-col gap-2">
                      <label
                        className="text-sm font-medium text-white"
                        htmlFor="track-title"
                      >
                        Título da música{" "}
                        <span className="ml-1 text-sky-200">*</span>
                      </label>
                      <input
                        id="track-title"
                        type="text"
                        value={trackData.title}
                        onChange={(event) =>
                          setTrackData((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Nome da faixa"
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label
                        className="text-sm font-medium text-white"
                        htmlFor="track-version"
                      >
                        Versão
                      </label>
                      <input
                        id="track-version"
                        type="text"
                        value={trackData.version}
                        onChange={(event) =>
                          setTrackData((current) => ({
                            ...current,
                            version: event.target.value,
                          }))
                        }
                        placeholder="Radio Edit, Remix, Ao Vivo..."
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <ArtistTagSelector
                    artists={artists}
                    selectedArtists={selectedArtists}
                    onChange={setSelectedArtists}
                  />
                </div>
              </Section>

              <Section
                icon={Disc3}
                title="Classificação"
                description="Padrão com gênero e subgênero para a faixa entrar no sistema de forma mais organizada."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label
                      className="text-sm font-medium text-white"
                      htmlFor="track-genre"
                    >
                      Gênero
                    </label>
                    <select
                      id="track-genre"
                      value={trackData.genre}
                      onChange={(event) =>
                        setTrackData((current) => ({
                          ...current,
                          genre: event.target.value,
                          subgenre: "",
                        }))
                      }
                      className={INPUT_CLASS}
                    >
                      <option value="" className="bg-slate-950 text-white">
                        Selecionar gênero
                      </option>
                      {GENRE_GROUPS.map((genre) => (
                        <option
                          key={genre.value}
                          value={genre.value}
                          className="bg-slate-950 text-white"
                        >
                          {genre.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      className="text-sm font-medium text-white"
                      htmlFor="track-subgenre"
                    >
                      Subgênero
                    </label>
                    <select
                      id="track-subgenre"
                      value={trackData.subgenre}
                      onChange={(event) =>
                        setTrackData((current) => ({
                          ...current,
                          subgenre: event.target.value,
                        }))
                      }
                      disabled={!selectedGenre}
                      className={INPUT_CLASS}
                    >
                      <option value="" className="bg-slate-950 text-white">
                        {selectedGenre
                          ? "Selecionar subgênero"
                          : "Escolha o gênero primeiro"}
                      </option>
                      {(selectedGenre?.subgenres ?? []).map((subgenre) => (
                        <option
                          key={subgenre}
                          value={subgenre}
                          className="bg-slate-950 text-white"
                        >
                          {subgenre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      className="text-sm font-medium text-white"
                      htmlFor="track-release-date"
                    >
                      Data de lançamento
                    </label>
                    <input
                      id="track-release-date"
                      type="date"
                      value={trackData.release_date}
                      onChange={(event) =>
                        setTrackData((current) => ({
                          ...current,
                          release_date: event.target.value,
                        }))
                      }
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="inline-flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white">
                      <input
                        type="checkbox"
                        checked={trackData.explicit}
                        onChange={(event) =>
                          setTrackData((current) => ({
                            ...current,
                            explicit: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-white/15 bg-transparent"
                      />
                      Conteúdo explícito
                    </label>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <Section
          icon={FileText}
          title="Obra"
          description="Letra da música e composição editorial. A soma da obra precisa fechar em 100%."
        >
          <div className="space-y-5">
            <div className="text-white/58 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
              Preencha a letra e distribua 100% da obra entre os compositores.
            </div>
            <div className="flex flex-col gap-2">
              <label
                className="text-sm font-medium text-white"
                htmlFor="track-lyrics"
              >
                Letra da música
              </label>
              <textarea
                id="track-lyrics"
                rows={10}
                value={trackData.lyrics}
                onChange={(event) =>
                  setTrackData((current) => ({
                    ...current,
                    lyrics: event.target.value,
                  }))
                }
                placeholder="Cole ou escreva a letra completa aqui..."
                className={INPUT_CLASS}
              />
            </div>
            <SplitEditor
              rows={obraRows}
              onChange={setObraRows}
              target={100}
              label="Compositores"
            />
          </div>
        </Section>
      ) : null}

      {step === 3 ? (
        <Section
          icon={Users2}
          title="Fonograma"
          description="Distribua o fonograma entre intérpretes, produtores fonográficos e músicos com os alvos fixos."
        >
          <div className="space-y-5">
            <div className="text-white/58 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
              Intérpretes 41,70% · Produtores 41,70% · Músicos 16,60%.
            </div>

            <div
              className={`rounded-[22px] border px-4 py-3 text-sm font-semibold ${totalBg(
                sumPercentages([
                  ...interpretes.map((row) => row.pct),
                  ...produtores.map((row) => row.pct),
                  ...musicos.map((row) => row.pct),
                ]),
                100,
              )}`}
            >
              Total fonograma:{" "}
              {formatPercentage(
                sumPercentages([
                  ...interpretes.map((row) => row.pct),
                  ...produtores.map((row) => row.pct),
                  ...musicos.map((row) => row.pct),
                ]),
              )}{" "}
              / 100%
            </div>

            <SplitEditor
              rows={interpretes}
              onChange={setInterpretes}
              target={FONOGRAMA_TARGETS.interpretes}
              label="Intérpretes"
            />
            <SplitEditor
              rows={produtores}
              onChange={setProdutores}
              target={FONOGRAMA_TARGETS.produtores}
              label="Produtores fonográficos"
            />
            <SplitEditor
              rows={musicos}
              onChange={setMusicos}
              target={FONOGRAMA_TARGETS.musicos}
              label="Músicos"
            />
          </div>
        </Section>
      ) : null}

      {step === 4 ? (
        <Section
          icon={Disc3}
          title="Royalties Share"
          description="Distribua 100% dos royalties share entre os envolvidos antes de salvar a track."
        >
          <div className="space-y-5">
            <div className="text-white/58 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
              A soma precisa fechar em 100%.
            </div>
            <SplitEditor
              rows={royaltyRows}
              onChange={setRoyaltyRows}
              target={100}
              label="Royalties Share"
            />
          </div>
        </Section>
      ) : null}

      <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
        {step > 1 ? (
          <button type="button" onClick={goBack} className={buttonSecondary}>
            Voltar
          </button>
        ) : null}

        {step < 4 ? (
          <button type="button" onClick={goNext} className={buttonPrimary}>
            Próximo
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={buttonPrimary}
          >
            {loading ? "Salvando..." : "Salvar e revisar contrato"}
          </button>
        )}

        {step === 1 ? (
          <button
            type="button"
            onClick={() => router.back()}
            className={buttonSecondary}
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
