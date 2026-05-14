"use client";

import { Music2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AddPlaylistForm({
  title = "Adicionar Playlist",
  description = "Cole a URL de uma playlist do Spotify e o sistema busca nome, followers e quantidade de faixas automaticamente antes de salvar no Supabase.",
  buttonLabel = "Adicionar Playlist",
}: {
  title?: string;
  description?: string;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "error">(
    "success",
  );
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setFeedbackType("error");
      setFeedback("Cole uma URL de playlist do Spotify para continuar.");
      return;
    }

    startTransition(() => {
      const submitPlaylist = async () => {
        setFeedbackType("success");
        setFeedback("Buscando dados da playlist no Spotify...");

        const response = await fetch("/api/playlists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: trimmedUrl }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        if (!response.ok) {
          setFeedbackType("error");
          setFeedback(
            payload?.message ?? "Nao foi possivel adicionar a playlist.",
          );
          return;
        }

        setUrl("");
        setFeedbackType("success");
        setFeedback(
          "Playlist adicionada e sincronizada com os dados do Spotify.",
        );
        router.refresh();
      };

      void submitPlaylist();
    });
  };

  return (
    <Container className="border-b border-border py-5">
      <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-white/70 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_22px_80px_rgba(0,0,0,0.24)] laptop:grid laptop:grid-cols-[1.05fr_1fr] laptop:items-center laptop:gap-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.9),transparent_32%),radial-gradient(circle_at_100%_0%,rgba(34,197,94,0.12),transparent_34%)] dark:bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.11),transparent_32%),radial-gradient(circle_at_100%_0%,rgba(34,197,94,0.10),transparent_34%)]" />
        <div className="relative space-y-2">
          <ChartTitle title={title} icon={Music2} />
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative mt-5 flex flex-col gap-3 laptop:mt-0">
          <div className="flex flex-col gap-3 tablet:flex-row">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              aria-label="Playlist URL"
              className="h-12 rounded-2xl border-border/80 bg-background/70 px-4 shadow-inner shadow-slate-950/[0.03] backdrop-blur-xl focus-visible:ring-1 focus-visible:ring-emerald-400/45 focus-visible:ring-offset-0 dark:border-white/10 dark:bg-black/20"
            />
            <Button
              type="submit"
              disabled={isPending}
              className="h-12 rounded-2xl bg-slate-950 px-5 text-white shadow-[0_14px_32px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
            >
              <Plus />
              {isPending ? "Adicionando..." : buttonLabel}
            </Button>
          </div>

          {feedback ? (
            <p
              className={
                feedbackType === "success"
                  ? "text-sm text-emerald-500"
                  : "text-sm text-destructive"
              }
            >
              {feedback}
            </p>
          ) : null}
        </form>
      </section>
    </Container>
  );
}
