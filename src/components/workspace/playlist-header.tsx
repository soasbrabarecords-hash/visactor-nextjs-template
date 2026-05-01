"use client";

import Link from "next/link";
import { Camera, ExternalLink, Loader2, Music2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EditableField } from "@/components/workspace/playlist-editor";

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

// ─── Helpers de imagem ────────────────────────────────────────────────────────
//
// Spotify exige: JPEG, base64, máx 256 KB.
// Esta função carrega o arquivo, redimensiona para no máx 600x600 e re-encoda
// em JPEG até caber no limite.
async function fileToCompressedJpegBase64(
  file: File,
  maxBytes = 240 * 1024,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Imagem inválida."));
    i.src = dataUrl;
  });

  const maxDim = 600;
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não disponível.");
  ctx.drawImage(img, 0, 0, width, height);

  for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
    const out = canvas.toDataURL("image/jpeg", quality);
    const base64 = out.replace(/^data:image\/jpeg;base64,/, "");
    if (base64.length <= maxBytes) return base64;
  }
  const out = canvas.toDataURL("image/jpeg", 0.4);
  return out.replace(/^data:image\/jpeg;base64,/, "");
}

export default function PlaylistHeader({
  playlistId,
  initialName,
  initialDescription,
  imageUrl,
  ownerName,
  tracksTotal,
  isPublic,
  isCollaborative,
  spotifyUrl,
  backHref = "/curadoria",
}: {
  playlistId: string;
  initialName: string;
  initialDescription: string;
  imageUrl: string | null;
  ownerName: string;
  tracksTotal: number;
  isPublic: boolean;
  isCollaborative: boolean;
  spotifyUrl: string;
  backHref?: string;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [coverUrl, setCoverUrl] = useState<string | null>(imageUrl);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function persist(payload: { name: string; description: string }) {
    const res = await fetch(`/api/spotify/playlists/${playlistId}/details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { success?: boolean; message?: string };
    if (!data.success) throw new Error(data.message ?? "Erro ao salvar.");
  }

  async function handleSaveName(newName: string) {
    await persist({ name: newName, description });
    setName(newName);
  }

  async function handleSaveDescription(newDesc: string) {
    await persist({ name, description: newDesc });
    setDescription(newDesc);
  }

  function handleCoverClick() {
    if (uploadingCover) return;
    setCoverError(null);
    fileInputRef.current?.click();
  }

  async function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setCoverError(null);
    try {
      const base64 = await fileToCompressedJpegBase64(file);
      const res = await fetch(`/api/spotify/playlists/${playlistId}/cover`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (!data.success) throw new Error(data.message ?? "Erro ao atualizar capa.");
      setCoverUrl(`data:image/jpeg;base64,${base64}`);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "Erro ao atualizar capa.");
    } finally {
      setUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div data-spotify-header className="relative overflow-hidden" style={{ minHeight: "320px" }}>
      {/* Background: blurred cover + dark gradient overlay */}
      {coverUrl && (
        <div
          className="absolute inset-0 scale-110"
          style={{
            backgroundImage: `url(${coverUrl})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            filter: "blur(40px) brightness(0.35) saturate(1.4)",
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: coverUrl
            ? "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)"
            : "linear-gradient(to bottom, hsl(var(--background) / 0.7), hsl(var(--background)))",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end px-4 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-12 laptop:px-12">
        <div className="flex flex-col gap-4 sm:gap-6 laptop:flex-row laptop:items-end">

          {/* Cover art — clicável para editar */}
          <div className="shrink-0 self-center laptop:self-end">
            <button
              type="button"
              onClick={handleCoverClick}
              disabled={uploadingCover}
              title="Clique para alterar a capa"
              className="group relative block h-44 w-44 overflow-hidden rounded-xl shadow-2xl transition-transform hover:scale-[1.02] sm:h-56 sm:w-56 laptop:h-64 laptop:w-64"
              style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
            >
              {coverUrl ? (
                <div
                  className="h-full w-full"
                  style={{
                    backgroundImage: `url(${coverUrl})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <Music2 className="h-16 w-16 text-muted-foreground/40 sm:h-20 sm:w-20 laptop:h-24 laptop:w-24" />
                </div>
              )}
              {/* Overlay (visível em hover, ou enquanto faz upload) */}
              <div
                className={[
                  "absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 transition-opacity",
                  uploadingCover
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100",
                ].join(" ")}
              >
                {uploadingCover ? (
                  <Loader2 className="h-7 w-7 animate-spin text-white" />
                ) : (
                  <>
                    <Camera className="h-7 w-7 text-white" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">
                      Editar capa
                    </span>
                  </>
                )}
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void handleCoverFile(e)}
            />
            {coverError && (
              <p className="mt-2 max-w-[160px] text-center text-[11px] text-red-300 laptop:text-left">
                {coverError}
              </p>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-2 text-center text-white laptop:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
              {isPublic ? "Playlist pública" : "Playlist privada"}
              {isCollaborative ? " · Colaborativa" : ""}
            </p>

            {/* Title — editável inline */}
            <div
              className="font-bold leading-none tracking-tight"
              style={{ fontSize: "clamp(1.6rem, 5vw, 3.5rem)" }}
            >
              <EditableField
                value={name}
                onSave={handleSaveName}
                placeholder="Nome da playlist"
              />
            </div>

            {/* Description — editável inline */}
            <div className="max-w-2xl text-sm leading-relaxed opacity-80">
              <EditableField
                value={description}
                onSave={handleSaveDescription}
                multiline
                placeholder="Adicionar descrição..."
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1 pt-1 text-sm opacity-80 laptop:justify-start">
              <span className="font-semibold">{ownerName}</span>
              <span className="opacity-50">·</span>
              <span>{formatCount(tracksTotal)} faixas</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-wrap justify-center gap-2 laptop:justify-end">
            <Button asChild variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
              <Link href={backHref}>Voltar</Link>
            </Button>
            <Button asChild size="sm" className="bg-white text-black hover:bg-white/90">
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2"
              >
                Abrir Spotify
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
