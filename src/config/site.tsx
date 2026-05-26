import {
  Compass,
  ListMusic,
  Library,
  BarChart2,
  Bot,
  BriefcaseBusiness,
  Flame,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/lib/workspace-access";

export type SiteConfig = typeof siteConfig;
export type Navigation = {
  icon: LucideIcon;
  name: string;
  href: string;
  moduleKey?: ModuleKey;
  children?: Navigation[];
};

export const siteConfig = {
  title: "SÓ AS BRABA System",
  description: "Sistema profissional de curadoria musical, radar de charts e inteligencia de playlists.",
};

export const navigations: Navigation[] = [
  {
    icon: ListMusic,
    name: "Playlist OS",
    href: "/playlist-os",
    moduleKey: "playlist_os",
    children: [
      {
        icon: BarChart2,
        name: "Visão geral",
        href: "/playlist-os",
      },
      {
        icon: Compass,
        name: "Playlists",
        href: "/curadoria",
      },
      {
        icon: Bot,
        name: "Playlists IA",
        href: "/playlists-ia",
      },
      {
        icon: ListMusic,
        name: "Playlists Analytics",
        href: "/playlists-concorrentes",
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
    ],
  },
  {
    icon: Library,
    name: "Label OS",
    href: "/label-os",
    moduleKey: "label_os",
  },
  {
    icon: BriefcaseBusiness,
    name: "Artist OS",
    href: "/artist-os",
    moduleKey: "artist_os",
  },
];

export const systemNavigations: Navigation[] = [
  {
    icon: Settings2,
    name: "Configurações",
    href: "/configuracoes",
  },
];
