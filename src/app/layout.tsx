import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/theme-provider";
import { AuthInitializer } from "@/components/auth-initializer";
import { SITE, siteUrl } from "@/lib/site";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE.name} · ${SITE.titleSuffix}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [...SITE.keywords],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  publisher: SITE.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} · ${SITE.titleSuffix}`,
    description: SITE.description,
    url: siteUrl(),
    locale: SITE.locale,
    // og:image is auto-populated by opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} · ${SITE.titleSuffix}`,
    description: SITE.description,
    site: SITE.twitter,
    creator: SITE.twitter,
    // twitter:image is auto-populated by twitter-image.tsx
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  // Manifest is auto-detected from /manifest.ts; reference still required
  // by some PWA-aware browsers that don't crawl the metadata API.
  manifest: "/manifest.webmanifest",
  // Icons are auto-detected from /icon.tsx and /apple-icon.tsx — Next 16
  // injects the matching <link> tags. No need to declare them here.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: SITE.brand.bg },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  colorScheme: "dark light",
};

/**
 * JSON-LD structured data — surfaces the brand to Google's Knowledge Graph
 * and enables richer SERP appearance (sitelinks, brand panel). Two graph
 * nodes: an Organization (the company) and a SoftwareApplication (the
 * product). Both reference each other via `@id` so crawlers understand the
 * relationship.
 */
function structuredData() {
  const url = siteUrl();
  const graph = [
    {
      "@type": "Organization",
      "@id": `${url}/#organization`,
      name: SITE.name,
      url,
      logo: `${url}/apple-icon`,
      description: SITE.shortDescription,
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${url}/#software`,
      name: `${SITE.name} · ${SITE.titleSuffix}`,
      url,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: SITE.description,
      publisher: { "@id": `${url}/#organization` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${url}/#website`,
      url,
      name: SITE.name,
      publisher: { "@id": `${url}/#organization` },
      inLanguage: SITE.locale.replace("_", "-"),
    },
  ];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Pulled from middleware.ts. Allows our inline scripts to satisfy the
  // nonce-based CSP without resorting to 'unsafe-inline'.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData() }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg font-sans text-text">
        <ThemeProvider>
          <AuthInitializer>{children}</AuthInitializer>
        </ThemeProvider>
      </body>
    </html>
  );
}
