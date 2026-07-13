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
import Link from "next/link";
import { notFound } from "next/navigation";
import ArtistOsCrudPanel from "@/components/artist-os/artist-os-crud-panel";
import { getArtistOsResource } from "@/lib/artist-os";
import {
  type ArtistOsResourceKey,
  artistOsNavigation,
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
    emerald:
      "border-emerald-500/15 bg-card/80 text-emerald-700 dark:text-emerald-200",
    sky: "border-sky-500/15 bg-card/80 text-sky-700 dark:text-sky-200",
    amber: "border-amber-500/15 bg-card/80 text-amber-700 dark:text-amber-200",
    rose: "border-rose-500/15 bg-card/80 text-rose-700 dark:text-rose-200",
    slate: "border-border/70 bg-card/80 text-foreground",
  } as const;

  const content = (
    <div
      className={cn(
        "group rounded-[24px] border p-4 shadow-[0_16px_50px_-46px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:shadow-md",
        tones[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="bg-current/[0.07] ring-current/10 flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset">
          <Icon className="h-5 w-5" />
        </div>
        {href ? (
          <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
        ) : null}
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function ReportsPage() {
  return (
    <section className="rounded-[28px] border border-border/70 bg-card/80 p-5 shadow-[0_18px_68px_-58px_rgba(15,23,42,0.32)] backdrop-blur-xl">
      <div className="max-w-3xl">
        <div className="text-xs font-medium text-muted-foreground">
          Relatórios
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground">
          Business OS — inteligência executiva
        </h2>
        <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
          Estrutura inicial para relatórios de shows, caixa, publicidade,
          tarefas e performance por artista. A geração avançada entra na próxima
          etapa.
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
    <section className="rounded-[28px] border border-border/70 bg-card/80 p-5 shadow-[0_18px_68px_-58px_rgba(15,23,42,0.32)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 laptop:flex-row laptop:items-start laptop:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-medium text-muted-foreground">
            Configurações
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground">
            Business OS pronto para multi-perfis
          </h2>
          <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
            A base já nasce com workspace, created_by e estrutura para roles:
            admin, manager, financeiro, artista e equipe. No MVP, a autenticação
            atual do sistema continua controlando o acesso.
          </p>
        </div>
        <div className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/[0.08] p-4 text-emerald-800 dark:text-emerald-200">
          <Settings2 className="h-5 w-5" />
          <div className="mt-3 text-sm font-semibold">MVP seguro</div>
          <div className="mt-1 text-xs leading-5 text-emerald-800/75 dark:text-emerald-200/75">
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
            tone={
              item.key === "brand-deals"
                ? "amber"
                : item.key === "tasks"
                  ? "rose"
                  : "sky"
            }
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
