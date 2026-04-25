"use client";

import { Music2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AddPlaylistForm() {
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
    <Container className="border-b border-border py-4">
      <section className="grid gap-4 rounded-2xl border border-border bg-muted/10 p-5 laptop:grid-cols-[1.2fr_1fr] laptop:items-center">
        <div className="space-y-2">
          <ChartTitle title="Adicionar Playlist" icon={Music2} />
          <p className="max-w-2xl text-sm text-muted-foreground">
            Cole a URL de uma playlist do Spotify e o sistema busca nome,
            followers e quantidade de faixas automaticamente antes de salvar no
            Supabase.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 tablet:flex-row">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              aria-label="Playlist URL"
            />
            <Button type="submit" disabled={isPending}>
              <Plus />
              {isPending ? "Adicionando..." : "Adicionar Playlist"}
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
