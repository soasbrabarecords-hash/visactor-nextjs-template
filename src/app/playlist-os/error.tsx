"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import Container from "@/components/container";

export default function PlaylistOsError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#08090c]">
      <Container className="py-10">
        <section className="mx-auto max-w-3xl rounded-[30px] border border-amber-400/15 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(15,23,42,0.9))] p-8 text-white shadow-[0_30px_100px_-70px_rgba(251,191,36,0.55)]">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-200 ring-1 ring-inset ring-amber-300/15">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">
            O radar não carregou desta vez.
          </h1>
          <p className="text-white/52 mt-2 max-w-xl text-sm leading-6">
            A base continua preservada. Tente novamente para refazer apenas a
            leitura do dashboard.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Tentar novamente
          </button>
        </section>
      </Container>
    </div>
  );
}
