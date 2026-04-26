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
  title: "SÓ AS BRABA System",
  description: "Sistema profissional de curadoria musical, radar de charts e inteligencia de playlists.",
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
