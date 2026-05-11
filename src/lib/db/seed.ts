import { db } from "./index";
import { criticRules, fundHoldings, funds, users } from "./schema";
import { and, eq } from "drizzle-orm";
import { seedDemoHouseViewIfEmpty } from "../house-view";
import { seedDemoMemosIfEmpty, DEMO_MEMO_COUNT } from "./seed-demo-memos";
import { BUILTIN_RULES } from "../critic/rules/builtin";

type SeedHolding = {
  ticker: string;
  name: string;
  weightPct: number;
  sector: string;
};

type SeedFund = {
  type: "mf" | "pms" | "aif";
  name: string;
  schemeCode: string;
  fundManager: string;
  aum: number;
  currency: "INR" | "USD" | "GBP" | "EUR";
  notes: string;
  holdings: SeedHolding[];
};

const SEED_FUNDS_AS_OF = new Date("2026-04-30T00:00:00Z");

const SEED_FUNDS: SeedFund[] = [
  {
    type: "mf",
    name: "Parag Parikh Flexi Cap Fund",
    schemeCode: "122639",
    fundManager: "Rajeev Thakkar / Raunak Onkar / Raj Mehta",
    aum: 740_000_000_000, // ~₹74,000 cr
    currency: "INR",
    notes:
      "Flexi cap with a meaningful global equity allocation (~15-20% in foreign-listed names) and a sizeable cash buffer.",
    holdings: [
      { ticker: "HDFCBANK.NS", name: "HDFC Bank Ltd", weightPct: 9.1, sector: "Banks" },
      { ticker: "BAJAJHLDNG.NS", name: "Bajaj Holdings & Investment Ltd", weightPct: 7.2, sector: "Diversified Financials" },
      { ticker: "POWERGRID.NS", name: "Power Grid Corporation of India Ltd", weightPct: 6.8, sector: "Power" },
      { ticker: "COALINDIA.NS", name: "Coal India Ltd", weightPct: 5.9, sector: "Mining & Minerals" },
      { ticker: "ITC.NS", name: "ITC Ltd", weightPct: 5.4, sector: "FMCG" },
      { ticker: "MSFT", name: "Microsoft Corporation", weightPct: 4.8, sector: "Technology" },
      { ticker: "INFY.NS", name: "Infosys Ltd", weightPct: 4.3, sector: "IT Services" },
      { ticker: "GOOGL", name: "Alphabet Inc Class A", weightPct: 4.1, sector: "Internet" },
      { ticker: "META", name: "Meta Platforms Inc", weightPct: 3.5, sector: "Internet" },
      { ticker: "AMZN", name: "Amazon.com Inc", weightPct: 3.2, sector: "E-commerce" },
    ],
  },
  {
    type: "mf",
    name: "Vanguard 500 Index Fund Admiral Shares",
    schemeCode: "VFIAX",
    fundManager: "Vanguard Quantitative Equity Group (Gerard O'Reilly)",
    aum: 500_000_000_000, // ~$500B (Investor + Admiral combined)
    currency: "USD",
    notes:
      "Pure passive S&P 500 index tracker. Holdings mirror index weights and rebalance on float-adjusted market cap.",
    holdings: [
      { ticker: "AAPL", name: "Apple Inc", weightPct: 6.9, sector: "Technology" },
      { ticker: "MSFT", name: "Microsoft Corporation", weightPct: 6.7, sector: "Technology" },
      { ticker: "NVDA", name: "NVIDIA Corporation", weightPct: 6.4, sector: "Semiconductors" },
      { ticker: "AMZN", name: "Amazon.com Inc", weightPct: 3.8, sector: "E-commerce" },
      { ticker: "META", name: "Meta Platforms Inc", weightPct: 2.6, sector: "Internet" },
      { ticker: "GOOGL", name: "Alphabet Inc Class A", weightPct: 2.2, sector: "Internet" },
      { ticker: "GOOG", name: "Alphabet Inc Class C", weightPct: 1.9, sector: "Internet" },
      { ticker: "TSLA", name: "Tesla Inc", weightPct: 1.9, sector: "Auto - EV" },
      { ticker: "BRK.B", name: "Berkshire Hathaway Inc Class B", weightPct: 1.7, sector: "Diversified Financials" },
      { ticker: "AVGO", name: "Broadcom Inc", weightPct: 1.7, sector: "Semiconductors" },
    ],
  },
  {
    type: "mf",
    name: "Fidelity Contrafund",
    schemeCode: "FCNTX",
    fundManager: "Will Danoff",
    aum: 160_000_000_000, // ~$160B
    currency: "USD",
    notes:
      "Active US large-cap growth. Concentrated, with a long-running outsized position in Meta Platforms (originally Facebook).",
    holdings: [
      { ticker: "META", name: "Meta Platforms Inc", weightPct: 14.0, sector: "Internet" },
      { ticker: "BRK.B", name: "Berkshire Hathaway Inc Class B", weightPct: 9.0, sector: "Diversified Financials" },
      { ticker: "MSFT", name: "Microsoft Corporation", weightPct: 6.2, sector: "Technology" },
      { ticker: "AMZN", name: "Amazon.com Inc", weightPct: 5.8, sector: "E-commerce" },
      { ticker: "GOOGL", name: "Alphabet Inc Class A", weightPct: 5.0, sector: "Internet" },
      { ticker: "NVDA", name: "NVIDIA Corporation", weightPct: 4.8, sector: "Semiconductors" },
      { ticker: "AAPL", name: "Apple Inc", weightPct: 4.0, sector: "Technology" },
      { ticker: "LLY", name: "Eli Lilly and Company", weightPct: 3.0, sector: "Pharmaceuticals" },
      { ticker: "UNH", name: "UnitedHealth Group Inc", weightPct: 2.2, sector: "Managed Care" },
      { ticker: "V", name: "Visa Inc", weightPct: 2.0, sector: "Payments" },
    ],
  },
  {
    type: "mf",
    name: "T. Rowe Price Blue Chip Growth Fund",
    schemeCode: "TRBCX",
    fundManager: "Paul Greene",
    aum: 70_000_000_000, // ~$70B
    currency: "USD",
    notes:
      "Active US large-cap growth. Higher concentration in mega-cap tech leaders relative to S&P 500.",
    holdings: [
      { ticker: "MSFT", name: "Microsoft Corporation", weightPct: 11.5, sector: "Technology" },
      { ticker: "NVDA", name: "NVIDIA Corporation", weightPct: 10.0, sector: "Semiconductors" },
      { ticker: "AAPL", name: "Apple Inc", weightPct: 7.0, sector: "Technology" },
      { ticker: "AMZN", name: "Amazon.com Inc", weightPct: 6.8, sector: "E-commerce" },
      { ticker: "GOOGL", name: "Alphabet Inc Class A", weightPct: 5.2, sector: "Internet" },
      { ticker: "META", name: "Meta Platforms Inc", weightPct: 4.9, sector: "Internet" },
      { ticker: "LLY", name: "Eli Lilly and Company", weightPct: 4.0, sector: "Pharmaceuticals" },
      { ticker: "MA", name: "Mastercard Incorporated", weightPct: 3.2, sector: "Payments" },
      { ticker: "V", name: "Visa Inc", weightPct: 3.0, sector: "Payments" },
      { ticker: "TSLA", name: "Tesla Inc", weightPct: 2.8, sector: "Auto - EV" },
    ],
  },
  {
    type: "mf",
    name: "Fundsmith Equity Fund",
    schemeCode: "B41YBW7",
    fundManager: "Terry Smith",
    aum: 23_000_000_000, // ~£23B
    currency: "GBP",
    notes:
      "Concentrated global quality-growth fund. Owner-led for 14+ years, emphasises high return-on-capital businesses with low capital intensity.",
    holdings: [
      { ticker: "MSFT", name: "Microsoft Corporation", weightPct: 9.2, sector: "Technology" },
      { ticker: "META", name: "Meta Platforms Inc", weightPct: 7.9, sector: "Internet" },
      { ticker: "NVO", name: "Novo Nordisk A/S (ADR)", weightPct: 6.4, sector: "Pharmaceuticals" },
      { ticker: "SYK", name: "Stryker Corporation", weightPct: 5.5, sector: "Medical Devices" },
      { ticker: "OR.PA", name: "L'Oréal S.A.", weightPct: 5.2, sector: "Personal Care" },
      { ticker: "V", name: "Visa Inc", weightPct: 5.0, sector: "Payments" },
      { ticker: "IDXX", name: "IDEXX Laboratories Inc", weightPct: 4.8, sector: "Veterinary Diagnostics" },
      { ticker: "PM", name: "Philip Morris International Inc", weightPct: 4.4, sector: "Tobacco" },
      { ticker: "MAR", name: "Marriott International Inc", weightPct: 4.1, sector: "Hotels" },
      { ticker: "ADP", name: "Automatic Data Processing Inc", weightPct: 3.9, sector: "HR Services" },
    ],
  },
];

