export default async function Home() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let playlists: any[] = [];
  let errorMessage = "";

  if (!supabaseUrl || !supabaseKey) {
    errorMessage = "Supabase não configurado.";
  } else {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/playlists?select=*&order=created_at.desc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      errorMessage = await response.text();
    } else {
      playlists = await response.json();
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-sm text-muted-foreground">
          Sistema interno de curadoria
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          🎧 Playlists IA — Só as Braba
        </h1>

        <p className="mt-2 text-muted-foreground">
          Dados reais puxados do Supabase.
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            Erro: {errorMessage}
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left">Playlist</th>
                <th className="px-4 py-3 text-left">Followers</th>
                <th className="px-4 py-3 text-left">Tracks</th>
                <th className="px-4 py-3 text-left">Score</th>
                <th className="px-4 py-3 text-left">Link</th>
              </tr>
            </thead>

            <tbody>
              {playlists.length > 0 ? (
                playlists.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      {p.name || "Sem nome"}
                    </td>
                    <td className="px-4 py-3">{p.followers ?? "-"}</td>
                    <td className="px-4 py-3">{p.tracks ?? "-"}</td>
                    <td className="px-4 py-3">{p.score ?? "-"}</td>
                    <td className="px-4 py-3">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Abrir
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    Nenhuma playlist encontrada.
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
