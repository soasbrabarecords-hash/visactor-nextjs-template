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
  getArtistOsResourceConfig,
  type ArtistOsResourceKey,
} from "@/lib/artist-os-config";

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
}: {
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
}) {
  const content = (
    <div className="group rounded-[26px] border border-white/10 bg-white/[0.045] p-4 transition hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.065]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
          <Icon className="h-5 w-5 text-white/70" />
        </div>
        {href ? (
          <ArrowRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/65" />
        ) : null}
      </div>
      <h3 className="mt-4 text-base font-black text-white">{title}</h3>
      <p className="mt-1 text-sm font-medium leading-6 text-white/48">{description}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function ReportsPage() {
  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_90px_-60px_rgba(0,0,0,0.9)]">
      <div className="max-w-3xl">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
          Relatórios
        </div>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">
          ArtistOS — inteligência executiva
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-white/50">
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
        />
        <PlaceholderCard
          title="Relatório financeiro"
          description="Entradas, saídas, lucro/prejuízo e atrasos."
          href="/artist-os/finance"
          icon={BadgeDollarSign}
        />
        <PlaceholderCard
          title="Publicidade"
          description="Campanhas, marcas, entregas e comprovações."
          href="/artist-os/brand-deals"
          icon={Megaphone}
        />
        <PlaceholderCard
          title="Tarefas"
          description="Pendências por responsável, prazo e prioridade."
          href="/artist-os/tasks"
          icon={ClipboardCheck}
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
    <section className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_90px_-60px_rgba(0,0,0,0.9)]">
      <div className="flex flex-col gap-4 laptop:flex-row laptop:items-start laptop:justify-between">
        <div className="max-w-3xl">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
            Configurações
          </div>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">
            ArtistOS pronto para multi-perfis
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-white/50">
            A base ja nasce com workspace, created_by e estrutura para roles:
            admin, manager, financeiro, artista e equipe. No MVP, a autenticação
            atual do sistema continua controlando o acesso.
          </p>
        </div>
        <div className="rounded-[24px] border border-emerald-300/18 bg-emerald-300/[0.08] p-4 text-emerald-100">
          <Settings2 className="h-5 w-5" />
          <div className="mt-3 text-sm font-black">MVP seguro</div>
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

  const config = getArtistOsResourceConfig(section);
  if (!config) notFound();

  const data = await getArtistOsResource(section as ArtistOsResourceKey);

  return (
    <ArtistOsCrudPanel
      config={config}
      initialRows={data.rows}
      artists={data.artists}
      tableReady={data.tableReady}
      initialError={data.error}
    />
  );
}
