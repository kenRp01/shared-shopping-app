import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.shareshopi.workers.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/login", "/terms", "/privacy", "/contact", "/llms.txt", "/site.webmanifest"],
        disallow: ["/api/", "/app", "/lists/", "/invite/", "/public/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
