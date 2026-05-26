import Container from "@/components/container";

export default function Loading() {
  return (
    <Container className="py-8">
      <div className="space-y-5">
        <div className="h-64 animate-pulse rounded-[36px] bg-card/60 ring-1 ring-border" />
        <div className="grid gap-4 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-[300px] animate-pulse rounded-[32px] bg-card/60 ring-1 ring-border" />
          ))}
        </div>
      </div>
    </Container>
  );
}
