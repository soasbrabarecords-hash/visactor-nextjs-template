"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Container from "@/components/container";
import { artistOsNavigation } from "@/lib/artist-os-config";
import { cn } from "@/lib/utils";

export default function ArtistOsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.10),transparent_26%),linear-gradient(180deg,#06101f_0%,#030712_46%,#020617_100%)] text-white">
      <Container className="py-5">
        <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_28px_110px_-70px_rgba(14,165,233,0.45)] backdrop-blur-2xl tablet:p-5">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-12 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 laptop:flex-row laptop:items-end laptop:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100">
                ArtistOS
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.055em] text-white tablet:text-5xl">
                Gestão artística sem ruído.
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/56">
                Shows, caixa, publicidade, contratos e tarefas em um módulo isolado
                para escalar o System Só As Braba.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                Arquitetura
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                Módulo independente
              </div>
              <div className="text-xs text-white/44">Pronto para virar produto separado.</div>
            </div>
          </div>

          <nav className="relative mt-5 flex gap-2 overflow-x-auto pb-1">
            {artistOsNavigation.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/artist-os"
                  ? pathname === "/artist-os"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition",
                    active
                      ? "border-white/30 bg-white text-slate-950 shadow-[0_16px_40px_rgba(255,255,255,0.12)]"
                      : "border-white/10 bg-white/[0.035] text-white/58 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </section>

        <main className="mt-5">{children}</main>
      </Container>
    </div>
  );
}

