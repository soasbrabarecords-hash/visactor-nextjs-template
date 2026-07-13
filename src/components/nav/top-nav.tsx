"use client";

import Container from "../container";
import { ThemeToggle } from "../theme-toggle";

export default function TopNav({ title }: { title: string }) {
  return (
    <header className="border-b border-border bg-card/95">
      <Container className="flex h-14 items-center justify-between">
        <h1 className="text-xl font-semibold tracking-[-0.025em]">{title}</h1>
        <ThemeToggle />
      </Container>
    </header>
  );
}
