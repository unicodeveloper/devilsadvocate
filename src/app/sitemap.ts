import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * sitemap.xml — auto-served at `/sitemap.xml`.
 *
 * Only lists the publicly indexable URLs (matches the robots.txt allow list).
 * If more public surfaces open up later, add them here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
