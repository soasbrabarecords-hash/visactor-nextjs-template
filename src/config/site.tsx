import {
  Compass,
  Gauge,
  ListMusic,
  Library,
  BarChart2,
  Flame,
  Settings2,
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
    href: "/dashboard",
  },
  {
    icon: ListMusic,
    name: "Playlists Analytics",
    href: "/playlists-concorrentes",
  },
  {
    icon: Compass,
    name: "Playlists",
    href: "/curadoria",
  },
  {
    icon: BarChart2,
    name: "Spotify Charts",
    href: "/spotify-charts",
  },
  {
    icon: Flame,
    name: "TikTok Charts",
    href: "/tiktok-charts",
  },
  {
    icon: Library,
    name: "Label OS",
    href: "/label-os",
  },
];

export const systemNavigations: Navigation[] = [
  {
    icon: Settings2,
    name: "Configuracoes",
    href: "/configuracoes",
  },
];
