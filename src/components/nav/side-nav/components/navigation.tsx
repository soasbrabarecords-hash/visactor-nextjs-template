"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { navigations, type Navigation as NavigationItem } from "@/config/site";
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
      return pathname === "/playlist-os" || pathname.startsWith("/playlist-os/");
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
      return pathname === "/playlists-ia" || pathname.startsWith("/playlists-ia/");
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

  function isNavigationActive(navigation: NavigationItem) {
    return isActive(navigation.href) || Boolean(navigation.children?.some((child) => isActive(child.href)));
  }

  function isGroupOpen(navigation: NavigationItem) {
    return openGroups[navigation.name] ?? isNavigationActive(navigation);
  }

  function renderLinkItem(navigation: NavigationItem, variant: "root" | "child" = "root") {
    const Icon = navigation.icon;
    const active = isActive(navigation.href);

    return (
      <Link
        key={navigation.name}
        href={navigation.href}
        className={cn(
          "group relative flex items-center overflow-hidden rounded-2xl border transition-all duration-300 ease-out",
          "before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.92),rgba(255,255,255,0.42)_36%,rgba(255,255,255,0.12)_72%)] before:opacity-0 before:transition-opacity before:duration-300 dark:before:bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),rgba(255,255,255,0.08)_38%,rgba(255,255,255,0.02)_74%)]",
          "after:absolute after:inset-x-4 after:top-0 after:h-px after:bg-white/75 after:opacity-0 after:transition-opacity after:duration-300 dark:after:bg-white/35",
          "hover:-translate-y-0.5 hover:border-white/70 hover:bg-white/55 hover:shadow-[0_12px_30px_rgba(15,23,42,0.10)] hover:backdrop-blur-xl hover:before:opacity-100 hover:after:opacity-100 dark:hover:border-white/12 dark:hover:bg-white/[0.075] dark:hover:shadow-[0_14px_34px_rgba(0,0,0,0.28)]",
          variant === "root" ? "px-3 py-2.5" : "px-3 py-2",
          active
            ? "border-white/80 bg-white/70 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/12 dark:bg-white/[0.09] dark:shadow-[0_16px_38px_rgba(0,0,0,0.32)]"
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
        <button
          type="button"
          aria-expanded={open}
          aria-controls={groupId}
          onClick={() =>
            setOpenGroups((current) => ({
              ...current,
              [navigation.name]: !(current[navigation.name] ?? active),
            }))
          }
          className={cn(
            "group relative flex w-full items-center overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition-all duration-300 ease-out",
            "before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.92),rgba(255,255,255,0.42)_36%,rgba(255,255,255,0.12)_72%)] before:opacity-0 before:transition-opacity before:duration-300 dark:before:bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),rgba(255,255,255,0.08)_38%,rgba(255,255,255,0.02)_74%)]",
            "hover:-translate-y-0.5 hover:border-white/70 hover:bg-white/55 hover:shadow-[0_12px_30px_rgba(15,23,42,0.10)] hover:backdrop-blur-xl hover:before:opacity-100 dark:hover:border-white/12 dark:hover:bg-white/[0.075] dark:hover:shadow-[0_14px_34px_rgba(0,0,0,0.28)]",
            active
              ? "border-white/80 bg-white/70 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/12 dark:bg-white/[0.09] dark:shadow-[0_16px_38px_rgba(0,0,0,0.32)]"
              : "border-transparent bg-transparent",
          )}
        >
          <Icon
            size={19}
            className={cn(
              "relative z-10 mr-3 shrink-0 transition-colors duration-300",
              active
                ? "text-slate-950 dark:text-white"
                : "text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white",
            )}
          />
          <span
            className={cn(
              "relative z-10 flex-1 text-[15px] font-medium transition-colors duration-300",
              active
                ? "text-slate-950 dark:text-white"
                : "text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white",
            )}
          >
            {navigation.name}
          </span>
          <ChevronDown
            size={16}
            className={cn(
              "relative z-10 transition duration-300",
              open ? "rotate-180" : "rotate-0",
              active
                ? "text-slate-950 dark:text-white"
                : "text-slate-500 group-hover:text-slate-950 dark:text-slate-400 dark:group-hover:text-white",
            )}
          />
        </button>

        {open ? (
          <div id={groupId} className="ml-4 grid gap-1 border-l border-border/70 pl-2.5">
            {navigation.children?.map((child) => renderLinkItem(child, "child"))}
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
      <nav className="flex flex-grow flex-col gap-y-1.5 p-3">
        {navigations.filter(isNavigationVisible).map(renderNavigationItem)}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <User />
      </div>
    </div>
  );
}
