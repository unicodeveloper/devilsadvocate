import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";
import { SITE } from "@/lib/site";
import { loadBrandFonts } from "@/lib/og-fonts";

// Next 16 auto-detects this file and registers it as <link rel="apple-touch-icon">.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const fonts = await loadBrandFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: SITE.brand.bg,
        }}
      >
        <BrandMark
          size={180}
          background={SITE.brand.bg}
          radius={0.18}
          bloom
          frameBorder
        />
      </div>
    ),
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    },
  );
}
