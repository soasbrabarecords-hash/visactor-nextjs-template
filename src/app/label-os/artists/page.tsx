import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import { getLabelArtists } from "@/lib/label-os";

export const dynamic = "force-dynamic";

export default async function ArtistsPage() {
  const artists = await getLabelArtists();

  return (
    <div>
      <PageIntro
        eyebrow="Label OS"
        title="Artistas"
        description="Catálogo de artistas da gravadora."
        action={
          <Link
            href="/label-os/artists/new"
            className="flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            <Plus size={15} />
            Novo Artista
          </Link>
        }
      />

      <Container className="py-8">
        {artists.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Nenhum artista cadastrado ainda.{" "}
            <Link href="/label-os/artists/new" className="underline underline-offset-2">
              Cadastrar primeiro artista
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-900">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome artístico</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Instagram</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Spotify</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {artists.map((artist) => (
                  <tr
                    key={artist.id}
                    className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <td className="px-4 py-3 font-medium">
                      {artist.artist_name ?? artist.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {artist.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {artist.instagram ? (
                        <a
                          href={`https://instagram.com/${artist.instagram.replace("@", "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          {artist.instagram}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {artist.spotify_url ? (
                        <a
                          href={artist.spotify_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          Ver perfil
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/label-os/artists/${artist.id}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil size={12} />
                        Editar
                      </Link>
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
