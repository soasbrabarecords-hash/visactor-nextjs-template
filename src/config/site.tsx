import {
  BarChart3,
  Gauge,
  ListMusic,
  Radio,
  type LucideIcon,
} from "lucide-react";

export type SiteConfig = typeof siteConfig;
export type Navigation = {
  icon: LucideIcon;
  name: string;
  href: string;
};

export const siteConfig = {
  title: "VisActor Next Template",
  description: "Template for VisActor and Next.js",
};

export const navigations: Navigation[] = [
  {
    icon: Gauge,
    name: "Dashboard",
    href: "/",
  },
  {
    icon: BarChart3,
    name: "Charts Playlists",
    href: "/charts",
  },
  {
    icon: Radio,
    name: "Charts Music",
    href: "/charts/music",
  },
  {
    icon: ListMusic,
    name: "Playlists Monitoradas",
    href: "/playlists-monitoradas",
  },
];
