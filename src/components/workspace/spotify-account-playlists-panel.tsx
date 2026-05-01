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
import {
  getSpotifyAccountPlaylistsClient,
  invalidateSpotifyAccountPlaylistsClientCache,
  type SpotifyAccountPlaylistClient,
  type SpotifyPlaylistsClientResponse,
} from "@/lib/spotify-account-playlists-client";
import StatusBadge from "./status-badge";

type SpotifyAccountPlaylist = SpotifyAccountPlaylistClient & {
  ownerId: string;
  ownerName: string;
  spotifyUrl: string;
  isPublic: boolean;
  isCollaborative: boolean;
};

type SpotifyPlaylistsResponse = SpotifyPlaylistsClientResponse;

function coverStyle(coverUrl: string | null): React.CSSProperties | undefined {
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
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <div className="mb-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Nova playlist</div>
          <h2 className="mt-1 text-xl font-semibold">Criar playlist no Spotify</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Capa</label>
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
                <button type="button" className="text-primary underline" onClick={() => fileRef.current?.click()}>
                  Escolher imagem
                </button>
                <br />JPG ou PNG, mínimo 300×300px
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Nome <span className="text-red-400">*</span>
            </label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex: FUNK 2026 SÓ AS BRABA"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Descrição</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional" rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setIsPublic(true)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${isPublic ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/30"}`}>
              Pública
            </button>
            <button type="button" onClick={() => setIsPublic(false)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${!isPublic ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/30"}`}>
              Privada
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={saving || !name.trim()} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar playlist"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export default function SpotifyAccountPlaylistsPanel() {
  const [data, setData] = useState<SpotifyPlaylistsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);

  const loadPlaylists = useCallback((force = false) => {
    startTransition(async () => {
      setError(null);
      try {
        const payload = await getSpotifyAccountPlaylistsClient({ force });
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

  // Use multiple covers as mosaic for the blurred background
  const covers = playlists.filter((p) => p.imageUrl).slice(0, 4).map((p) => p.imageUrl!);
  const heroCover = covers[0] ?? null;

  return (
    <>
      {showCreate && (
        <CreatePlaylistModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            invalidateSpotifyAccountPlaylistsClientCache();
            loadPlaylists(true);
          }}
        />
      )}

      {/* ── HERO: Spotify profile style ── */}
      <div
        className="relative overflow-hidden"
        style={{ minHeight: "340px" }}
      >
        {/* Blurred cover mosaic background */}
        {heroCover ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${heroCover})`,
              backgroundPosition: "center top",
              backgroundSize: "cover",
              filter: "blur(80px) brightness(0.2) saturate(1.5)",
              transform: "scale(1.15)",
            }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            }}
          />
        )}

        {/* Gradient overlay — sempre presente */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.82) 100%)",
          }}
        />

        {/* Profile content — alinhado ao fundo como Spotify */}
        <div
          className="relative z-10 flex flex-col justify-end px-8 pb-10 pt-16 laptop:px-14"
          style={{ minHeight: "340px" }}
        >
          <div className="flex flex-col gap-5 laptop:flex-row laptop:items-end">

            {/* Avatar circular grande */}
            <div className="shrink-0">
              <div
                className="flex items-center justify-center rounded-full bg-muted"
                style={{
                  width: 148,
                  height: 148,
                  boxShadow: "0 12px 48px rgba(0,0,0,0.7)",
                  border: "3px solid rgba(255,255,255,0.08)",
                }}
              >
                <User style={{ width: 72, height: 72, opacity: 0.45, color: "white" }} />
              </div>
            </div>

            {/* Info: label + nome + metadata */}
            <div className="flex-1 min-w-0" style={{ color: "white" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7, marginBottom: 6 }}>
                Perfil
              </p>
              <h1
                style={{
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  fontSize: "clamp(2.8rem, 7vw, 5rem)",
                  marginBottom: 12,
                }}
              >
                {ownerName}
              </h1>
              {data?.connected ? (
                <p style={{ fontSize: 14, opacity: 0.75, display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
                  <strong>{formatCount(publicPlaylists.length)}</strong> playlists públicas
                  <span style={{ opacity: 0.4 }}>·</span>
                  <strong>—</strong> seguidores
                  <span style={{ opacity: 0.4 }}>·</span>
                  <strong>—</strong> seguindo
                </p>
              ) : (
                <p style={{ fontSize: 14, opacity: 0.6 }}>
                  Conecte o Spotify para ver suas playlists aqui.
                </p>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "rgba(255,255,255,0.5)" }} />}
              {data?.connected ? (
                <>
                  <button
                    onClick={() => setShowCreate(true)}
                    style={{
                      background: "white",
                      color: "black",
                      fontWeight: 700,
                      fontSize: 13,
                      padding: "8px 20px",
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plus style={{ width: 14, height: 14 }} />
                    Nova playlist
                  </button>
                  <button
                    onClick={() => {
                      invalidateSpotifyAccountPlaylistsClientCache();
                      loadPlaylists(true);
                    }}
                    disabled={isPending}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      color: "white",
                      fontWeight: 600,
                      fontSize: 13,
                      padding: "8px 16px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.2)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <RefreshCw style={{ width: 13, height: 13 }} />
                    Atualizar
                  </button>
                  <a
                    href="/api/spotify/auth/logout"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.7)",
                      fontWeight: 600,
                      fontSize: 13,
                      padding: "8px 16px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      textDecoration: "none",
                    }}
                  >
                    <LogOut style={{ width: 13, height: 13 }} />
                    Desconectar
                  </a>
                </>
              ) : (
                <a
                  href="/api/spotify/auth/login"
                  style={{
                    background: "#1DB954",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 14,
                    padding: "10px 24px",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textDecoration: "none",
                  }}
                >
                  <Music2 style={{ width: 16, height: 16 }} />
                  Conectar Spotify
                </a>
              )}
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          {data && !data.connected && (
            <p style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{data.message}</p>
          )}
        </div>
      </div>

      {/* ── Gradient fade — hero para fundo da página ── */}
      <div
        style={{
          height: 40,
          marginTop: -1,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Seção: Playlists públicas ── */}
      <div className="px-8 pb-8 pt-4 laptop:px-14">
        {/* Header da seção */}
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {data?.connected ? "Playlists públicas" : "Playlists"}
            </h2>
            {data?.connected && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatCount(playlists.length)} playlists · somente as criadas por esta conta
              </p>
            )}
          </div>
          {data?.connected && (
            <Link
              href="#"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.preventDefault(); }}
            >
              Ver todas
            </Link>
          )}
        </div>

        {playlists.length > 0 ? (
          /* Scroll horizontal de cards estilo Spotify */
          <div
            className="flex gap-5 overflow-x-auto pb-4"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
          >
            {playlists.map((playlist) => (
              <Link
                key={playlist.id}
                href={`/curadoria/playlists/${playlist.id}`}
                className="group shrink-0 cursor-pointer"
                style={{ width: 185 }}
              >
                {/* Capa grande */}
                <div
                  className="rounded-xl bg-muted transition-transform duration-200 group-hover:scale-[1.03]"
                  style={{
                    width: 185,
                    height: 185,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                    ...coverStyle(playlist.imageUrl),
                  }}
                >
                  {!playlist.imageUrl && (
                    <div className="flex h-full items-center justify-center">
                      <Music2 className="text-muted-foreground/25" style={{ width: 56, height: 56 }} />
                    </div>
                  )}
                </div>

                {/* Info abaixo da capa */}
                <div className="mt-3 space-y-0.5 px-0.5">
                  <p className="truncate text-sm font-semibold leading-snug">
                    {playlist.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCount(playlist.tracksTotal)} faixas
                    {playlist.isCollaborative && " · Colaborativa"}
                    {!playlist.isPublic && !playlist.isCollaborative && " · Privada"}
                  </p>
                </div>

                {/* Botão Editar — aparece no hover */}
                <div className="mt-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <div
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold text-primary"
                  >
                    <Pencil style={{ width: 11, height: 11 }} />
                    Editar playlist
                  </div>
                  <a
                    href={playlist.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink style={{ width: 11, height: 11 }} />
                  </a>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div
            className="rounded-2xl border border-border bg-card/40 px-6 py-12 text-center"
          >
            <Music2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              {data?.connected
                ? "Nenhuma playlist encontrada nessa conta."
                : "Conecte o Spotify para ver suas playlists aqui."}
            </p>
            {!data?.connected && (
              <a
                href="/api/spotify/auth/login"
                className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white"
                style={{ background: "#1DB954" }}
              >
                <Music2 style={{ width: 14, height: 14 }} />
                Conectar Spotify
              </a>
            )}
          </div>
        )}
      </div>
    </>
  );
}
