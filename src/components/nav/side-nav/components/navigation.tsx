"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigations, systemNavigations, type Navigation as NavigationItem } from "@/config/site";
import { cn } from "@/lib/utils";

export default function Navigation() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/" || pathname === "/dashboard";
    }

    if (href === "/radar-music") {
      return pathname === "/radar-music" || pathname === "/charts/music";
    }

    if (href === "/playlists-concorrentes") {
      return (
        pathname === "/playlists-concorrentes" ||
        pathname === "/playlists-monitoradas" ||
        pathname === "/base-playlists" ||
        pathname === "/radar-playlists" ||
        pathname === "/charts" ||
        pathname.startsWith("/playlists/")
      );
    }

    if (href === "/curadoria") {
      return pathname === "/curadoria";
    }

    if (href === "/novidades") {
      return pathname === "/novidades";
    }

    if (href === "/label-os") {
      return pathname === "/label-os" || pathname.startsWith("/label-os/");
    }

    if (href === "/spotify-charts") {
      return pathname === "/spotify-charts" || pathname.startsWith("/spotify-charts/");
    }

    if (href === "/tiktok-charts") {
      return pathname === "/tiktok-charts" || pathname.startsWith("/tiktok-charts/");
    }

    if (href === "/configuracoes") {
      return pathname === "/configuracoes" || pathname.startsWith("/configuracoes/");
    }

    return pathname === href;
  }

  function renderNavigationItem(navigation: NavigationItem) {
    const Icon = navigation.icon;

    return (
      <Link
        key={navigation.name}
        href={navigation.href}
        className={cn(
          "flex items-center rounded-lg px-3 py-2.5 hover:bg-slate-200 dark:hover:bg-slate-800",
          isActive(navigation.href)
            ? "bg-slate-200 dark:bg-slate-800"
            : "bg-transparent",
        )}
      >
        <Icon
          size={19}
          className="mr-3 shrink-0 text-slate-800 dark:text-slate-200"
        />
        <span className="text-[15px] font-medium text-slate-700 dark:text-slate-300">
          {navigation.name}
        </span>
      </Link>
    );
  }

  return (
    <div className="flex flex-grow flex-col">
      <nav className="flex flex-grow flex-col gap-y-1.5 p-3">
        {navigations.map(renderNavigationItem)}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
          Sistema
        </div>
        <nav className="flex flex-col gap-y-1.5">
          {systemNavigations.map(renderNavigationItem)}
        </nav>
      </div>
    </div>
  );
}
