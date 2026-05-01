"use client";

/**
 * PlaylistActionBar
 * ─────────────────
 * Barra de ações estilo Spotify (Play verde, Shuffle, +, Download, ⋯).
 * Renderiza apenas botões que abrem o Spotify nativo — não toca em nenhuma
 * lógica do PlaylistEditor.
 */

import { Download, Play, Plus, Shuffle, MoreHorizontal } from "lucide-react";

type Props = {
  spotifyUrl: string;
  /** Marcador para identificar a barra no skin via [data-spotify-actionbar]. */
  className?: string;
};

export default function PlaylistActionBar({ spotifyUrl, className = "" }: Props) {
  function openSpotify(path = "") {
    if (typeof window === "undefined") return;
    window.open(spotifyUrl + path, "_blank", "noreferrer");
  }

  return (
    <div data-spotify-actionbar className={className}>
      <button
        type="button"
        title="Reproduzir no Spotify"
        aria-label="Reproduzir"
        onClick={() => openSpotify()}
        className="sp-play"
      >
        <Play className="h-6 w-6 fill-current" strokeWidth={0} />
      </button>

      <button
        type="button"
        title="Shuffle no Spotify"
        aria-label="Aleatório"
        onClick={() => openSpotify()}
        className="sp-icon-btn"
      >
        <Shuffle className="h-5 w-5" />
      </button>

      <button
        type="button"
        title="Adicionar à biblioteca (Spotify)"
        aria-label="Adicionar"
        onClick={() => openSpotify()}
        className="sp-icon-btn"
      >
        <Plus className="h-6 w-6" />
      </button>

      <button
        type="button"
        title="Baixar no Spotify"
        aria-label="Baixar"
        onClick={() => openSpotify()}
        className="sp-icon-btn"
      >
        <Download className="h-5 w-5" />
      </button>

      <button
        type="button"
        title="Mais opções"
        aria-label="Mais opções"
        onClick={() => openSpotify()}
        className="sp-icon-btn"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </div>
  );
}
