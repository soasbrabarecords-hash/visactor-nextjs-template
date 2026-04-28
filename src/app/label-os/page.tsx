import Link from "next/link";
import { Building2, Library, Mic2, Music2, Radio } from "lucide-react";
import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import StatCard from "@/components/label-os/stat-card";
import { getLabelOsStats } from "@/lib/label-os";

export const dynamic = "force-dynamic";

export default async function LabelOsPage() {
  const stats = await getLabelOsStats();

  return (
    <div>
      <PageIntro
        eyebrow="Gravadora"
        title="Label OS"
        description="Gerencie o catálogo da gravadora: artistas, faixas, splits e status de lançamento."
      />

      <Container className="py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total de Tracks" value={stats.totalTracks} icon={Music2} />
          <StatCard label="Total de Artistas" value={stats.totalArtists} icon={Mic2} />
          <StatCard label="Em Draft" value={stats.draftTracks} icon={Library} />
          <StatCard label="Lançadas" value={stats.releasedTracks} icon={Radio} />
        </div>

        <div className="mt-10">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Ações rápidas
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/label-os/tracks/new"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Music2 size={16} className="text-muted-foreground" />
              Nova Track
            </Link>
            <Link
              href="/label-os/artists/new"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Mic2 size={16} className="text-muted-foreground" />
              Novo Artista
            </Link>
            <Link
              href="/label-os/tracks"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Library size={16} className="text-muted-foreground" />
              Ver Tracks
            </Link>
            <Link
              href="/label-os/artists"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Radio size={16} className="text-muted-foreground" />
              Ver Artistas
            </Link>
            <Link
              href="/label-os/entities"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Building2 size={16} className="text-muted-foreground" />
              Entidades
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
