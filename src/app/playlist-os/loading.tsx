import Container from "@/components/container";
import { TopNav } from "@/components/nav";

export default function PlaylistOsLoading() {
  return (
    <>
      <TopNav title="Playlist OS" />
      <div className="min-h-[calc(100dvh-4rem)] bg-[#08090c]">
        <Container className="py-8">
          <div
            className="mx-auto max-w-7xl animate-pulse motion-reduce:animate-none"
            role="status"
            aria-live="polite"
          >
            <span className="sr-only">Carregando Music Intelligence…</span>
            <div className="h-4 w-44 rounded-full bg-white/[0.06]" />
            <div className="mt-4 h-10 w-full max-w-xl rounded-2xl bg-white/[0.06]" />
            <div className="mt-3 h-4 w-full max-w-2xl rounded-full bg-white/[0.04]" />
            <div className="mt-8 h-40 rounded-[26px] border border-white/[0.06] bg-white/[0.025]" />
            <div className="mt-4 h-[360px] rounded-[30px] border border-white/[0.06] bg-white/[0.025]" />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="h-80 rounded-[26px] border border-white/[0.06] bg-white/[0.025]" />
              <div className="h-80 rounded-[26px] border border-white/[0.06] bg-white/[0.025]" />
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
