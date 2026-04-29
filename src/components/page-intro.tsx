import type { ReactNode } from "react";
import Container from "@/components/container";

export default function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="grid gap-5 laptop:grid-cols-[1fr_auto] laptop:items-center">
        <div className="space-y-2">
          {eyebrow ? (
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-3xl font-semibold">{title}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
      </div>
    </Container>
  );
}
