import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  ClipboardCheck,
  Megaphone,
  Settings2,
  UserRoundCog,
} from "lucide-react";
import ArtistOsCrudPanel from "@/components/artist-os/artist-os-crud-panel";
import { getArtistOsResource } from "@/lib/artist-os";
import {
  artistOsNavigation,
  type ArtistOsResourceKey,
} from "@/lib/artist-os-config";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const resourceSections = new Set([
  "artists",
  "shows",
  "deals",
  "brand-deals",
  "finance",
  "contracts",
  "tasks",
]);

function PlaceholderCard({
  title,
  description,
  href,
  icon: Icon,
  tone = "slate",
}: {
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
  tone?: "emerald" | "sky" | "amber" | "rose" | "slate";
}) {
  const tones = {
    emerald: "bg-[linear-gradient(145deg,rgba(16,185,129,0.14),rgba(15,23,42,0.94)_66%)] text-emerald-100",
    sky: "bg-[linear-gradient(145deg,rgba(14,165,233,0.14),rgba(15,23,42,0.94)_66%)] text-sky-100",
    amber: "bg-[linear-gradient(145deg,rgba(245,158,11,0.15),rgba(15,23,42,0.94)_66%)] text-amber-100",
    rose: "bg-[linear-gradient(145deg,rgba(244,63,94,0.14),rgba(15,23,42,0.94)_66%)] text-rose-100",
    slate: "bg-[linear-gradient(145deg,rgba(100,116,139,0.12),rgba(15,23,42,0.94)_66%)] text-white",
  } as const;

  const content = (
    <div
      className={cn(
        "group rounded-[26px] p-4 ring-1 ring-inset ring-white/[0.07] transition hover:-translate-y-0.5 hover:ring-white/12",
        tones[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.07] ring-1 ring-inset ring-white/[0.07]">
          <Icon className="h-5 w-5" />
        </div>
        {href ? (
          <ArrowRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/65" />
        ) : null}
      </div>
      <h3 className="mt-4 text-base font-semibold text-white/92">{title}</h3>
      <p className="mt-1 text-sm font-normal leading-6 text-white/56">{description}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function ReportsPage() {
  return (
    <section className="rounded-[30px] bg-[linear-gradient(145deg,rgba(14,165,233,0.10),rgba(15,23,42,0.92)_48%,rgba(2,6,23,0.96))] p-5 shadow-[0_18px_80px_-62px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/[0.07]">
      <div className="max-w-3xl">
        <div className="text-xs font-medium text-white/44">
          Relatórios
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white/95">
          Business OS — inteligência executiva
        </h2>
        <p className="mt-2 text-sm font-normal leading-6 text-white/56">
          Estrutura inicial para relatórios de shows, caixa, publicidade, tarefas
          e performance por artista. A geração avançada entra na próxima etapa.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <PlaceholderCard
          title="Relatório de shows"
          description="Agenda, cachês, status e cidades mais fortes."
          href="/artist-os/shows"
          icon={CalendarDays}
          tone="sky"
        />
        <PlaceholderCard
          title="Relatório financeiro"
          description="Entradas, saídas, lucro/prejuízo e atrasos."
          href="/artist-os/finance"
          icon={BadgeDollarSign}
          tone="emerald"
        />
        <PlaceholderCard
          title="Publicidade"
          description="Campanhas, marcas, entregas e comprovações."
          href="/artist-os/brand-deals"
          icon={Megaphone}
          tone="amber"
        />
        <PlaceholderCard
          title="Tarefas"
          description="Pendências por responsável, prazo e prioridade."
          href="/artist-os/tasks"
          icon={ClipboardCheck}
          tone="rose"
        />
        <PlaceholderCard
          title="Por artista"
          description="Resumo individual de carreira e operação."
          href="/artist-os/artists"
          icon={UserRoundCog}
        />
      </div>
    </section>
  );
}

function SettingsPage() {
  return (
    <section className="rounded-[30px] bg-[linear-gradient(145deg,rgba(16,185,129,0.10),rgba(15,23,42,0.92)_48%,rgba(2,6,23,0.96))] p-5 shadow-[0_18px_80px_-62px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/[0.07]">
      <div className="flex flex-col gap-4 laptop:flex-row laptop:items-start laptop:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-medium text-white/44">
            Configurações
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white/95">
            Business OS pronto para multi-perfis
          </h2>
          <p className="mt-2 text-sm font-normal leading-6 text-white/56">
            A base já nasce com workspace, created_by e estrutura para roles:
            admin, manager, financeiro, artista e equipe. No MVP, a autenticação
            atual do sistema continua controlando o acesso.
          </p>
        </div>
        <div className="rounded-[24px] bg-emerald-300/[0.08] p-4 text-emerald-100 ring-1 ring-inset ring-emerald-200/12">
          <Settings2 className="h-5 w-5" />
          <div className="mt-3 text-sm font-semibold">MVP seguro</div>
          <div className="mt-1 text-xs leading-5 text-emerald-100/70">
            Sem mexer em permissões complexas agora.
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {artistOsNavigation.slice(1, 8).map((item) => (
          <PlaceholderCard
            key={item.href}
            title={item.label}
            description="Configurações específicas serão plugadas aqui em uma próxima fase."
            href={item.href}
            icon={item.icon}
            tone={item.key === "brand-deals" ? "amber" : item.key === "tasks" ? "rose" : "sky"}
          />
        ))}
      </div>
    </section>
  );
}

export default async function ArtistOsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (section === "reports") return <ReportsPage />;
  if (section === "settings") return <SettingsPage />;
  if (!resourceSections.has(section)) notFound();

  const data = await getArtistOsResource(section as ArtistOsResourceKey);

  return (
    <ArtistOsCrudPanel
      resourceKey={section as ArtistOsResourceKey}
      initialRows={data.rows}
      artists={data.artists}
      tableReady={data.tableReady}
      initialError={data.error}
    />
  );
}
