import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import CurationTable from "@/components/workspace/curation-table";
import SpotifyAccountPlaylistsPanel from "@/components/workspace/spotify-account-playlists-panel";

export const dynamic = "force-dynamic";

export default async function CuradoriaPage() {
  return (
    <div>
      <TopNav title="Curadoria" />
      <PageIntro
        eyebrow="Mesa de decisao"
        title="Curadoria"
        description="Conecte a conta Spotify, escolha uma playlist e use a leitura de streams BR para decidir o que adicionar, observar ou remover."
      />

      <SpotifyAccountPlaylistsPanel
        eyebrow="Login Spotify"
        title="Conectar conta para curadoria"
        description="A conexao solicita leitura das playlists e permissoes de edicao para futuramente ajustar titulo, descricao, capa e lista de musicas."
      />

      <CurationTable rows={[]} />
    </div>
  );
}
