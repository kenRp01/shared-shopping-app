import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.shareshopi.workers.dev";

const publicPaths = [
  { path: "/", priority: 1 },
  { path: "/about", priority: 0.8 },
  { path: "/login", priority: 0.6 },
  { path: "/terms", priority: 0.4 },
  { path: "/privacy", priority: 0.4 },
  { path: "/contact", priority: 0.5 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return publicPaths.map(({ path, priority }) => ({
    url: new URL(path, siteUrl).toString(),
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority,
  }));
}
