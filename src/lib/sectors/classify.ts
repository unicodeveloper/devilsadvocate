import type { SectorKey, StockForSector } from "./types";

/**
 * Heuristic sector classification. Trusts an explicit sector field first
 * (e.g. from Yahoo Finance), then falls back to keyword matching on the
 * stock's name and ticker. Returns "unknown" when nothing matches.
 */
export function classifySector(stock: StockForSector): SectorKey {
  const haystack = [stock.sector ?? "", stock.name ?? "", stock.ticker ?? ""]
    .join(" ")
    .toLowerCase();

  for (const [key, patterns] of SECTOR_PATTERNS) {
    if (patterns.some((p) => haystack.includes(p))) return key;
  }
  return "unknown";
}

const SECTOR_PATTERNS: [SectorKey, string[]][] = [
  [
    "auto",
    [
      "auto",
      "motor",
      "vehicle",
      "automobile",
      "tyre",
      "tire",
      "maruti",
      "tata motors",
      "mahindra",
      "bajaj auto",
      "eicher",
      "ashok leyland",
      "hero motocorp",
      "tvs motor",
      "bosch",
      "motherson",
      "balkrishna",
      "exide",
      "amara raja",
    ],
  ],
  [
    "banking",
    [
      "bank",
      "financial",
      "nbfc",
      "asset management",
      "insurance",
      "hdfc bank",
      "icici bank",
      "kotak mahindra",
      "axis bank",
      "sbi",
      "indusind",
      "bajaj finance",
      "shriram",
      "muthoot",
      "manappuram",
    ],
  ],
  [
    "it_services",
    [
      "infosys",
      "tcs",
      "wipro",
      "hcl",
      "tech mahindra",
      "ltimindtree",
      "mphasis",
      "persistent",
      "coforge",
      "software",
      "information technology",
      "it services",
    ],
  ],
  [
    "oil_gas",
    [
      "oil",
      "gas",
      "petroleum",
      "refinery",
      "energy",
      "reliance industries",
      "ongc",
      "ioc",
      "bpcl",
      "hpcl",
      "gail",
      "petronet",
    ],
  ],
  [
    "fmcg",
    [
      "fmcg",
      "consumer",
      "consumer staples",
      "personal care",
      "household",
      "hindustan unilever",
      "itc",
      "nestle",
      "britannia",
      "dabur",
      "marico",
      "godrej consumer",
      "colgate",
      "tata consumer",
    ],
  ],
  [
    "pharma",
    [
      "pharma",
      "pharmaceutical",
      "drugs",
      "biotech",
      "biocon",
      "sun pharma",
      "dr. reddy",
      "dr reddy",
      "cipla",
      "lupin",
      "aurobindo",
      "glenmark",
      "torrent pharma",
      "cadila",
      "zydus",
      "alkem",
      "ipca",
      "divis lab",
      "natco",
    ],
  ],
  [
    "export_import",
    [
      "export",
      "logistics",
      "shipping",
      "container",
      "port",
      "aviation",
      "air india",
      "interglobe",
      "spicejet",
    ],
  ],
];
