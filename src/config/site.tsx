import {
  BarChart3,
  Compass,
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
  title: "So as Braba Curation System",
  description: "Radar profissional de curadoria musical e inteligencia de playlists.",
};

export const navigations: Navigation[] = [
  {
    icon: Gauge,
    name: "Dashboard",
    href: "/",
  },
  {
    icon: Radio,
    name: "Radar Music",
    href: "/radar-music",
  },
  {
    icon: BarChart3,
    name: "Radar Playlists",
    href: "/radar-playlists",
  },
  {
    icon: ListMusic,
    name: "Base de Playlists",
    href: "/base-playlists",
  },
  {
    icon: Compass,
    name: "Curadoria",
    href: "/curadoria",
  },
];
