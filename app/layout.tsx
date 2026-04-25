import type { Metadata } from "next";
import { M_PLUS_Rounded_1c, Noto_Sans_JP } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

const display = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700", "800"],
});

const body = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "みんなの買い物リスト",
  description: "複数人で共有できる、無料運用前提の買い物リストアプリ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${display.variable} ${body.variable}`}>
        <div className="page-shell">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
