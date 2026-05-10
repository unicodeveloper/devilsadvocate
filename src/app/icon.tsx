import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";
import { SITE } from "@/lib/site";
import { loadBrandFonts } from "@/lib/og-fonts";

// Next 16 auto-detects this file and registers it as <link rel="icon">.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
        <BrandMark size={32} background={SITE.brand.bg} radius={0.18} />
      </div>
    ),
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    },
  );
}
