import {
  BadgeDollarSign,
  BarChart2,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Compass,
  FileSignature,
  Flame,
  Library,
  ListMusic,
  type LucideIcon,
  Megaphone,
  Music2,
  Settings2,
  UsersRound,
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
  title: "Music Business OS",
  description:
    "Sistema operacional para selos, artistas, curadoria e gestão musical.",
};

export const navigations: Navigation[] = [
  {
    icon: ListMusic,
    name: "Playlist OS",
    href: "/playlist-os",
    moduleKey: "playlist_os",
    children: [
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
    children: [
      {
        icon: Music2,
        name: "Catálogo",
        href: "/label-os/tracks",
      },
      {
        icon: UsersRound,
        name: "Artistas",
        href: "/label-os/artists",
      },
      {
        icon: Building2,
        name: "Entidades",
        href: "/label-os/entities",
      },
    ],
  },
  {
    icon: BriefcaseBusiness,
    name: "Business OS",
    href: "/artist-os",
    moduleKey: "artist_os",
    children: [
      {
        icon: UsersRound,
        name: "Artistas",
        href: "/artist-os/artists",
      },
      {
        icon: CalendarDays,
        name: "Agenda",
        href: "/artist-os/shows",
      },
      {
        icon: BriefcaseBusiness,
        name: "Negociações",
        href: "/artist-os/deals",
      },
      {
        icon: Megaphone,
        name: "Publicidade",
        href: "/artist-os/brand-deals",
      },
      {
        icon: BadgeDollarSign,
        name: "Financeiro",
        href: "/artist-os/finance",
      },
      {
        icon: FileSignature,
        name: "Contratos",
        href: "/artist-os/contracts",
      },
      {
        icon: ClipboardCheck,
        name: "Tarefas",
        href: "/artist-os/tasks",
      },
      {
        icon: BarChart3,
        name: "Relatórios",
        href: "/artist-os/reports",
      },
      {
        icon: Settings2,
        name: "Configurações",
        href: "/artist-os/settings",
      },
    ],
  },
];

export const systemNavigations: Navigation[] = [
  {
    icon: Settings2,
    name: "Configurações",
    href: "/configuracoes",
  },
];
