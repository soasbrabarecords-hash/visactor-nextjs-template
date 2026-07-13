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
import { useSpotifyAccountPlaylistsCacheKey } from "@/hooks/use-spotify-account-playlists-cache-key";
import {
  getCachedSpotifyAccountPlaylistsClient,
  getSpotifyAccountPlaylistsClient,
  invalidateSpotifyAccountPlaylistsClientCache,
  type SpotifyPlaylistsClientResponse,
} from "@/lib/spotify-account-playlists-client";

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
  const cacheKey = useSpotifyAccountPlaylistsCacheKey();
  const activeCacheKeyRef = useRef(cacheKey);
  const dataCacheKeyRef = useRef(cacheKey);
  const [data, setData] = useState<SpotifyPlaylistsResponse | null>(() =>
    cacheKey ? getCachedSpotifyAccountPlaylistsClient(cacheKey) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);

  const loadPlaylists = useCallback(
    (force = false) => {
      if (!cacheKey) return;
      const requestCacheKey = cacheKey;

      startTransition(async () => {
        setError(null);
        try {
          const payload = await getSpotifyAccountPlaylistsClient({
            force,
            cacheKey: requestCacheKey,
          });
          if (activeCacheKeyRef.current !== requestCacheKey) return;
          dataCacheKeyRef.current = requestCacheKey;
          setData(payload);
        } catch (requestError) {
          if (activeCacheKeyRef.current !== requestCacheKey) return;
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar as playlists do Spotify.",
          );
        }
      });
    },
    [cacheKey, startTransition],
  );

  useEffect(() => {
    activeCacheKeyRef.current = cacheKey;
    if (!cacheKey) return;

    dataCacheKeyRef.current = cacheKey;
    setData(getCachedSpotifyAccountPlaylistsClient(cacheKey));
    loadPlaylists();
  }, [cacheKey, loadPlaylists]);

  const scopedData = dataCacheKeyRef.current === cacheKey ? data : null;
  const playlists = scopedData?.connected ? scopedData.playlists : [];
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
            invalidateSpotifyAccountPlaylistsClientCache(cacheKey);
            loadPlaylists(true);
          }}
        />
      )}

      {/* ── HERO: Spotify profile style ── */}
      <div className="relative min-h-[250px] overflow-hidden border-b border-white/10 bg-[#11131a] tablet:min-h-[230px]">
        {/* Blurred cover mosaic background */}
        {heroCover ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${heroCover})`,
              backgroundPosition: "center 35%",
              backgroundSize: "cover",
              filter: "blur(72px) brightness(0.22) saturate(1.15)",
              transform: "scale(1.1)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[#151722]" />
        )}

        {/* Gradient overlay — sempre presente */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(120deg, rgba(8,10,16,0.76) 0%, rgba(8,10,16,0.58) 46%, rgba(8,10,16,0.88) 100%)",
          }}
        />

        {/* Profile content — alinhado ao fundo como Spotify */}
        <div className="relative z-10 flex min-h-[250px] flex-col justify-center px-5 py-6 tablet:min-h-[230px] tablet:px-8 laptop:px-12">
          <div className="flex flex-col gap-5 tablet:flex-row tablet:items-center">

            {/* Avatar circular grande */}
            <div className="shrink-0">
              <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full border border-white/15 bg-white/[0.08] shadow-[0_16px_45px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md tablet:h-[104px] tablet:w-[104px]">
                <User className="h-9 w-9 text-white/35 tablet:h-12 tablet:w-12" />
              </div>
            </div>

            {/* Info: label + nome + metadata */}
            <div className="min-w-0 flex-1 text-white">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/48">
                Perfil
              </p>
              <h1 className="mb-2 truncate text-[2.25rem] font-semibold leading-none tracking-[-0.045em] tablet:text-[3.25rem]">
                {ownerName}
              </h1>
              {scopedData?.connected ? (
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-white/55">
                  <strong>{formatCount(publicPlaylists.length)}</strong> playlists públicas
                  <span className="text-white/25">·</span>
                  <strong>—</strong> seguidores
                  <span className="text-white/25">·</span>
                  <strong>—</strong> seguindo
                </p>
              ) : (
                <p className="text-xs text-white/50">
                  Conecte o Spotify para ver suas playlists aqui.
                </p>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 tablet:ml-auto tablet:justify-end">
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-white/50" />}
              {scopedData?.connected ? (
                <>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/70 bg-white px-3.5 text-xs font-semibold text-slate-950 shadow-[0_8px_24px_-14px_rgba(255,255,255,0.9)] transition hover:bg-white/90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nova playlist
                  </button>
                  <button
                    onClick={() => {
                      invalidateSpotifyAccountPlaylistsClientCache(cacheKey);
                      loadPlaylists(true);
                    }}
                    disabled={isPending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-medium text-white/78 backdrop-blur-md transition hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Atualizar
                  </button>
                  <a
                    href="/api/spotify/auth/logout"
                    onClick={() =>
                      invalidateSpotifyAccountPlaylistsClientCache(cacheKey)
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-3 text-xs font-medium text-white/48 backdrop-blur-md transition hover:bg-white/[0.08] hover:text-white/80"
                  >
                    <LogOut className="h-3.5 w-3.5" />
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

          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
          {scopedData && !scopedData.connected && (
            <p className="mt-2.5 text-xs text-white/45">{scopedData.message}</p>
          )}
        </div>
      </div>

      {/* ── Gradient fade — hero para fundo da página ── */}
      <div className="pointer-events-none h-3 border-t border-white/5 bg-black/[0.03]" />

      {/* ── Seção: Playlists públicas ── */}
      <div className="px-5 pb-4 pt-3 tablet:px-8 laptop:px-12">
        {/* Header da seção */}
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
              {scopedData?.connected ? "Playlists públicas" : "Playlists"}
            </h2>
            {scopedData?.connected && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                {formatCount(playlists.length)} playlists · somente as criadas por esta conta
              </p>
            )}
          </div>
          {scopedData?.connected && (
            <Link
              href="#"
              className="rounded-full border border-slate-200/80 bg-white/65 px-3 py-1.5 text-[11px] font-medium text-slate-500 shadow-sm backdrop-blur-md transition hover:bg-white hover:text-slate-900"
              onClick={(e) => { e.preventDefault(); }}
            >
              Ver todas
            </Link>
          )}
        </div>

        {playlists.length > 0 ? (
          /* Scroll horizontal de cards estilo Spotify */
          <div
            className="flex gap-3 overflow-x-auto pb-3"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
          >
            {playlists.map((playlist) => (
              <Link
                key={playlist.id}
                href={`/curadoria/playlists/${playlist.id}`}
                className="group w-[138px] shrink-0 cursor-pointer tablet:w-[152px]"
              >
                {/* Capa grande */}
                <div
                  className="aspect-square w-full rounded-[18px] border border-white/75 bg-white/55 shadow-[0_16px_36px_-24px_rgba(15,23,42,0.65)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_20px_38px_-22px_rgba(15,23,42,0.72)]"
                  style={{
                    ...coverStyle(playlist.imageUrl),
                  }}
                >
                  {!playlist.imageUrl && (
                    <div className="flex h-full items-center justify-center">
                      <Music2 className="h-8 w-8 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Info abaixo da capa */}
                <div className="mt-2 space-y-0.5 px-0.5">
                  <p className="truncate text-xs font-semibold leading-snug text-slate-900">
                    {playlist.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatCount(playlist.tracksTotal)} faixas
                    {playlist.isCollaborative && " · Colaborativa"}
                    {!playlist.isPublic && !playlist.isCollaborative && " · Privada"}
                  </p>
                </div>

                {/* Botão Editar — aparece no hover */}
                <div className="mt-1.5 flex gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <div
                    className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white/75 px-1.5 text-[10px] font-medium text-slate-700 backdrop-blur-md"
                  >
                    <Pencil style={{ width: 11, height: 11 }} />
                    Editar playlist
                  </div>
                  <a
                    href={playlist.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/75 text-slate-400 backdrop-blur-md hover:text-slate-900"
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
              {scopedData?.connected
                ? "Nenhuma playlist encontrada nessa conta."
                : "Conecte o Spotify para ver suas playlists aqui."}
            </p>
            {!scopedData?.connected && (
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
