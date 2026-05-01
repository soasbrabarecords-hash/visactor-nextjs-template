import Container from "@/components/container";

export default function Loading() {
  return (
    <Container className="py-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-8 w-64 animate-pulse rounded-full bg-muted" />
          <div className="h-9 w-48 animate-pulse rounded-full bg-muted" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="h-[320px] animate-pulse rounded-[28px] border border-border bg-card/60" />
          <div className="grid gap-4">
            <div className="h-[200px] animate-pulse rounded-[24px] border border-border bg-card/60" />
            <div className="h-[200px] animate-pulse rounded-[24px] border border-border bg-card/60" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[92px] animate-pulse rounded-[20px] border border-border bg-card/60"
            />
          ))}
        </div>
      </div>
    </Container>
  );
}
