import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * robots.txt — auto-served at `/robots.txt`.
 *
 * Closed indexing posture: only the root and the login page are crawlable.
 * Every authenticated surface, every API route, and every user-content URL
 * is blocked. We rely on this *plus* a per-route `robots: { index: false }`
 * metadata directive on the (app) group as defense in depth — well-behaved
 * crawlers (Google, Bing) respect both; bad actors at least face a
 * `<meta name="robots">` even if they ignore robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: [
          "/memos",
          "/memos/",
          "/funds",
          "/funds/",
          "/exposure",
          "/exposure/",
          "/house-view",
          "/house-view/",
          "/rules",
          "/rules/",
          "/review",
          "/review/",
          "/groups",
          "/groups/",
          "/api/",
          "/_next/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
