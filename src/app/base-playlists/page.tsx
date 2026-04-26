import AddPlaylistForm from "@/components/dashboard/add-playlist-form";
import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import BasePlaylistsTable from "@/components/workspace/base-playlists-table";
import MetricGrid from "@/components/workspace/metric-grid";
import StatusBadge from "@/components/workspace/status-badge";
import { getBasePlaylistsPageData } from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function BasePlaylistsPage() {
  const data = await getBasePlaylistsPageData();

  return (
    <div>
      <TopNav title="Base de Playlists" />
      <PageIntro
        eyebrow={data.hero.eyebrow}
        title={data.hero.title}
        description={data.hero.description}
      />

      <MetricGrid metrics={data.metrics} />
      <AddPlaylistForm />

      <Container className="border-b border-border py-6">
        <div className="grid gap-4 desktop:grid-cols-3">
          {data.healthSummary.map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-border bg-card/70 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold">{item.label}</div>
                <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
              </div>
              <div className="mt-4 text-3xl font-semibold">{item.value}</div>
            </article>
          ))}
        </div>
      </Container>

      <BasePlaylistsTable rows={data.rows} />
    </div>
  );
}
