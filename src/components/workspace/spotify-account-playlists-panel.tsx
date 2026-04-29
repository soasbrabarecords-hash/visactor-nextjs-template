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
  User,
  X,
} from "lucide-react";
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

    const url = URL.createObjectURL(file);
    setCoverPreview(url);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
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
  const ownerName = playlists[0]?.ownerName ?? "CP no Beat";
  const publicPlaylists = playlists.filter((p) => p.isPublic);

  // Pick a cover from the first playlist with an image for the profile background
  const heroCover = playlists.find((p) => p.imageUrl)?.imageUrl ?? null;

  return (
    <>
      {showCreate && (
        <CreatePlaylistModal
          onClose={() => setShowCreate(false)}
          onCreated={loadPlaylists}
        />
      )}

      {/* ── Spotify profile-style header ── */}
      <div className="relative overflow-hidden border-b border-border" style={{ minHeight: "260px" }}>
        {/* Blurred background from first playlist cover */}
        {heroCover && (
          <div
            className="absolute inset-0 scale-110"
            style={{
              backgroundImage: `url(${heroCover})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
              filter: "blur(60px) brightness(0.25) saturate(1.3)",
            }}
          />
        )}
        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: heroCover
              ? "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.88) 100%)"
              : "linear-gradient(to bottom, hsl(var(--background) / 0.6), hsl(var(--background)))",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-end px-8 pb-8 pt-10 laptop:px-12">
          <div className="flex flex-col gap-6 laptop:flex-row laptop:items-end">

            {/* Avatar */}
            <div className="shrink-0">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-muted shadow-2xl ring-2 ring-white/10"
                style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
              >
                <User className="h-14 w-14 text-muted-foreground/50" />
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1 space-y-2 text-white">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
                Perfil
              </p>
              <h1
                className="font-bold leading-none tracking-tight"
                style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}
              >
                {ownerName}
              </h1>
              {data?.connected && (
                <div className="flex flex-wrap items-center gap-1 pt-1 text-sm opacity-80">
                  <span>
                    <span className="font-semibold">{formatCount(publicPlaylists.length)}</span>
                    {" "}playlists públicas
                  </span>
                  <span className="opacity-40">·</span>
                  <span>
                    <span className="font-semibold">—</span>
                    {" "}seguidores
                  </span>
                  <span className="opacity-40">·</span>
                  <span>
                    <span className="font-semibold">—</span>
                    {" "}seguindo
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-wrap gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-white/60 self-center" />}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadPlaylists}
                disabled={isPending}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </Button>
              {data?.connected ? (
                <>
                  <Button
                    size="sm"
                    className="bg-white text-black hover:bg-white/90"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nova playlist
                  </Button>
                  <Button asChild size="sm" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                    <a href="/api/spotify/auth/logout">
                      <LogOut className="h-3.5 w-3.5" />
                      Desconectar
                    </a>
                  </Button>
                </>
              ) : (
                <Button asChild size="sm" className="bg-white text-black hover:bg-white/90">
                  <a href="/api/spotify/auth/login">
                    <Music2 className="h-3.5 w-3.5" />
                    Conectar Spotify
                  </a>
                </Button>
              )}
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          {data && !data.connected && (
            <p className="mt-3 text-sm text-white/50">{data.message}</p>
          )}
        </div>
      </div>

      {/* ── Playlist cards — horizontal scroll ── */}
      <div className="border-b border-border px-8 py-6 laptop:px-12">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Playlists editáveis
            </div>
            <h2 className="mt-1 text-xl font-semibold">
              {data?.connected
                ? `${formatCount(playlists.length)} playlists`
                : "Aguardando conexão"}
            </h2>
          </div>
        </div>

        {playlists.length > 0 ? (
          <div
            className="flex gap-4 overflow-x-auto pb-3"
            style={{ scrollbarWidth: "thin" }}
          >
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="group flex w-44 shrink-0 flex-col rounded-2xl border border-border bg-card/70 p-3 transition-colors hover:bg-card"
              >
                {/* Cover */}
                <div
                  className="mb-3 h-36 w-full rounded-xl bg-muted shadow-md"
                  style={coverStyle(playlist.imageUrl)}
                >
                  {!playlist.imageUrl && (
                    <div className="flex h-full items-center justify-center">
                      <Music2 className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="truncate text-sm font-semibold leading-snug">
                    {playlist.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCount(playlist.tracksTotal)} faixas
                  </div>
                  {(playlist.isCollaborative || !playlist.isPublic) && (
                    <div className="pt-0.5">
                      <StatusBadge tone={playlist.isCollaborative ? "purple" : "slate"}>
                        {playlist.isCollaborative ? "Collab" : "Privada"}
                      </StatusBadge>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-1.5">
                  <Link
                    href={`/curadoria/playlists/${playlist.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background/60 py-1.5 text-xs font-medium text-primary hover:bg-muted/40"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Link>
                  <a
                    href={playlist.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
            {data?.connected
              ? "Nenhuma playlist encontrada nessa conta."
              : "Conecte o Spotify para listar somente playlists criadas por essa conta."}
          </div>
        )}
      </div>
    </>
  );
}
