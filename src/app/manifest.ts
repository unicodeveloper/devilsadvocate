import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Web app manifest — picked up by Android Chrome ("Add to home screen"),
 * Edge, and PWA-aware browsers. Icons are sourced from the auto-generated
 * /icon and /apple-icon routes so the manifest stays in sync with the
 * actual rendered assets.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} · ${SITE.titleSuffix}`,
    short_name: SITE.shortName,
    description: SITE.shortDescription,
    start_url: "/memos",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: SITE.brand.bg,
    background_color: SITE.brand.bg,
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
