/**
 * Loads IBM Plex Sans weights from Google Fonts for use inside `next/og`
 * `ImageResponse`. Cached at the module level so a single OG image fetch
 * doesn't redownload on every request.
 *
 * Falls back to an empty fonts array if the network is unavailable —
 * Satori will use its built-in default, which is plain but renders.
 */

type FontWeight = 500 | 600 | 700;

type LoadedFont = {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: "normal";
};

let cache: LoadedFont[] | null = null;

async function fetchFontData(weight: FontWeight): Promise<ArrayBuffer | null> {
  // Google Fonts CSS API returns CSS pointing at the actual woff2/ttf file.
  // The User-Agent below tricks the API into returning ttf URLs (which
  // Satori parses; woff2 is not supported).
  const cssUrl = `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@${weight}&display=swap`;
  try {
    const cssRes = await fetch(cssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src:\s*url\((https?:\/\/[^)]+)\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

export async function loadBrandFonts(): Promise<LoadedFont[]> {
  if (cache) return cache;
  const weights: FontWeight[] = [500, 600, 700];
  const results = await Promise.all(
    weights.map(async (w) => {
      const data = await fetchFontData(w);
      return data
        ? ({
            name: "IBM Plex Sans",
            data,
            weight: w,
            style: "normal" as const,
          } satisfies LoadedFont)
        : null;
    }),
  );
  cache = results.filter((r): r is LoadedFont => r !== null);
  return cache;
}
