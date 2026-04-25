import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function Home() {
  const { data: playlists, error } = supabase
    ? await supabase
        .from("playlists")
        .select("*")
        .order("created_at", { ascending: false })
    : { data: [], error: { message: "Supabase não configurado." } };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">
            Sistema interno de curadoria
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            🎧 Playlists IA — Só as Braba
          </h1>
          <p className="mt-2 text-muted-foreground">
            Dados reais puxados do Supabase para validar tua análise manual.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            Erro ao carregar dados: {error.message}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Playlist</th>
                <th className="px-4 py-3 text-left font-medium">Followers</th>
                <th className="px-4 py-3 text-left font-medium">Tracks</th>
                <th className="px-4 py-3 text-left font-medium">Score</th>
                <th className="px-4 py-3 text-left font-medium">Link</th>
              </tr>
            </thead>

            <tbody>
              {playlists && playlists.length > 0 ? (
                playlists.map((playlist: any) => (
                  <tr
                    key={playlist.id}
                    className="border-t border-border hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      {playlist.name || "Sem nome"}
                    </td>
                    <td className="px-4 py-3">
                      {playlist.followers ?? "-"}
                    </td>
                    <td className="px-4 py-3">{playlist.tracks ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-3 py-1">
                        {playlist.score ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={playlist.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4"
                      >
                        Abrir
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Nenhuma playlist cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
