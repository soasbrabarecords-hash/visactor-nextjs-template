"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Container from "@/components/container";
import { artistOsNavigation } from "@/lib/artist-os-config";
import { cn } from "@/lib/utils";

export default function ArtistOsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.15),transparent_24%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_27%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.08),transparent_24%),linear-gradient(180deg,#071120_0%,#030712_48%,#020617_100%)] text-white">
      <Container className="py-5">
        <section className="relative overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(8,47,73,0.38),rgba(6,78,59,0.20))] p-4 shadow-[0_28px_120px_-72px_rgba(14,165,233,0.55)] backdrop-blur-2xl tablet:p-5">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-300/14 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-12 h-72 w-72 rounded-full bg-sky-300/14 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-emerald-200/70 via-sky-200/50 to-transparent" />

          <div className="relative flex flex-col gap-4 laptop:flex-row laptop:items-center laptop:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100">
                ArtistOS
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] text-white tablet:text-5xl">
                Gestão artística
              </h1>
              <p className="mt-2 max-w-3xl text-base font-semibold leading-7 text-white/68">
                Operação completa para artistas: agenda, vendas, publi, caixa,
                contratos e tarefas no mesmo painel.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 laptop:w-[390px]">
              <div className="rounded-[24px] border border-sky-300/18 bg-sky-300/[0.08] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-100/55">
                  Operação
                </div>
                <div className="mt-1 text-sm font-black text-white">Shows + contratos</div>
                <div className="text-xs font-medium text-sky-50/62">Controle comercial e agenda.</div>
              </div>
              <div className="rounded-[24px] border border-emerald-300/18 bg-emerald-300/[0.08] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/55">
                  Caixa
                </div>
                <div className="mt-1 text-sm font-black text-white">Financeiro por artista</div>
                <div className="text-xs font-medium text-emerald-50/62">Entradas, saídas e atrasos.</div>
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
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition",
                    active
                      ? "border-white/35 bg-white text-slate-950 shadow-[0_16px_40px_rgba(255,255,255,0.14)]"
                      : "border-white/12 bg-black/18 text-white/68 hover:border-white/22 hover:bg-white/[0.09] hover:text-white",
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
