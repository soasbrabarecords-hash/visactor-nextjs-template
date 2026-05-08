"use client";

import Container from "../container";
import { ThemeToggle } from "../theme-toggle";

export default function TopNav({ title }: { title: string }) {
  return (
    <header className="border-b border-border">
      <Container className="flex h-16 items-center justify-between">
        <h1 className="text-2xl font-medium">{title}</h1>
        <ThemeToggle />
      </Container>
    </header>
  );
}
