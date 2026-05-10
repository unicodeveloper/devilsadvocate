export type StockSearchResult = {
  ticker: string;
  name: string;
  exchange?: string;
  sector?: string;
  description?: string;
};

const YF_ENDPOINT = "https://query1.finance.yahoo.com/v1/finance/search";

type YfQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  exchDisp?: string;
  typeDisp?: string;
  quoteType?: string;
  sector?: string;
  industry?: string;
};

type YfResponse = {
  quotes?: YfQuote[];
};

/**
 * Lightweight ticker/company lookup via Yahoo Finance. Designed for
 * autocomplete: cheap, fast, global coverage (NSE/BSE, NYSE/NASDAQ, LSE, etc).
 * Reserved Valyu for the actual research agents — this is identity lookup,
 * not research.
 */
export async function searchStocks(
  query: string,
  limit = 6,
): Promise<StockSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const url = new URL(YF_ENDPOINT);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("quotesCount", String(limit));
  url.searchParams.set("newsCount", "0");
  url.searchParams.set("listsCount", "0");

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; DevilsAdvocate/1.0; +https://devilsadvocate.local)",
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Yahoo lookup ${res.status}`);
  }

  const data = (await res.json()) as YfResponse;
  const quotes = (data.quotes ?? []).filter((q) => {
    const t = q.quoteType ?? q.typeDisp;
    return t === "EQUITY" || t === "Equity" || t === "ETF";
  });

  return quotes.slice(0, limit).map((q) => ({
    ticker: q.symbol ?? "",
    name: q.longname ?? q.shortname ?? q.symbol ?? "",
    exchange: q.exchDisp ?? q.exchange,
    sector: q.sector ?? q.industry,
  }));
}
