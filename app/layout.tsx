import type { Metadata } from "next";
import { ChunkReloadGuard } from "@/components/chunk-reload-guard";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShareShopi",
  description: "複数人で共有できる、無料運用前提の買い物リストアプリ",
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
