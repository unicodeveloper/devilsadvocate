import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";
import { SITE } from "@/lib/site";
import { loadBrandFonts } from "@/lib/og-fonts";

// Next 16 auto-detects this file and wires it up to `og:image`,
// `og:image:width`, `og:image:height` for every page (overridable per route).
export const alt = `${SITE.name} — ${SITE.titleSuffix}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const fonts = await loadBrandFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: SITE.brand.bg,
          fontFamily: "IBM Plex Sans, sans-serif",
          color: SITE.brand.fg,
          position: "relative",
        }}
      >
        {/* Ambient glow behind the mark — anchored to the upper-left third */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -120,
            width: 520,
            height: 520,
            borderRadius: 520,
            background: SITE.brand.accentGlow,
            filter: "blur(80px)",
            opacity: 0.6,
          }}
        />

        {/* Top row: mark + small label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            position: "relative",
          }}
        >
          <BrandMark
            size={96}
            background={SITE.brand.bg}
            radius={0.18}
            bloom
            frameBorder
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontFamily: "IBM Plex Sans, sans-serif",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: SITE.brand.subtle,
              }}
            >
              {SITE.titleSuffix}
            </span>
            <span
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: SITE.brand.fg,
                letterSpacing: -0.8,
              }}
            >
              {SITE.name}
            </span>
          </div>
        </div>

        {/* Hero copy */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            position: "relative",
            maxWidth: 880,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 600,
              letterSpacing: -2.4,
              lineHeight: 1.05,
              color: SITE.brand.fg,
            }}
          >
            Your AI CIO. Stress-tests every thesis before IC.
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.4,
              color: SITE.brand.muted,
              maxWidth: 760,
            }}
          >
            Multi-agent debate. House View overlay. Binding Mandate review.
          </div>
        </div>

        {/* Footer rail: domain + accent line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            fontFamily: "IBM Plex Sans, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 18,
              fontWeight: 500,
              color: SITE.brand.subtle,
              letterSpacing: 0.5,
            }}
          >
            <span
              style={{
                display: "flex",
                width: 32,
                height: 1,
                background: SITE.brand.fg,
                opacity: 0.4,
              }}
            />
            <span>Mandate · Devil&apos;s Advocate</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    },
  );
}
