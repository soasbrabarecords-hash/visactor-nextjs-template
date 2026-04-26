"use client";

import { LockKeyhole, Music4 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

const FRIENDLY_AUTH_ERROR =
  "Nao foi possivel entrar. Confira seu e-mail e senha e tente novamente.";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message || FRIENDLY_AUTH_ERROR);
      return;
    }

    const nextPath = searchParams.get("next");
    const destination =
      nextPath && nextPath.startsWith("/") && nextPath !== "/login"
        ? nextPath
        : "/dashboard";

    router.push(destination);
    router.refresh();
  }

  return (
    <main className="min-h-[100dvh] bg-background">
      <Container className="grid min-h-[100dvh] items-center py-10">
        <div className="grid gap-10 laptop:grid-cols-[1.1fr_0.9fr] laptop:items-center">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Music4 className="h-4 w-4 text-primary" />
              SÓ AS BRABA System
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight laptop:text-6xl">
                Acesso ao radar profissional de curadoria musical
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Controle playlists, acompanhe charts, detecte oportunidades e
                tome decisoes editoriais com uma mesa de trabalho pensada para a SÓ AS BRABA.
              </p>
            </div>

            <div className="grid gap-3 tablet:grid-cols-3">
              <article className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Radar Music
                </div>
                <div className="mt-2 font-semibold">
                  Leitura de subida, queda e novas entradas
                </div>
              </article>
              <article className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Radar Playlists
                </div>
                <div className="mt-2 font-semibold">
                  Shared momentum entre sua base e o mercado
                </div>
              </article>
              <article className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Curadoria
                </div>
                <div className="mt-2 font-semibold">
                  Decisao final para adicionar, observar ou remover
                </div>
              </article>
            </div>
          </section>

          <section className="rounded-[32px] border border-border bg-card/80 p-6 shadow-sm laptop:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Area de login
                </div>
                <h2 className="mt-1 text-2xl font-semibold">Entrar no sistema</h2>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  E-mail
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@soasbraba.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Senha
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {errorMessage ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 dark:text-red-300">
                  {errorMessage}
                </div>
              ) : null}

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="mt-4 text-sm text-muted-foreground">
              Use seu e-mail e senha para acessar a area interna da equipe.
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}
