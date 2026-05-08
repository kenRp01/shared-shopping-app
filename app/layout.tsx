import type { Metadata } from "next";
import Link from "next/link";
import { ChunkReloadGuard } from "@/components/chunk-reload-guard";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShareShopi",
  description: "複数人で共有できる、無料運用前提の買い物リストアプリ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <ChunkReloadGuard />
        <div className="page-shell">
          <Nav />
          <main>{children}</main>
          <footer className="site-footer" aria-label="フッター">
            <Link href="/terms">利用規約</Link>
            <Link href="/privacy">プライバシー</Link>
            <Link href="/contact">問い合わせ</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
