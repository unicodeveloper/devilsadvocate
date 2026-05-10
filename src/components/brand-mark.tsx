/**
 * Brand mark — "MD+" wordmark.
 *
 * Typographic-only design: the brand is rendered using actual IBM Plex Sans
 * glyphs (not paths), at a bold weight with tight tracking. The "+" suffix
 * follows the modern brand convention (Apple TV+, Disney+, ESPN+) that
 * signals a premium / extended tier — fitting for an AI CIO that adds
 * institutional rigor on top of the analyst's work.
 *
 * Renders correctly both inside `next/og` `ImageResponse` (where Satori
 * rasterizes the JSX to PNG) and as a regular React component (DOM).
 * IBM Plex Sans must be loaded via the `fonts` option when used inside
 * `ImageResponse` — see `loadBrandFonts()` in og-fonts.ts.
 *
 * Used by:
 *   - src/app/icon.tsx
 *   - src/app/apple-icon.tsx
 *   - src/app/opengraph-image.tsx
 *   - src/app/twitter-image.tsx
 */

import { SITE } from "@/lib/site";

type BrandMarkProps = {
  /** Final rendered size in pixels (square). */
  size?: number;
  /** Text color. Defaults to paper-white. */
  color?: string;
  /** Optional background; when set, renders a rounded square frame. */
  background?: string;
  /** Frame corner radius relative to size (0–0.5). Default 0.18. */
  radius?: number;
  /** Add a soft blurred bloom behind the text. */
  bloom?: boolean;
  /** Subtle 1px hairline border around the frame — premium "minted" feel. */
  frameBorder?: boolean;
  className?: string;
};

export function BrandMark({
  size = 32,
  color = SITE.brand.fg,
  background,
  radius = 0.18,
  bloom = false,
  frameBorder = false,
  className,
}: BrandMarkProps) {
  const radiusPx = size * Math.max(0, Math.min(0.5, radius));
  // Tuned so "MD+" fills the frame visually without crowding the edges.
  const fontSize = size * 0.5;
  const letterSpacing = -size * 0.045;

  const textStyle = {
    fontFamily: "IBM Plex Sans, sans-serif",
    fontWeight: 700,
    fontSize,
    color,
    letterSpacing,
    lineHeight: 1,
    display: "flex",
  } as const;

  return (
    <div
      role="img"
      aria-label={SITE.name}
      className={className}
      style={{
        width: size,
        height: size,
        background: background ?? "transparent",
        borderRadius: radiusPx,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Bloom layer — blurred duplicate of the text sitting behind */}
      {bloom ? (
        <div
          aria-hidden="true"
          style={{
            ...textStyle,
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            filter: `blur(${size * 0.05}px)`,
            opacity: 0.45,
            zIndex: 0,
          }}
        >
          MD+
        </div>
      ) : null}

      {/* Crisp MD+ */}
      <div style={{ ...textStyle, position: "relative", zIndex: 1 }}>MD+</div>

      {/* Hairline frame border */}
      {background && frameBorder ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            borderRadius: radiusPx,
            border: `1px solid ${color}`,
            opacity: 0.1,
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}
