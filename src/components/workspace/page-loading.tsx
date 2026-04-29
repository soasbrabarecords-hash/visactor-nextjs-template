import Container from "@/components/container";
import { TopNav } from "@/components/nav";

export default function PageLoading({ title }: { title: string }) {
  return (
    <div>
      <TopNav title={title} />
      <Container className="border-b border-border py-6">
        <div className="rounded-[28px] border border-border bg-card/60 p-6">
          <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
          <div className="mt-5 h-10 w-2/3 max-w-xl animate-pulse rounded-full bg-muted" />
          <div className="mt-4 h-4 w-1/2 max-w-lg animate-pulse rounded-full bg-muted" />
        </div>
      </Container>
      <Container className="grid gap-4 border-b border-border py-6 laptop:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-2xl border border-border bg-card/60"
          />
        ))}
      </Container>
      <Container className="border-b border-border py-6">
        <div className="h-80 animate-pulse rounded-[28px] border border-border bg-card/60" />
      </Container>
    </div>
  );
}
