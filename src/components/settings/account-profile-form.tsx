"use client";

import { Check, Loader2, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { createClient } from "@/lib/supabase/client";

type AccountProfileFormProps = {
  initialDisplayName: string;
  initialAvatarUrl: string;
  email: string | null;
};

function initials(value: string) {
  return (value.trim() || "Conta")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AccountProfileForm({
  initialDisplayName,
  initialAvatarUrl,
  email,
}: AccountProfileFormProps) {
  const workspaceAccess = useWorkspaceAccess();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const validAvatarUrl = /^https?:\/\//i.test(avatarUrl.trim())
    ? avatarUrl.trim()
    : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      if (avatarUrl.trim() && !validAvatarUrl) {
        setError("Use uma URL de imagem iniciada por http:// ou https://.");
        return;
      }

      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim() || null,
          avatar_url: validAvatarUrl,
        },
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await workspaceAccess.refreshWorkspaceAccess();
      setMessage("Perfil atualizado.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid gap-4 lg:grid-cols-[auto_1fr]"
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground ring-1 ring-inset ring-white/10"
        style={
          validAvatarUrl
            ? {
                backgroundImage: `url(${validAvatarUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : undefined
        }
      >
        {validAvatarUrl ? null : initials(displayName || email || "Conta")}
      </div>

      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-white/70">Nome exibido</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/25"
              placeholder="Seu nome"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-white/70">URL da foto</span>
            <input
              type="url"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/25"
              placeholder="https://..."
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-white/90 disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : message ? (
              <Check className="h-4 w-4" />
            ) : (
              <UserRound className="h-4 w-4" />
            )}
            {isSaving ? "Salvando..." : "Salvar perfil"}
          </button>
          <span className="text-xs text-white/45">{email}</span>
          {message ? (
            <span className="text-xs text-emerald-300">{message}</span>
          ) : null}
          {error ? <span className="text-xs text-red-300">{error}</span> : null}
        </div>
      </div>
    </form>
  );
}
