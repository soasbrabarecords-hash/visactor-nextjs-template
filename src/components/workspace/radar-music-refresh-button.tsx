"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<RefreshResponse | null>(null);

  async function handleRefresh() {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-w-[220px] flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleRefresh}
        disabled={isLoading}
        className="w-full"
      >
        <RefreshCw className={isLoading ? "animate-spin" : ""} />
        {isLoading ? "Atualizando..." : "Atualizar Radar"}
      </Button>

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
          Reprocessa o radar com os dados atuais do Spotify e do Supabase.
        </p>
      )}
    </div>
  );
}
