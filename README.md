# Mandate

**Your AI CIO. Stress-tests every thesis against your mandate before IC.**

Mandate is an open-source research engine for fund managers. You sign in, write a thesis (stock or fund), and Mandate plays the role of a relentless Chief Investment Officer — challenging your assumptions with broker reports, peer signals, House View rules, and macro data, then issuing a binding verdict before the memo can ship to the Investment Committee.

The product premise is **automated skepticism**. The system doesn't just fetch data; it uses that data to question your conclusions. When the bear case is stronger than your bull case, you'll know — and so will the IC.

---

## Why this exists

Fund managers spend hours stitching together broker reports, private peer data, regulatory filings, and macro indicators just to vet a single thesis. Then they walk into IC and discover a blind spot anyway.

Mandate compresses that loop:

1. You write a thesis.
2. The engine pulls research, runs an adversarial review (bull, bear, House View checker, synthesizer), and lists every contradiction with citations.
3. You address each objection inline (resolve, dispute, or won't-fix), or revise the memo.
4. Mandate re-reviews. Loop until the verdict is **Approved** — then the IC PDF is one click away.

Built for solo fund managers and small investment teams. Useful even with one user — the AI plays the CIO seat without one needing to exist.

---

## What it does

### Memo lifecycle

```
Draft → Stress-tested → In Review → Changes Requested → Approved
                                  └→ Rejected (House View violation)
```

- **Draft** — You're authoring the thesis (stock memo or fund memo).
- **Stress-tested** — You've run an advisory devil's-advocate pass; results are inline notes, not gating.
- **In Review** — Mandate is running the binding two-stage gate.
- **Changes Requested** — Verdict came back with objections you must address.
- **Approved / Rejected** — Final verdict. Approved memos generate an IC PDF; rejected memos require revising the underlying premise.

### The Critic engine

Two stages:

- **Stage 1 (HARD)** — House View hard rules, fund-level weighted-violation thresholds, memo completeness. A single BLOCKING objection here = REJECTED.
- **Stage 2 (SOFT)** — Bear Advocate findings (each becomes an objection with severity derived from confidence), consensus divergence checks, blind-spot surfacing, custom AI rules. MAJOR objections → CHANGES_REQUESTED. Only MINOR/INFO → APPROVED.

The engine is a **post-processor over the existing stress-test** — it re-uses the bull / bear / House-View-checker / synthesizer outputs rather than running new LLM calls. That makes the binding review fast and cheap.

### Custom rules

Built-in code rules ship with the app (House View violations, citation completeness, consensus divergence, blind spots). On top of that, you write your own AI rules in plain English:

> "Flag the memo if it claims a price target without a quoted multiple basis (P/E, EV/EBITDA, etc.)."

Each AI rule is sent to a fast LLM with the memo context and a strict structured-output schema. Rules can be HARD (reject on violation) or SOFT (flag only). Toggle any rule on/off without code.

### Objection lifecycle

Every objection from the engine attaches to a memo section (thesis, areas of concern, private competitors). You can:

- **Resolve** — you fixed it in the memo, optionally with a note
- **Dispute** — your argument for why the objection doesn't hold; goes on the thread
- **Won't fix** — minor objections you accept as-is

To resubmit, every BLOCKING and MAJOR objection must be addressed. MINOR/INFO can stay open.

---

## Architecture

```
Next.js 16 (App Router, RSC)         ← UI + server actions
React 19
Tailwind CSS 4
NextAuth (credentials)               ← single-role auth
Drizzle ORM + SQLite (better-sqlite3)
OpenAI SDK + ai-sdk                  ← agent + AI rule evaluators
Valyu                                ← deep research, stock search, peer dossiers
Playwright (headless Chromium)       ← IC PDF generation
TipTap                               ← rich-text editor
```

### Data model (high level)

| Table | Purpose |
|---|---|
| `memos` | The thesis: stock or fund, with status, owner, body fields |
| `memo_runs` | One row per stress-test run; references its synthesized output |
| `audit_entries` | Full agent-by-agent audit trail per run |
| `reviews` | One row per binding Critic pass; carries verdict, confidence, engine version |
| `objections` | Per-objection findings tied to a review and a memo section |
| `objection_threads` | The dispute / resolution conversation on each objection |
| `critic_rules` | Built-in + user-defined rules; HARD or SOFT, code or AI |
| `house_view_versions` | Immutable snapshots of the firm's House View markdown |
| `funds` / `fund_holdings` | Fund definitions and their look-through holdings |
| `issuer_groups` / `issuer_group_members` | Group-level exposure aggregation |

---

## Local setup

### Prerequisites

- **Node.js 20+** (Node 24 recommended; matches the Docker image)
- **npm** (or pnpm — the lockfile is npm)
- An **OpenAI API key**
- A **Valyu API key** ([valyu.network](https://valyu.network))

### Steps

```bash
git clone <your-fork-url> mandate
cd mandate
npm install
cp .env.example .env.local
# Edit .env.local — paste in OPENAI_API_KEY, VALYU_API_KEY, AUTH_SECRET
```

Generate an `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Initialize the database (creates `./data/sqlite.db`, runs migrations, seeds the FM account and the built-in Critic rules):

```bash
npm run db:migrate
npm run db:seed
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with `fm@mandate.local` / `changeme` (or whatever you set in `.env.local`), and you're in.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | yes | — | All agents and AI rule evaluators |
| `VALYU_API_KEY` | yes | — | Deep research, stock search, peer dossiers |
| `AUTH_SECRET` | yes | — | NextAuth session encryption |
| `DATABASE_URL` | no | `./data/sqlite.db` (local) / `/data/sqlite.db` (Docker) | SQLite file path |
| `SEED_FM_EMAIL` | no | `fm@mandate.local` | Initial fund-manager account |
| `SEED_FM_PASSWORD` | no | `changeme` | Initial password — **change before deploying** |
| `HOUSE_VIEW_PATH` | no | `./data/house-view.md` | Path to the firm's House View markdown |

---

## Useful npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Production server (after build) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a new Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed the FM user, House View placeholder, and built-in Critic rules |
| `npm run db:studio` | Drizzle Studio (visual DB browser) |

---

## Deploying to Railway

Mandate ships with a `Dockerfile` and `railway.json` ready to go. The image bundles Playwright + Chromium for PDF rendering and uses a `/data` volume for SQLite persistence.

### One-time setup

1. **Fork or clone the repo** to your own GitHub account.
2. Sign in to [Railway](https://railway.app) and create a new project from your repo.
3. Railway will detect `railway.json` and use the Dockerfile build.

### Set environment variables

In the Railway project → **Variables**, add:

```
OPENAI_API_KEY=sk-...
VALYU_API_KEY=...
AUTH_SECRET=<openssl rand -base64 32>
SEED_FM_EMAIL=you@yourcompany.com
SEED_FM_PASSWORD=<a-strong-password>
```

`DATABASE_URL` and `HOUSE_VIEW_PATH` default to `/data/...` in the Docker image — leave them unset unless you want to override.

### Add a persistent volume

SQLite needs disk that survives redeploys.

1. In your Railway service → **Settings → Volumes**.
2. Add a volume mounted at **`/data`** (any size you like; 1GB is plenty to start).

That's it. The container's `VOLUME ["/data"]` directive means the SQLite file, the House View markdown, and any uploaded artifacts all live on this volume.

### Deploy

Push to your default branch. Railway builds the Dockerfile and runs:

```
npm run db:migrate && npm run db:seed && node server.js
```

`db:seed` is idempotent — it skips users and rules that already exist, so it's safe to run on every deploy.

The healthcheck at `/api/health` confirms the server came up.

### Custom domain

Railway → **Settings → Networking → Custom Domain**. Add your domain, point a CNAME at the provided host, done.

### Post-deploy checklist

- [ ] Sign in with the seeded FM credentials and immediately change the password (or rotate the seed env vars and redeploy).
- [ ] Edit the House View at `/house-view` to reflect your firm's actual investment framework. The placeholder text is generic.
- [ ] Visit `/rules` and review which built-in rules you want enabled. Add custom AI rules for your firm-specific concerns.

---

## Project structure

```
src/
  app/
    (app)/                     # Authenticated app surface
      memos/                   # Memo list + detail + new
      review/                  # Lifecycle dashboard (Kanban + activity stream)
      rules/                   # Critic rules management
      house-view/              # House View editor
      funds/, exposure/, ...   # Adjacent surfaces
    api/                       # Route handlers (PDF, run streaming, auth, health)
    login/
  components/                  # Cross-page UI (app shell, editor, sign-in modal, ...)
  lib/
    agents/                    # bull, bear, house-view-checker, synthesizer + fund variants
    critic/                    # The Critic engine
      rules/
        builtin.ts             # Code-evaluator rules
        ai-evaluator.ts        # LLM-backed rule evaluator factory
        index.ts               # Loads enabled rules from DB, builds runnable RuleDefinitions
      engine.ts                # runReview() — two-stage gate, persists Verdict + Objections
      types.ts                 # Verdict, Objection, RuleDefinition, ...
    db/
      schema.ts                # Drizzle schema
      migrations/
      seed.ts
    pdf/                       # Playwright IC memo rendering
    sectors/                   # Sector-specific dossier fetchers
    reviews.ts, memos.ts, funds.ts, ...   # Query helpers
    reviews-shared.ts          # Pure types/helpers safe for client components
docs/
  spec.md                      # The original product spec
  samples/                     # Example fund-holdings CSVs for demo
data/                          # SQLite + House View (gitignored content)
```

---

## How it actually works (a tour)

1. **Author a memo** at `/memos/new`. Pick stock or fund, fill in the thesis, optional areas of concern, optional private competitors.
2. **Stress-test** from the memo detail page. The orchestrator (`src/lib/agents/orchestrator.ts`) runs Bull, Bear, and House-View-Checker agents in parallel, then a Synthesizer combines them into a structured memo. Each agent's prompt + raw output is persisted to `audit_entries` for full reproducibility.
3. **Submit for review.** The Critic engine (`src/lib/critic/engine.ts`) loads the synthesized output, runs Stage 1 HARD rules (House View violations → BLOCKING objections), then Stage 2 SOFT rules (bear findings, consensus, blind spots, custom AI rules). It persists a `reviews` row with a verdict and a list of `objections` rows.
4. **Address objections.** The rail on the memo page lists every objection with severity, citations, and inline actions: Resolve / Dispute / Won't fix. Disputes go on a thread. Section badges next to your thesis / areas of concern flag which sections have outstanding issues.
5. **Resubmit.** Once every BLOCKING and MAJOR objection is addressed, the Resubmit button enables. The engine runs again over the updated memo and emits a fresh review.
6. **Approved → IC PDF.** Click Download IC PDF. Playwright renders a paginated A4 memo with the House View overlay, stress-test findings, and final verdict.

---

## Tech stack rationale

- **SQLite + Drizzle** — Single-file, zero-ops database that's right for a self-hosted tool. Drizzle gives type-safe schema + migrations.
- **NextAuth credentials** — No third-party identity provider needed. Single-role world (fund manager); the AI is the CIO.
- **OpenAI ai-sdk** — Structured outputs via Zod schemas, model-agnostic if you want to swap.
- **Valyu** — Deep research + financial-source-friendly search. Used by the Bear Advocate to surface contradicting data.
- **Playwright** — Reliable PDF rendering. Heavier than alternatives, but the IC PDF is the deliverable; we want it crisp.
- **Two-stage gate over a synthesizer pass** — Reuses one LLM-heavy pass (the stress-test) for both advisory and binding review. Keeps the binding review snappy.

---

## Contributing

PRs welcome. The most valuable contributions right now:

- More built-in rules (especially for sector-specific concerns)
- Additional data sources beyond Valyu
- Verdict replay tooling (`da review replay {reviewId} --rules custom-v3`)
- Inline gutter markers in the memo editor (claim-level anchoring beyond section-level)
- Multi-tenant workspaces (currently single-team)

Run `npm run lint` and `npx tsc --noEmit` before opening a PR.

---

## License

MIT.