async function seedFunds(createdByUserId: string) {
  for (const f of SEED_FUNDS) {
    const existing = await db
      .select()
      .from(funds)
      .where(and(eq(funds.name, f.name), eq(funds.createdByUserId, createdByUserId)))
      .limit(1);
    if (existing.length > 0) {
      console.log(`skip fund "${f.name}" (exists)`);
      continue;
    }

    const [fundRow] = await db
      .insert(funds)
      .values({
        type: f.type,
        name: f.name,
        schemeCode: f.schemeCode,
        fundManager: f.fundManager,
        aumNative: f.aum,
        currency: f.currency,
        asOfDate: SEED_FUNDS_AS_OF,
        notes: f.notes,
        createdByUserId,
      })
      .returning();

    await db.insert(fundHoldings).values(
      f.holdings.map((h) => ({
        fundId: fundRow.id,
        ticker: h.ticker,
        name: h.name,
        weightPct: Math.round(h.weightPct * 100),
        sector: h.sector,
        asOfDate: SEED_FUNDS_AS_OF,
      })),
    );

    console.log(
      `seeded fund "${f.name}" [${f.type.toUpperCase()} · ${f.currency}] with ${f.holdings.length} holdings`,
    );
  }
}

async function seed() {
  // Demo fixture user. Authentication is OAuth-only — this user can't sign
  // in directly; it exists solely so the seeded House View, funds, and
  // demo memos have an owner. Real users land here via the Valyu OAuth
  // flow which upserts a fresh row keyed on their Valyu account email.
  const seedUsers = [
    {
      email: process.env.SEED_FM_EMAIL ?? "demo@devilsadvocate.local",
      name: "Demo Fund Manager",
      role: "fund_manager" as const,
    },
  ];

  let seedUserId: string | null = null;
  for (const u of seedUsers) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, u.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`skip ${u.email} (exists)`);
      seedUserId = existing[0].id;
      continue;
    }

    const [inserted] = await db
      .insert(users)
      .values({
        email: u.email,
        // Legacy NOT NULL column; OAuth users never have a password.
        passwordHash: "",
        name: u.name,
        role: u.role,
      })
      .returning();
    seedUserId = inserted.id;
    console.log(`seeded ${u.role}: ${u.email}`);
  }

  if (seedUserId) {
    const result = await seedDemoHouseViewIfEmpty(seedUserId);
    console.log(
      result === "seeded"
        ? "seeded demo FM's house view (v1)"
        : "skip house view seed (demo FM already has one)",
    );
  }

  // Seed built-in Critic rules. Slugs are unique; existing rows are left
  // alone so user toggles (enabled/disabled) survive re-seeding.
  for (const r of BUILTIN_RULES) {
    const existing = await db
      .select()
      .from(criticRules)
      .where(eq(criticRules.slug, r.slug))
      .limit(1);
    if (existing.length > 0) {
      console.log(`skip rule ${r.slug} (exists)`);
      continue;
    }
    await db.insert(criticRules).values({
      slug: r.slug,
      displayName: r.displayName,
      description: r.description,
      severity: r.severity,
      source: r.source,
      evaluatorKind: "code",
      evaluatorConfig: "{}",
      rationaleTemplate: r.rationaleTemplate,
      scope: r.scope,
      enabled: true,
    });
    console.log(`seeded rule ${r.slug} [${r.severity}]`);
  }

  if (seedUserId) {
    await seedFunds(seedUserId);
    const demoResult = await seedDemoMemosIfEmpty(seedUserId);
    console.log(
      demoResult === "seeded"
        ? `seeded ${DEMO_MEMO_COUNT} demo memos with stress-test data`
        : "skip demo memos seed (already exist)",
    );
  } else {
    console.log("skip funds + demo memos seed (no seed user resolved)");
  }
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
