"use client";

import { ArrowLeft, LockKeyhole, Music4 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const FRIENDLY_AUTH_ERROR =
  "Não foi possível entrar. Confira seu e-mail e senha e tente novamente.";

export default function LoginForm({
  nextPath,
  isAddingAccount = false,
}: {
  nextPath?: string;
  isAddingAccount?: boolean;
}) {
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

    if (error) {
      setIsSubmitting(false);
      setErrorMessage(error.message || FRIENDLY_AUTH_ERROR);
      return;
    }

    const saveResponse = await fetch("/api/auth/accounts", {
      method: "POST",
    });
    const savePayload = (await saveResponse.json().catch(() => null)) as {
      success?: boolean;
      message?: string;
    } | null;

    if (!saveResponse.ok || !savePayload?.success) {
      setIsSubmitting(false);
      setErrorMessage(
        savePayload?.message ??
          "A conta entrou, mas não foi possível mantê-la conectada.",
      );
      return;
    }

    const destination =
      nextPath && nextPath.startsWith("/") && nextPath !== "/login"
        ? nextPath
        : "/dashboard";

    window.location.assign(destination);
  }

  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-background px-5 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.12),transparent_68%)]" />
      <section className="relative w-full max-w-[420px] rounded-3xl border border-border/80 bg-card/90 p-6 shadow-[0_24px_80px_-44px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
            <Music4 className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground">
            {isAddingAccount ? "Adicionar conta" : "Music Business OS"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isAddingAccount
              ? "Entre na conta que deseja manter conectada."
              : "Acesso interno à sua operação musical."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5" htmlFor="email">
            <span className="text-xs font-medium text-muted-foreground">
              E-mail
            </span>
            <Input
              id="email"
              type="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="h-11 rounded-xl"
              required
            />
          </label>

          <label className="block space-y-1.5" htmlFor="password">
            <span className="text-xs font-medium text-muted-foreground">
              Senha
            </span>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="h-11 rounded-xl"
              required
            />
          </label>

          {errorMessage ? (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <Button
            className="h-11 w-full rounded-xl"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isAddingAccount
                ? "Adicionando..."
                : "Entrando..."
              : isAddingAccount
                ? "Adicionar conta"
                : "Entrar"}
          </Button>
        </form>

        {isAddingAccount ? (
          <Link
            href="/dashboard"
            className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar sem adicionar
          </Link>
        ) : null}

        <div className="mt-5 flex items-center justify-center gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5" />
          Contas são criadas pelo administrador.
        </div>
      </section>
    </main>
  );
}
