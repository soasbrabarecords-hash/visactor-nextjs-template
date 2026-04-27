"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Loader2,
  LogOut,
  Music2,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import StatusBadge from "./status-badge";

type SpotifyAccountPlaylist = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  imageUrl: string | null;
  tracksTotal: number;
  spotifyUrl: string;
  isPublic: boolean;
  isCollaborative: boolean;
};

type SpotifyPlaylistsResponse =
  | { connected: true; playlists: SpotifyAccountPlaylist[] }
  | { connected: false; playlists: []; message: string };

function coverStyle(coverUrl: string | null) {
  if (!coverUrl) return undefined;
  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

// ---------------------------------------------------------------------------
// Modal criar playlist
// ---------------------------------------------------------------------------
function CreatePlaylistModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverBase64, setCoverBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const url = URL.createObjectURL(file);
    setCoverPreview(url);

    // Convert to base64 JPEG for Spotify API
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix — Spotify expects raw base64
      const b64 = result.replace(/^data:image\/[a-z]+;base64,/, "");
      setCoverBase64(b64);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/spotify/playlists/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isPublic, coverBase64 }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Erro ao criar playlist.");
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar playlist.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Nova playlist</div>
          <h2 className="mt-1 text-xl font-semibold">Criar playlist no Spotify</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Capa */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Capa
            </label>
            <div className="flex items-center gap-4">
              <div
                className="h-20 w-20 shrink-0 cursor-pointer rounded-xl border border-border bg-muted"
                style={coverPreview ? { backgroundImage: `url(${coverPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                onClick={() => fileRef.current?.click()}
              >
                {!coverPreview && (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Plus className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => fileRef.current?.click()}
                >
                  Escolher imagem
                </button>
                <br />
                JPG ou PNG, mínimo 300×300px
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Nome <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: FUNK 2026 SÓ AS BRABA"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Público / Privado */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                isPublic
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/30"
              }`}
            >
              Pública
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                !isPublic
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/30"
              }`}
            >
              Privada
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={saving || !name.trim()} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar playlist"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export default function SpotifyAccountPlaylistsPanel({
  eyebrow = "Spotify na curadoria",
  title = "Playlists da conta",
  description = "Conecte o Spotify para puxar suas playlists e usar o Radar Music como base de decisao editorial.",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  const [data, setData] = useState<SpotifyPlaylistsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);

  const loadPlaylists = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const response = await fetch("/api/spotify/me/playlists", { cache: "no-store" });
        if (!response.ok) throw new Error("Nao foi possivel carregar as playlists do Spotify.");
        const payload = (await response.json()) as SpotifyPlaylistsResponse;
        setData(payload);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Nao foi possivel carregar as playlists do Spotify.",
        );
      }
    });
  }, [startTransition]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const playlists = data?.connected ? data.playlists : [];

  return (
    <>
      {showCreate && (
        <CreatePlaylistModal
          onClose={() => setShowCreate(false)}
          onCreated={loadPlaylists}
        />
      )}

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 laptop:grid-cols-[0.9fr_1.1fr]">
          {/* Login card */}
          <article className="rounded-2xl border border-border bg-card/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {eyebrow}
                </div>
                <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              </div>
              <StatusBadge tone={data?.connected ? "green" : "blue"}>
                {data?.connected ? "Conectado" : "Conectar"}
              </StatusBadge>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild>
                <a href="/api/spotify/auth/login">
                  <Music2 className="h-4 w-4" />
                  Conectar Spotify
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={loadPlaylists} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar
              </Button>
              {data?.connected && (
                <Button asChild variant="outline">
                  <a href="/api/spotify/auth/logout">
                    <LogOut className="h-4 w-4" />
                    Desconectar
                  </a>
                </Button>
              )}
            </div>

            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
            {data && !data.connected && (
              <p className="mt-4 text-sm text-muted-foreground">{data.message}</p>
            )}
          </article>

          {/* Playlists card */}
          <article className="rounded-2xl border border-border bg-card/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Playlists editaveis
                </div>
                <h3 className="mt-2 text-xl font-semibold">
                  {data?.connected
                    ? `${formatCount(playlists.length)} playlists proprias`
                    : "Aguardando conexao"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {data?.connected && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Nova playlist
                  </Button>
                )}
              </div>
            </div>

            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {playlists.length > 0 ? (
                playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/40 px-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="h-12 w-12 shrink-0 rounded-lg bg-muted"
                        style={coverStyle(playlist.imageUrl)}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{playlist.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCount(playlist.tracksTotal)} tracks · {playlist.ownerName}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {playlist.isCollaborative ? (
                        <StatusBadge tone="purple">Collab</StatusBadge>
                      ) : playlist.isPublic ? (
                        <StatusBadge tone="green">Publica</StatusBadge>
                      ) : (
                        <StatusBadge tone="slate">Privada</StatusBadge>
                      )}
                      <Link
                        href={`/curadoria/playlists/${playlist.id}`}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-primary hover:bg-muted/40"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Link>
                      <Link
                        href={playlist.spotifyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-primary hover:bg-muted/40"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-border bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
                  Conecte o Spotify para listar somente playlists criadas por essa conta.
                </div>
              )}
            </div>
          </article>
        </div>
      </Container>
    </>
  );
}
