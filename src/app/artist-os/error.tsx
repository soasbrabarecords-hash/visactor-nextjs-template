"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ArtistOsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-3xl rounded-[34px] border border-rose-200/16 bg-[linear-gradient(145deg,rgba(244,63,94,0.13),rgba(15,23,42,0.86)_58%,rgba(2,6,23,0.95))] p-6 text-white shadow-[0_28px_120px_-72px_rgba(244,63,94,0.55)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200/22 bg-rose-300/[0.12] text-rose-100">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-rose-100/60">
        ArtistOS
      </div>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">
        Não conseguimos abrir esta área.
      </h1>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/62">
        Pode ser uma leitura temporária do Supabase ou uma tabela recém-migrada
        ainda atualizando no cache. Tente recarregar esta seção.
      </p>
      {error.digest ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/24 px-3 py-2 text-xs font-bold text-white/45">
          Digest: {error.digest}
        </div>
      ) : null}
      <Button
        type="button"
        onClick={reset}
        className="mt-5 rounded-full bg-white text-slate-950 hover:bg-white/90"
      >
        <RefreshCcw className="h-4 w-4" />
        Tentar de novo
      </Button>
    </section>
  );
}
