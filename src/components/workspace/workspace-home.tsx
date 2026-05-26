"use client";

import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, Disc3, Library } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Container from "@/components/container";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import type { ModuleKey } from "@/lib/workspace-access";
import { cn } from "@/lib/utils";

type WorkspaceOsCard = {
  name: string;
  description: string;
  href: string;
  status: string;
  moduleKey: ModuleKey;
  icon: LucideIcon;
  tone: "green" | "blue" | "amber";
};

const osCards: WorkspaceOsCard[] = [
  {
    name: "Playlist OS",
    description: "Curadoria, playlists, charts, radar musical e inteligência de catálogo.",
    href: "/playlist-os",
    status: "Operação ativa",
    moduleKey: "playlist_os",
    icon: Disc3,
    tone: "green",
  },
  {
    name: "Label OS",
    description: "Lançamentos, artistas, obras, fonogramas, splits e distribuição.",
    href: "/label-os",
    status: "Catálogo pronto",
    moduleKey: "label_os",
    icon: Library,
    tone: "blue",
  },
  {
    name: "Artist OS",
    description: "Agenda, shows, publicidade, caixa, contratos e tarefas da carreira artística.",
    href: "/artist-os",
    status: "Gestão em expansão",
    moduleKey: "artist_os",
    icon: BriefcaseBusiness,
    tone: "amber",
  },
];

function toneClasses(tone: WorkspaceOsCard["tone"]) {
  const tones = {
    green: {
      card: "from-emerald-400/18 via-slate-950/88 to-slate-950",
      icon: "bg-emerald-300/12 text-emerald-100 ring-emerald-200/12",
      badge: "bg-emerald-300/10 text-emerald-100 ring-emerald-200/12",
      glow: "bg-emerald-300/12",
    },
    blue: {
      card: "from-sky-400/18 via-slate-950/88 to-slate-950",
      icon: "bg-sky-300/12 text-sky-100 ring-sky-200/12",
      badge: "bg-sky-300/10 text-sky-100 ring-sky-200/12",
      glow: "bg-sky-300/12",
    },
    amber: {
      card: "from-amber-300/18 via-slate-950/88 to-slate-950",
      icon: "bg-amber-300/12 text-amber-100 ring-amber-200/12",
      badge: "bg-amber-300/10 text-amber-100 ring-amber-200/12",
      glow: "bg-amber-300/12",
    },
  } as const;

  return tones[tone];
}

function OsCard({ card }: { card: WorkspaceOsCard }) {
  const Icon = card.icon;
  const tone = toneClasses(card.tone);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[32px] bg-gradient-to-br p-5 shadow-[0_24px_90px_-70px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-white/[0.08] transition duration-300 hover:-translate-y-1 hover:ring-white/14",
        tone.card,
      )}
    >
      <div className={cn("pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl", tone.glow)} />
      <div className="relative flex min-h-[260px] flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset", tone.icon)}>
            <Icon className="h-5 w-5" />
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset", tone.badge)}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {card.status}
          </span>
        </div>

        <div className="mt-auto">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">
            {card.name}
          </h2>
          <p className="mt-3 min-h-14 text-sm font-normal leading-6 text-white/62">
            {card.description}
          </p>
          <Link
            href={card.href}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white/90"
          >
            Abrir
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function WorkspaceHome() {
  const { currentWorkspace, isLoading, canAccessModule } = useWorkspaceAccess();
  const visibleCards = isLoading
    ? osCards
    : osCards.filter((card) => canAccessModule(card.moduleKey));

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.13),transparent_26%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,#071120_0%,#030712_50%,#020617_100%)] text-white">
      <Container className="py-8">
        <section className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(8,47,73,0.28),rgba(6,78,59,0.18))] p-6 shadow-[0_28px_110px_-78px_rgba(14,165,233,0.50)] ring-1 ring-inset ring-white/[0.08] tablet:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative max-w-4xl">
            <div className="inline-flex rounded-full bg-white/[0.07] px-3 py-1 text-xs font-medium text-white/68 ring-1 ring-inset ring-white/[0.08]">
              Workspace atual: {currentWorkspace?.name ?? "SÓ AS BRABA Records"}
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.055em] text-white tablet:text-6xl">
              Music Business Workspace
            </h1>
            <p className="mt-4 max-w-2xl text-base font-normal leading-7 text-white/64 tablet:text-lg">
              Sistema operacional para selos, artistas, curadoria e gestão musical.
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-3">
          {visibleCards.map((card) => (
            <OsCard key={card.name} card={card} />
          ))}
          {!isLoading && visibleCards.length === 0 ? (
            <div className="rounded-[32px] border border-amber-400/20 bg-amber-300/10 p-6 text-sm text-white/70 xl:col-span-3">
              Nenhum módulo liberado para este workspace.
            </div>
          ) : null}
        </section>
      </Container>
    </div>
  );
}
