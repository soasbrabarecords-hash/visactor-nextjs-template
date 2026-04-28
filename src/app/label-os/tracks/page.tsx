import Link from "next/link";
import { Plus } from "lucide-react";
import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import { getLabelTracks } from "@/lib/label-os";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Pronta",
  released: "Lançada",
  archived: "Arquivada",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  ready: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  released: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  archived: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export default async function TracksPage() {
  const tracks = await getLabelTracks();

  return (
    <div>
      <PageIntro
        eyebrow="Label OS"
        title="Tracks"
        description="Catálogo de faixas da gravadora."
        action={
          <Link
            href="/label-os/tracks/new"
            className="flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            <Plus size={15} />
            Nova Track
          </Link>
        }
      />

      <Container className="py-8">
        {tracks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Nenhuma track cadastrada ainda.{" "}
            <Link href="/label-os/tracks/new" className="underline underline-offset-2">
              Cadastrar primeira track
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-900">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Título</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Gênero</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Lançamento</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <tr
                    key={track.id}
                    className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/label-os/tracks/${track.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {track.title}
                      </Link>
                      {track.version && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({track.version})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[track.status] ?? STATUS_COLOR.draft}`}
                      >
                        {STATUS_LABEL[track.status] ?? track.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {track.genre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {track.release_date
                        ? new Date(track.release_date).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </div>
  );
}
