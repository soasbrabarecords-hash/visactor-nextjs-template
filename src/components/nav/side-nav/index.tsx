"use client";

import { ArrowLeftToLine, ArrowRightToLine } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Navigation from "./components/navigation";

export default function SideNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className={cn(
          "fixed left-0 top-12 z-50 rounded-r-xl border border-l-0 border-border bg-background px-2.5 py-2 text-foreground shadow-sm hover:bg-accent tablet:hidden",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-[232px]" : "translate-x-0",
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ArrowLeftToLine size={18} />
        ) : (
          <ArrowRightToLine size={18} />
        )}
      </button>
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-40 flex h-[100dvh] w-[232px] shrink-0 flex-col border-r border-border/70 bg-background/95 backdrop-blur-xl tablet:sticky tablet:translate-x-0",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center px-5">
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">
              Music Business
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Operating System
            </div>
          </div>
        </div>
        <Navigation />
      </aside>
    </>
  );
}
