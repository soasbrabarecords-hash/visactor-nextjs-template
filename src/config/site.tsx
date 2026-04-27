import {
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
    href: "/dashboard",
  },
  {
    icon: Radio,
    name: "Radar Music",
    href: "/radar-music",
  },
  {
    icon: ListMusic,
    name: "Playlists Monitoradas",
    href: "/playlists-monitoradas",
  },
  {
    icon: Compass,
    name: "Curadoria",
    href: "/curadoria",
  },
];
