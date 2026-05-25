"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Container from "@/components/container";
import { artistOsNavigation } from "@/lib/artist-os-config";
import { cn } from "@/lib/utils";

export default function ArtistOsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_25%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.10),transparent_28%),linear-gradient(180deg,#071120_0%,#030712_48%,#020617_100%)] font-sans text-white antialiased">
      <Container className="py-5">
        <section className="relative overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(8,47,73,0.30),rgba(6,78,59,0.18))] p-4 shadow-[0_24px_100px_-72px_rgba(14,165,233,0.45)] ring-1 ring-inset ring-white/[0.08] backdrop-blur-2xl tablet:p-5">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-12 h-72 w-72 rounded-full bg-sky-300/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 laptop:flex-row laptop:items-center laptop:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100 ring-1 ring-inset ring-emerald-200/12">
                ArtistOS
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-white tablet:text-5xl">
                Gestão artística
              </h1>
              <p className="mt-2 max-w-3xl text-base font-normal leading-7 text-white/68">
                Operação completa para artistas: agenda, vendas, publi, caixa,
                contratos e tarefas no mesmo painel.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 laptop:w-[390px]">
              <div className="rounded-[24px] bg-sky-300/[0.08] p-3 ring-1 ring-inset ring-sky-200/10">
                <div className="text-xs font-medium text-sky-100/68">
                  Operação
                </div>
                <div className="mt-1 text-sm font-semibold text-white/92">Shows + contratos</div>
                <div className="text-xs font-normal text-sky-50/62">Controle comercial e agenda.</div>
              </div>
              <div className="rounded-[24px] bg-emerald-300/[0.08] p-3 ring-1 ring-inset ring-emerald-200/10">
                <div className="text-xs font-medium text-emerald-100/68">
                  Caixa
                </div>
                <div className="mt-1 text-sm font-semibold text-white/92">Financeiro por artista</div>
                <div className="text-xs font-normal text-emerald-50/62">Entradas, saídas e atrasos.</div>
              </div>
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
                    "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium tracking-[-0.01em] transition",
                    active
                      ? "bg-white text-slate-950 shadow-[0_14px_34px_rgba(255,255,255,0.12)]"
                      : "bg-white/[0.055] text-white/66 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.10] hover:text-white",
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
