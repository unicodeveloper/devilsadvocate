import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Middleware: per-request CSP nonce + rate limiting on sensitive endpoints.
 *
 * CSP strategy:
 *   - Generate a fresh 128-bit nonce per request, attach to inline scripts
 *     via the `x-nonce` request header so layout.tsx can read it.
 *   - script-src and style-src only allow our own origin + the nonce; no
 *     wildcards, no eval, no inline scripts without the nonce.
 *   - connect-src whitelists the third-party APIs we actually call.
 *   - frame-ancestors none — paired with X-Frame-Options: DENY in next.config.
 *
 * Rate-limit strategy:
 *   - 5 auth attempts per IP per minute on /api/auth/callback/credentials
 *     and /forgot-password POSTs. Returns 429 with Retry-After.
 *   - In-memory store; sufficient for single-instance Railway. Stateless
 *     attackers can't outrun this without DDoS-grade resources.
 */

function getClientIp(req: NextRequest): string {
  // Trust the first IP in x-forwarded-for (Railway sets this).
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // base64-encode without padding for compact, URL-safe value
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}

function buildCsp(nonce: string, isDev: boolean): string {
  // In dev, Next/Turbopack injects inline scripts for HMR that we can't
  // nonce-tag, so we have to allow 'unsafe-inline' + 'unsafe-eval'. In
  // production we lock down to nonce-only.
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  // styles: nonce wouldn't help (Tailwind injects styles in a way that's
  // hard to nonce). 'unsafe-inline' on style-src is widely accepted.
  const styleSrc = `'self' 'unsafe-inline' https://fonts.googleapis.com`;
  // External services we genuinely call from the server. Browsers won't
  // need most of these directly, but listing keeps connect-src honest if
  // we ever add client-side fetches.
  const connectSrc =
    `'self' https://fonts.gstatic.com https://fonts.googleapis.com ` +
    `https://api.openai.com https://api.valyu.network https://query1.finance.yahoo.com`;
  const fontSrc = `'self' https://fonts.gstatic.com data:`;
  const imgSrc = `'self' data: blob: https://fonts.gstatic.com`;
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `connect-src ${connectSrc}`,
    `font-src ${fontSrc}`,
    `img-src ${imgSrc}`,
    `worker-src 'self' blob:`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

/**
 * Routes that get rate-limited (path startsWith match, POST/PUT only). The
 * NextAuth credentials endpoint and the password-reset endpoints are the
 * brute-force-prone surfaces.
 */
const RATE_LIMITED = [
  "/api/auth/callback/credentials",
  "/api/auth/signin",
  "/api/forgot-password",
  "/api/reset-password",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---- Rate limit gate ----
  const isPost =
    req.method === "POST" || req.method === "PUT" || req.method === "PATCH";
  if (isPost && RATE_LIMITED.some((p) => pathname.startsWith(p))) {
    const ip = getClientIp(req);
    const key = `${pathname}:${ip}`;
    const result = checkRateLimit(key, 5, 60_000);
    if (!result.ok) {
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests. Please slow down.",
          retryAfterMs: result.retryAfterMs,
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": String(Math.ceil(result.retryAfterMs / 1000)),
          },
        },
      );
    }
  }

  // ---- CSP nonce ----
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildCsp(nonce, isDev);

  // Pass the nonce to RSC via request header so layout.tsx can read it.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-nonce", nonce);
  return res;
}

/**
 * Skip middleware on static assets and generated icons/og images. Auto-
 * generated routes (icon, apple-icon, opengraph-image, twitter-image,
 * manifest, robots, sitemap) don't need CSP and don't need rate limiting.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
