import Container from "@/components/container";

export default function Loading() {
  return (
    <Container className="py-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="h-7 w-52 animate-pulse rounded-full bg-muted" />
          <div className="h-9 w-48 animate-pulse rounded-full bg-muted" />
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(0,1.08fr)_304px]">
          <div className="h-[150px] animate-pulse rounded-[24px] border border-border bg-card/60" />
          <div className="grid gap-2">
            <div className="h-[150px] animate-pulse rounded-[22px] border border-border bg-card/60" />
            <div className="h-[180px] animate-pulse rounded-[22px] border border-border bg-card/60" />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[78px] animate-pulse rounded-[18px] border border-border bg-card/60"
            />
          ))}
        </div>
      </div>
    </Container>
  );
}
