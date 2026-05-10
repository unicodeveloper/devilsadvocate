/**
 * Static FX rates for the limited set of currencies funds can be denominated
 * in. Keep the table small and refresh periodically — these are display-grade,
 * not trade-grade, so spot rates are fine.
 *
 * Refresh procedure: pull mid-market rates from any standard source (Valyu
 * forex search, ECB, OXR), update the table, bump RATES_AS_OF.
 */

const RATES_AS_OF = "2026-05-10";

/** Multiplier to convert one unit of <currency> into USD. */
const TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  INR: 1 / 83,
  JPY: 1 / 152,
};

export type SupportedCurrency = keyof typeof TO_USD;

export function toUSD(amount: number, currency: string | null | undefined): number {
  if (!Number.isFinite(amount)) return 0;
  const code = (currency ?? "USD").toUpperCase();
  const rate = TO_USD[code];
  // Unknown currency: treat as USD rather than silently dropping the value.
  // Worst case the displayed total is slightly off; better than zeroing real exposure.
  return amount * (rate ?? 1);
}

export function fxAsOf(): string {
  return RATES_AS_OF;
}

/**
 * Format a USD amount with sensible scale switching:
 *   < 1k     → "$N"
 *   < 1m     → "$N.NK"
 *   < 1bn    → "$N.NM"
 *   < 1tn    → "$N.NB"
 *   ≥ 1tn    → "$N.NT"
 */
export function formatUSD(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs < 1_000) return `${sign}$${abs.toFixed(0)}`;
  if (abs < 1_000_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  if (abs < 1_000_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs < 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
}
