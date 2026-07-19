import type { Metadata } from "next";
import { AdsenseScript } from "@/components/adsense-script";
import { ChunkReloadGuard } from "@/components/chunk-reload-guard";
import { Nav } from "@/components/nav";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.shareshopi.workers.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "ShareShopi",
  title: {
    default: "ShareShopi | 共有できる買い物リスト",
    template: "%s | ShareShopi",
  },
  description: "ShareShopiは、家族や友人と買い物リストを共有できるシンプルなリストアプリです。個人利用はログイン不要、共有利用はログインして安全に管理できます。",
  keywords: ["買い物リスト", "共有買い物リスト", "ショッピングリスト", "ShareShopi", "リマインド", "家族共有"],
  authors: [{ name: "ShareShopi" }],
  creator: "ShareShopi",
  publisher: "ShareShopi",
  manifest: "/site.webmanifest",
  verification: {
    google: "m8eLNikr3IsMM7R_A4A3wV6_topSXFia7ZuuQzf6t18",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: "ShareShopi",
    title: "ShareShopi | 共有できる買い物リスト",
    description: "家族や友人と買い物リストを共有。個人利用はログイン不要で、共有リストはログインして安全に管理できます。",
    images: [
      {
        url: "/shareshopi-icon.png",
        width: 1024,
        height: 1024,
        alt: "ShareShopi",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "ShareShopi | 共有できる買い物リスト",
    description: "家族や友人と買い物リストを共有できるシンプルなリストアプリです。",
    images: ["/shareshopi-icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

const themeInitScript = `
(() => {
  try {
    const savedTheme = localStorage.getItem("shareshopi:theme");
    document.documentElement.dataset.theme = savedTheme === "light" ? "light" : "dark";
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AdsenseScript />
      </head>
      <body>
        <ChunkReloadGuard />
        <div className="page-shell">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
