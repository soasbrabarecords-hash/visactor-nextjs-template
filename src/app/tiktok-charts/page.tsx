import PageIntro from "@/components/page-intro";
import { TopNav } from "@/components/nav";
import ModuleGuard from "@/components/workspace/module-guard";
import TikTokChartsTable from "@/components/workspace/tiktok-charts-table";
import { fetchTikTokPublicChart } from "@/lib/tiktok-public-charts";

export const revalidate = 300;

export default async function TikTokChartsPage() {
  const chart = await fetchTikTokPublicChart().catch(() => null);

  return (
    <ModuleGuard moduleKey="playlist_os">
      <div>
        <TopNav title="Playlist OS" />
        <PageIntro
          eyebrow="Curadoria / Radar Music"
          title="TikTok Charts — Brasil"
          description="Leitura externa do chart publico de TikTok Brasil para testar sinais de descoberta antes de levar esse calor para o Radar Music."
        />

        {chart ? (
          <TikTokChartsTable chart={chart} />
        ) : (
          <div className="mx-auto w-full max-w-8xl px-6 py-8 tablet:px-10 desktop:px-14">
            <div className="rounded-[28px] border border-red-500/20 bg-red-500/5 p-6">
              <div className="text-xs uppercase tracking-[0.18em] text-red-300/80">
                Fonte indisponivel
              </div>
              <h2 className="mt-2 text-2xl font-semibold">
                Nao conseguimos puxar o TikTok Charts agora.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Como essa versao ainda usa uma fonte publica externa, o painel pode
                oscilar. O Radar Music continua funcionando e volta a cruzar os sinais
                assim que a leitura externa responder de novo.
              </p>
            </div>
          </div>
        )}
      </div>
    </ModuleGuard>
  );
}
