"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "da.theme";

type ThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

/**
 * Reads the persisted theme synchronously on the client. The matching inline
 * script in <head> sets the class before paint to avoid a flash, so this
 * component is just keeping React state in sync with what's already on the DOM.
 */
function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize from the DOM (set by the pre-paint script) on the client.
  // During SSR, document is undefined and we default to dark — the matching
  // hydration step picks up the real value before the user sees anything.
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  const apply = useCallback((t: Theme) => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // private mode etc. — non-fatal
    }
  }, []);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      apply(t);
    },
    [apply],
  );

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return <Ctx.Provider value={{ theme, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/**
 * Inline script that runs before paint to apply the persisted theme. Embedded
 * in <head> via dangerouslySetInnerHTML — the fastest path to flash-free dark
 * default with light opt-in. Default = dark; only `light` in storage opts out.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    if (stored !== 'light') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;
