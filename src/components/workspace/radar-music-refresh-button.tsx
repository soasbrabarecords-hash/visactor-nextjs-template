"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileUp, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type RefreshResponse = {
  success: boolean;
  message: string;
  updatedAt: string | null;
};

export default function RadarMusicRefreshButton({
  country,
  genre,
}: {
  country: string;
  genre: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busyMode, setBusyMode] = useState<"refresh" | "import" | null>(null);
  const [feedback, setFeedback] = useState<RefreshResponse | null>(null);

  async function handleRefresh() {
    setBusyMode("refresh");
    setFeedback(null);

    try {
      const response = await fetch("/api/radar-music/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country,
          genre,
        }),
      });

      const payload = (await response.json()) as RefreshResponse;

      if (!response.ok || !payload.success) {
        setFeedback({
          success: false,
          message: payload.message || "Nao foi possivel atualizar o radar agora.",
          updatedAt: payload.updatedAt ?? null,
        });
        return;
      }

      setFeedback(payload);
      router.refresh();
    } catch {
      setFeedback({
        success: false,
        message: "Falha ao atualizar o radar. Tente novamente.",
        updatedAt: null,
      });
    } finally {
      setBusyMode(null);
    }
  }

  async function handleImportCsv(file: File) {
    setBusyMode("import");
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("country", country);
      formData.append("genre", genre);

      const response = await fetch("/api/import/spotify-charts-csv", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        success: boolean;
        importedCount: number;
        skippedCount: number;
        errors: string[];
      };

      if (!response.ok || !payload.success) {
        setFeedback({
          success: false,
          message:
            payload.errors[0] ??
            "Nao foi possivel importar o CSV agora.",
          updatedAt: null,
        });
        return;
      }

      setFeedback({
        success: true,
        message: `CSV importado com ${payload.importedCount} linhas. ${payload.skippedCount} puladas.`,
        updatedAt: null,
      });
      router.refresh();
    } catch {
      setFeedback({
        success: false,
        message: "Falha ao importar o CSV. Tente novamente.",
        updatedAt: null,
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setBusyMode(null);
    }
  }

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void handleImportCsv(file);
  }

  return (
    <div className="flex min-w-[280px] flex-col items-start gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex w-full gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={busyMode !== null}
          className="flex-1"
        >
          <RefreshCw className={busyMode === "refresh" ? "animate-spin" : ""} />
          {busyMode === "refresh" ? "Atualizando..." : "Atualizar Radar"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handlePickFile}
          disabled={busyMode !== null}
          className="flex-1"
        >
          <FileUp className={busyMode === "import" ? "animate-pulse" : ""} />
          {busyMode === "import" ? "Importando..." : "Importar CSV"}
        </Button>
      </div>

      {feedback ? (
        <p
          className={
            feedback.success
              ? "text-xs text-emerald-400"
              : "text-xs text-red-400"
          }
        >
          {feedback.message}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Atualize o radar ou importe manualmente um CSV do Spotify Charts.
        </p>
      )}
    </div>
  );
}
