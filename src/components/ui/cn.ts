/**
 * Minimal class concatenator. Filters out falsy values so component APIs can
 * pass conditionals like `cn("base", active && "active-class")`. Intentionally
 * not a full clsx replacement — just enough for our primitives.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
