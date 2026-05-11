import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Edge proxy (Next 16's renamed `middleware`): per-request CSP nonce in
 * production + rate limiting on sensitive endpoints.
 *
 * CSP strategy:
 *   - Production: generate a fresh 128-bit nonce per request, expose via
 *     the `x-nonce` request header so layout.tsx attaches it to inline
 *     scripts. CSP uses `'nonce-...' 'strict-dynamic'` — no wildcards,
 *     no eval, no anonymous inline scripts.
 *   - Development: nonce is omitted entirely and CSP falls back to
 *     `'unsafe-inline' 'unsafe-eval'`. Reason: Turbopack/HMR injects
 *     inline scripts that we can't tag, and a per-request nonce causes
 *     React hydration mismatches across HMR reloads.
 *
 * Rate-limit strategy:
 *   - 5 auth attempts per IP per minute on /api/oauth/token and
 *     /api/oauth/refresh — protects the PKCE token exchange + refresh
 *     endpoints from credential-stuffing replays.
 *   - In-memory store; sufficient for single-instance Railway.
 */

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}

function buildCsp(nonce: string | null): string {
  const scriptSrc = nonce
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-inline' 'unsafe-eval'`;
  const styleSrc = `'self' 'unsafe-inline' https://fonts.googleapis.com`;
  const connectSrc =
    `'self' https://fonts.gstatic.com https://fonts.googleapis.com ` +
    `https://api.openai.com https://api.valyu.network https://query1.finance.yahoo.com`;
  const fontSrc = `'self' https://fonts.gstatic.com data:`;
  // `https:` allows OAuth provider avatars (Valyu, Google, etc.) without
  // requiring a hardcoded allow-list per provider. Avatars are non-interactive
  // image loads — broad image trust is the standard CSP posture for them.
  const imgSrc = `'self' data: blob: https: https://fonts.gstatic.com`;
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

const RATE_LIMITED = [
  "/api/oauth/token",
  "/api/oauth/refresh",
];

export function proxy(req: NextRequest) {
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

  // ---- CSP ----
  // Dev: skip nonce entirely (HMR-friendly + no hydration mismatches).
  // Prod: mint a per-request nonce and require it on inline scripts.
  const isProd = process.env.NODE_ENV === "production";
  const nonce = isProd ? generateNonce() : null;
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  if (nonce) res.headers.set("x-nonce", nonce);
  return res;
}

/**
 * Skip on static + generated asset routes. They don't need CSP or rate
 * limiting and processing them adds noise.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
