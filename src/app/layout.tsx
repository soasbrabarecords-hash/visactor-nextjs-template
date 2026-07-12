import type { Metadata } from "next";
import { Geist } from "next/font/google";
import AppShell from "@/components/app-shell";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import "@/style/globals.css";
import { Providers } from "./providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={cn("bg-background font-sans", geist.variable)}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
