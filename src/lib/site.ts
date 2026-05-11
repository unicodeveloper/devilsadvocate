/**
 * Site-wide constants. Single source of truth for metadata, OG, manifest,
 * and brand asset rendering. Bumping a value here updates every consumer.
 */

const FALLBACK_URL = "http://localhost:3000";

/**
 * The canonical, public URL of the deployed app. Used for `metadataBase`,
 * absolute OG image URLs, and any social-share links. Set
 * `NEXT_PUBLIC_APP_URL` in production (e.g. `https://devils-advocate.up.railway.app`).
 */
export function siteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : undefined);
  return fromEnv?.replace(/\/$/, "") ?? FALLBACK_URL;
}

export const SITE = {
  // Public brand name. The product and the AI review engine share one
  // identity: "Devil's Advocate".
  name: "Devil's Advocate",
  // Short form used in PWA manifest and tight contexts. Truncates well
  // on Android home-screen labels.
  shortName: "Advocate",
  // Used as the trailing segment of `<title>` and in OG title-template.
  // Reads as a product descriptor, not a brand suffix.
  titleSuffix: "AI CIO",
  description:
    "Your AI CIO. Stress-tests every investment thesis against your mandate before IC — multi-agent debate, House View overlay, binding Devil's Advocate review.",
  shortDescription:
    "AI CIO that stress-tests every investment thesis before IC.",
  keywords: [
    "AI CIO",
    "investment memo",
    "fund manager",
    "stress test",
    "investment committee",
    "House View",
    "Devil's Advocate",
  ],
  /** Brand colors — must match the CSS tokens in globals.css. */
  brand: {
    bg: "#08090b",
    fg: "#F5F2EA",
    muted: "#9AA0AA",
    subtle: "#5D626C",
    border: "#1F2127",
    accentGlow: "rgba(245, 242, 234, 0.22)",
  },
  /** Locale for OG / opensearch. Update if the app ships in multiple locales. */
  locale: "en_US",
  /** Twitter / X username for `twitter:site` if applicable. */
  twitter: undefined as string | undefined,
} as const;
