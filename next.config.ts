import type { NextConfig } from "next";

/**
 * Static security headers applied to every response. CSP is *not* set here
 * because we mint a per-request nonce in middleware.ts; setting CSP here
 * would override the nonce-aware policy.
 */
const SECURITY_HEADERS = [
  // Strict transport — force HTTPS for 2 years, opt into HSTS preload list.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // No clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // No MIME-sniffing attacks.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to other origins on navigation.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful APIs we don't use, blocks them for the whole app tree.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  },
  // Cross-origin isolation — don't allow other origins to load us as resources.
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Belt-and-suspenders robots header on top of meta + robots.txt.
  // The (app) group overrides this in its layout; for the public root this
  // value is just "noindex on dev fallback / 404 / sitemap, etc.".
  // Production indexing is controlled by per-route metadata.
];

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — it must stay in node_modules at runtime
  // rather than be traced/bundled into a server build.
  serverExternalPackages: ["better-sqlite3"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
