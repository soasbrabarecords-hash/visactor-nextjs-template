"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { type Navigation as NavigationItem, navigations } from "@/config/site";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { cn } from "@/lib/utils";
import User from "./user";

export default function Navigation() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const workspaceAccess = useWorkspaceAccess();

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/" || pathname === "/dashboard";
    }

    if (href === "/playlist-os") {
      return (
        pathname === "/playlist-os" || pathname.startsWith("/playlist-os/")
      );
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
      return pathname === "/curadoria" || pathname.startsWith("/curadoria/");
    }

    if (href === "/playlists-ia") {
      return (
        pathname === "/playlists-ia" || pathname.startsWith("/playlists-ia/")
      );
    }

    if (href === "/novidades") {
      return pathname === "/novidades";
    }

    if (href === "/label-os") {
      return pathname === "/label-os" || pathname.startsWith("/label-os/");
    }

    if (href === "/artist-os") {
      return pathname === "/artist-os" || pathname.startsWith("/artist-os/");
    }

    if (href === "/spotify-charts") {
      return (
        pathname === "/spotify-charts" ||
        pathname.startsWith("/spotify-charts/")
      );
    }

    if (href === "/tiktok-charts") {
      return (
        pathname === "/tiktok-charts" || pathname.startsWith("/tiktok-charts/")
      );
    }

    if (href === "/configuracoes") {
      return (
        pathname === "/configuracoes" || pathname.startsWith("/configuracoes/")
      );
    }

    return pathname === href;
  }

  function isNavigationActive(navigation: NavigationItem) {
    return (
      isActive(navigation.href) ||
      Boolean(navigation.children?.some((child) => isActive(child.href)))
    );
  }

  function isGroupOpen(navigation: NavigationItem) {
    return openGroups[navigation.name] ?? isNavigationActive(navigation);
  }

  function renderLinkItem(
    navigation: NavigationItem,
    variant: "root" | "child" = "root",
  ) {
    const Icon = navigation.icon;
    const sectionRootChild =
      variant === "child" &&
      (navigation.href === "/label-os" || navigation.href === "/artist-os");
    const nestedLabelSection =
      variant === "child" &&
      ["/label-os/tracks", "/label-os/artists", "/label-os/entities"].includes(
        navigation.href,
      );
    const active = sectionRootChild
      ? pathname === navigation.href
      : nestedLabelSection
        ? pathname === navigation.href ||
          pathname.startsWith(`${navigation.href}/`)
        : isActive(navigation.href);

    return (
      <Link
        key={navigation.name}
        href={navigation.href}
        className={cn(
          "group relative flex items-center overflow-hidden rounded-xl border transition-colors duration-200",
          "hover:border-border hover:bg-accent/65",
          variant === "root" ? "px-3 py-2.5" : "px-3 py-2",
          active
            ? "border-border bg-accent text-accent-foreground"
            : "border-transparent bg-transparent",
        )}
      >
        <Icon
          size={19}
          className={cn(
            "relative z-10 shrink-0 transition-colors duration-300",
            variant === "root" ? "mr-3" : "mr-2.5",
            active
              ? "text-slate-950 dark:text-white"
              : "text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white",
          )}
        />
        <span
          className={cn(
            "relative z-10 font-medium transition-colors duration-300",
            variant === "root" ? "text-[15px]" : "text-[13px]",
            active
              ? "text-slate-950 dark:text-white"
              : "text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white",
          )}
        >
          {navigation.name}
        </span>
      </Link>
    );
  }

  function renderNavigationItem(navigation: NavigationItem) {
    const Icon = navigation.icon;
    const hasChildren = Boolean(navigation.children?.length);

    if (!hasChildren) return renderLinkItem(navigation);

    const active = isNavigationActive(navigation);
    const open = isGroupOpen(navigation);
    const groupId = `sidebar-group-${navigation.name.toLowerCase().replace(/\s+/g, "-")}`;

    return (
      <div key={navigation.name} className="space-y-1">
        <div
          className={cn(
            "group relative flex w-full items-center overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors duration-200",
            "hover:border-border hover:bg-accent/65",
            active
              ? "border-border bg-accent text-accent-foreground"
              : "border-transparent bg-transparent",
          )}
        >
          <Link
            href={navigation.href}
            className="relative z-10 flex min-w-0 flex-1 items-center"
          >
            <Icon
              size={19}
              className={cn(
                "mr-3 shrink-0 transition-colors duration-300",
                active
                  ? "text-slate-950 dark:text-white"
                  : "text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white",
              )}
            />
            <span
              className={cn(
                "truncate text-[15px] font-medium transition-colors duration-300",
                active
                  ? "text-slate-950 dark:text-white"
                  : "text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white",
              )}
            >
              {navigation.name}
            </span>
          </Link>
          <button
            type="button"
            aria-label={`${open ? "Recolher" : "Expandir"} menu ${navigation.name}`}
            aria-expanded={open}
            aria-controls={groupId}
            onClick={() =>
              setOpenGroups((current) => ({
                ...current,
                [navigation.name]: !(current[navigation.name] ?? active),
              }))
            }
            className="relative z-10 -mr-1 ml-1 rounded-lg p-1.5 transition-colors hover:bg-background/70"
          >
            <ChevronDown
              size={16}
              className={cn(
                "transition duration-300",
                open ? "rotate-180" : "rotate-0",
                active
                  ? "text-slate-950 dark:text-white"
                  : "text-slate-500 group-hover:text-slate-950 dark:text-slate-400 dark:group-hover:text-white",
              )}
            />
          </button>
        </div>

        {open ? (
          <div
            id={groupId}
            className="ml-4 grid gap-1 border-l border-border/70 pl-2.5"
          >
            {navigation.children?.map((child) =>
              renderLinkItem(child, "child"),
            )}
          </div>
        ) : null}
      </div>
    );
  }

  function isNavigationVisible(navigation: NavigationItem) {
    if (!navigation.moduleKey || workspaceAccess.isLoading) {
      return true;
    }

    return workspaceAccess.canAccessModule(navigation.moduleKey);
  }

  return (
    <div className="flex flex-grow flex-col">
      <nav className="flex flex-grow flex-col gap-y-1 overflow-y-auto px-3 py-2">
        {navigations.filter(isNavigationVisible).map(renderNavigationItem)}
      </nav>

      <div className="border-t border-border/70 px-3 py-3">
        <User />
      </div>
    </div>
  );
}
