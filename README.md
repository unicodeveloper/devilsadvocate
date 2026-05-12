# Devil's Advocate

**Your AI CIO. Stress-tests every thesis against your mandate before IC.**

## Demo

https://github.com/user-attachments/assets/7ab5aaa4-f7cb-4630-9a5b-16ae912690de

---

Devil's Advocate is an open-source research engine for fund managers. You sign in, write a thesis (stock or fund), and Devil's Advocate plays the role of a relentless Chief Investment Officer — challenging your assumptions with broker reports, peer signals, House View rules, and macro data, then issuing a binding verdict before the memo can ship to the Investment Committee.

The product premise is **automated skepticism**. The system doesn't just fetch data; it uses that data to question your conclusions. When the bear case is stronger than your bull case, you'll know — and so will the IC.

Every fund manager works against their **own** mandate. House View, custom Critic rules, and toggle overrides on built-in rules are all per-FM — your evaluation framework is yours, and another FM's edits don't change what runs on your memos.

---

## Why this exists

Fund managers spend hours stitching together broker reports, private peer data, regulatory filings, and macro indicators just to vet a single thesis. Then they walk into IC and discover a blind spot anyway.

Devil's Advocate compresses that loop:

1. You write a thesis.
2. The engine pulls research, runs an adversarial review (bull, bear, House View checker, synthesizer), and lists every contradiction with citations.
3. You address each objection inline (resolve, dispute, or won't-fix), or revise the memo.
4. Devil's Advocate re-reviews. Loop until the verdict is **Approved** — then the IC PDF is one click away.

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
- **In Review** — Devil's Advocate is running the binding two-stage gate.
- **Changes Requested** — Verdict came back with objections you must address.
- **Approved / Rejected** — Final verdict. Approved memos generate an IC PDF; rejected memos require revising the underlying premise.

### The Critic engine

Two stages, both evaluated against the **memo author's** ruleset and House View:

- **Stage 1 (HARD)** — author's House View hard rules, fund-level weighted-violation thresholds, memo completeness. A single BLOCKING objection here = REJECTED.
- **Stage 2 (SOFT)** — Bear Advocate findings (each becomes an objection with severity derived from confidence), consensus divergence checks, blind-spot surfacing, the author's custom AI rules. MAJOR objections → CHANGES_REQUESTED. Only MINOR/INFO → APPROVED.

The engine is a **post-processor over the existing stress-test** — it re-uses the bull / bear / House-View-checker / synthesizer outputs rather than running new LLM calls. That makes the binding review fast and cheap.

### House View (per-FM mandate)

Each fund manager has their own House View — a markdown one-pager describing investment framework, current house calls, and hard rules. On first sign-in, your House View is **seeded from the demo FM's copy** so you start with something opinionated to react to, not a blank page. Edits are private to you; memo runs always evaluate against the author's most recent saved version, so another FM publishing a new version tomorrow doesn't change what your in-flight memos run against.

Unauthed visitors see the demo FM's House View as a read-only example.

### Critic rules (built-in catalogue + per-FM customs)

The engine has a catalogue of built-in rules that ship with the app (House View violations, memo completeness, consensus divergence, bear blind spots, etc.). On top of that, **you** can author plain-English AI rules that only run on your memos:

> "Flag the memo if it claims a price target without a quoted multiple basis (P/E, EV/EBITDA, etc.)."

Each AI rule is sent to a fast LLM with the memo context and a strict structured-output schema. Two layers of ownership:

- **Built-in rule definitions** are global. Everyone sees the same catalogue, and shipped improvements propagate to all FMs automatically.
- **Custom rule definitions** are per-FM — visible only to you, only judging your memos.
- **Enabled/disabled state** is per-FM for both kinds. If you disable a built-in you find too noisy, it stays enabled for every other FM. Your custom rules are toggled directly; built-in toggles are stored as per-user overrides over the rule's default.

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
Valyu OAuth 2.0 (PKCE)               ← sign-in, bridged into NextAuth JWT sessions
Zustand                              ← client-side OAuth token store
Drizzle ORM + SQLite (better-sqlite3)
OpenAI SDK + ai-sdk                  ← agent + AI rule evaluators
Valyu                                ← deep research, stock search, peer dossiers
Playwright (headless Chromium)       ← IC PDF generation
TipTap                               ← rich-text editor
```

### Data model (high level)

| Table | Purpose |
|---|---|
| `users` | Account row per FM; created on first OAuth sign-in |
| `memos` | The thesis: stock or fund, with status, owner, body fields |
| `memo_runs` | One row per stress-test run; references its synthesized output |
| `audit_entries` | Full agent-by-agent audit trail per run |
| `reviews` | One row per binding Critic pass; carries verdict, confidence, engine version, the House View snapshot it ran against |
| `objections` | Per-objection findings tied to a review and a memo section |
| `objection_threads` | The dispute / resolution conversation on each objection |
| `critic_rules` | Built-in (owner_user_id IS NULL, global) and custom (owner_user_id = FM, private) rules; HARD or SOFT, code or AI |
| `critic_rule_user_settings` | Per-FM enabled override on any rule — absence means "use the rule's default state" |
| `house_view_versions` | Per-FM immutable snapshots of House View markdown. Latest per-owner is the "current" version |
| `funds` / `fund_holdings` | Fund definitions and their look-through holdings |
| `issuer_groups` / `issuer_group_members` | Group-level exposure aggregation |

---

## Local setup

### Prerequisites

- **Node.js 20+** (Node 24 recommended; matches the Docker image)
- **npm** (or pnpm — the lockfile is npm)
- An **OpenAI API key**
- A **Valyu API key** ([valyu.ai](https://valyu.ai))

### Steps

```bash
git clone <your-fork-url> devils-advocate
cd devils-advocate
npm install
cp .env.example .env.local
# Edit .env.local — paste in OPENAI_API_KEY, VALYU_API_KEY, AUTH_SECRET
```

Generate an `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Initialize the database (creates `./data/sqlite.db`, runs migrations, seeds the demo FM, demo memos, demo House View, demo funds, and the built-in Critic rules catalogue):

```bash
npm run db:migrate
npm run db:seed
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your Valyu account — the app uses Valyu OAuth (PKCE) for authentication. On first sign-in your House View is **seeded from the demo FM's copy** (something to react to instead of a blank page) and your account row is created automatically.

In `valyu` mode, your Valyu credits cover research calls; in `self-hosted` mode, the server's `VALYU_API_KEY` is used regardless of who is signed in.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | yes | — | All agents and AI rule evaluators |
| `VALYU_API_KEY` | self-hosted only | — | Deep research, stock search, peer dossiers (used when `NEXT_PUBLIC_APP_MODE` != `valyu`) |
| `AUTH_SECRET` | yes | — | NextAuth session encryption |
| `NEXT_PUBLIC_APP_MODE` | no | `self-hosted` | Set to `valyu` to charge research against the signed-in user's Valyu credits via the OAuth proxy. |
| `NEXT_PUBLIC_VALYU_CLIENT_ID` | valyu mode | — | OAuth client ID issued by Valyu for this deployment |
| `VALYU_CLIENT_SECRET` | valyu mode | — | OAuth client secret for the PKCE token exchange |
| `NEXT_PUBLIC_VALYU_AUTH_URL` | valyu mode | — | Valyu authorization server origin |
| `NEXT_PUBLIC_REDIRECT_URI` | valyu mode | — | OAuth callback URL — must point at `/auth/valyu/callback` on this app |
| `VALYU_APP_URL` | valyu mode | `https://platform.valyu.ai` | Valyu platform origin used for userinfo + OAuth proxy |
| `DATABASE_URL` | no | `./data/sqlite.db` (local) / `/data/sqlite.db` (Docker) | SQLite file path |
| `SEED_FM_EMAIL` | no | `demo@devilsadvocate.local` | Email of the demo FM. Owns the seeded House View, funds, and demo memos. Each new sign-in copies this user's House View into the new FM's. |
| `NEXT_PUBLIC_APP_URL` | no | falls back to `RAILWAY_PUBLIC_DOMAIN` or `http://localhost:3000` | Canonical app origin, used for `metadataBase` + absolute OG image URLs |

---

## Deploying to Railway

### One-time setup

1. **Fork or clone the repo** to your own GitHub account.
2. Sign in to [Railway](https://railway.app) and create a new project from your repo.
3. Mount a volume for storage for the sqlite db file.

### Set environment variables

In the Railway project → **Variables**, add:

```
OPENAI_API_KEY=sk-...
AUTH_SECRET=<openssl rand -base64 32>

# Self-hosted mode (set NEXT_PUBLIC_APP_MODE to anything other than "valyu"):
VALYU_API_KEY=...

# Valyu mode (charges research against the signed-in user's credits):
NEXT_PUBLIC_APP_MODE=valyu
NEXT_PUBLIC_VALYU_CLIENT_ID=...
VALYU_CLIENT_SECRET=...
NEXT_PUBLIC_VALYU_AUTH_URL=https://auth.valyu.ai
NEXT_PUBLIC_REDIRECT_URI=https://your-domain.com/auth/valyu/callback
VALYU_APP_URL=https://platform.valyu.ai
```

`DATABASE_URL` defaults to `/app/data/sqlite.db`.

### Add a persistent volume

SQLite needs disk that survives redeploys.

1. In your Railway service → **Settings → Volumes**.
2. Add a volume mounted at **`/app/data`** (any size you like; 1GB is plenty to start).

That's it. The container's `VOLUME ["/app/data"]` directive means the SQLite file and any uploaded artifacts all live on this volume.

### Deploy

Push to your default branch. Railway builds and runs:

```
npm run db:migrate && npm run db:seed && node server.js
```

`db:seed` is idempotent — it skips users and rules that already exist, so it's safe to run on every deploy.

The healthcheck at `/api/health` confirms the server came up.

### Custom domain

Railway → **Settings → Networking → Custom Domain**. Add your domain, point a CNAME at the provided host, done.

### Post-deploy checklist

- [ ] Sign in with your Valyu account — the first sign-in creates your user row and seeds your House View from the demo FM's copy.
- [ ] Edit your House View at `/house-view` to reflect your actual investment framework. Edits are private to you.
- [ ] Visit `/rules` and toggle off any built-ins you don't want running on your memos (overrides stay scoped to you). Add custom AI rules for concerns specific to your strategy.

---

## Project structure

```
src/
  app/
    (app)/                       # App surface — pages browse-able read-only without sign-in
      memos/                     # Memo list + detail + new (empty state shows demo examples)
      review/                    # Lifecycle dashboard (Kanban + activity stream)
      rules/                     # Critic rules management (per-FM customs + built-in toggles)
      house-view/                # House View editor (per-FM)
      funds/, exposure/, ...     # Adjacent surfaces
    auth/valyu/callback/         # OAuth PKCE callback — exchanges code, bridges to NextAuth
    api/                         # Route handlers (PDF, run streaming, NextAuth, OAuth token/refresh, valyu-proxy, health)
    lib/                         # Client-side OAuth helpers (oauth.ts, app-mode.ts)
    stores/                      # Zustand auth store
    login/                       # Sign-in entry page
  components/                    # Cross-page UI (app shell, sign-in modal, avatar, ...)
  lib/
    agents/                      # bull, bear, house-view-checker, synthesizer + fund variants
    critic/                      # The Critic engine
      rules/
        builtin.ts               # Code-evaluator rules (global definitions)
        ai-evaluator.ts          # LLM-backed rule evaluator factory
        index.ts                 # loadEnabledRules(scope, ownerUserId) — built-ins + per-FM customs + per-user toggle overrides
      engine.ts                  # runReview() — two-stage gate, persists Verdict + Objections
      types.ts                   # Verdict, Objection, RuleDefinition, ...
    db/
      schema.ts                  # Drizzle schema
      migrations/
      seed.ts
    house-view.ts                # Per-FM House View read/write + seed-from-demo on first sign-in
    pdf/                         # Playwright IC memo rendering
    sectors/                     # Sector-specific dossier fetchers
    valyu.ts                     # Mode-aware Valyu client (SDK in self-hosted, OAuth proxy in valyu mode)
    reviews.ts, memos.ts, funds.ts, ...   # Query helpers
    reviews-shared.ts            # Pure types/helpers safe for client components
docs/
  spec.md                        # The original product spec
  samples/                       # Example fund-holdings CSVs for demo
data/                            # SQLite file (gitignored)
```

---

## How it actually works (a tour)

1. **Author a memo** at `/memos/new`. Pick stock or fund, fill in the thesis, optional areas of concern, optional private competitors.
2. **Stress-test** from the memo detail page. The orchestrator (`src/lib/agents/orchestrator.ts`) runs Bull, Bear, and House-View-Checker agents in parallel, then a Synthesizer combines them into a structured memo. Each agent's prompt + raw output is persisted to `audit_entries` for full reproducibility.
3. **Submit for review.** The Critic engine (`src/lib/critic/engine.ts`) loads the synthesized output, looks up the author's House View, builds the author's effective ruleset (global built-ins minus their disabled overrides, plus their custom rules), and runs Stage 1 HARD rules (House View violations → BLOCKING objections) then Stage 2 SOFT rules (bear findings, consensus, blind spots, custom AI rules). It persists a `reviews` row with a verdict and a list of `objections` rows.
4. **Address objections.** The rail on the memo page lists every objection with severity, citations, and inline actions: Resolve / Dispute / Won't fix. Disputes go on a thread. Section badges next to your thesis / areas of concern flag which sections have outstanding issues.
5. **Resubmit.** Once every BLOCKING and MAJOR objection is addressed, the Resubmit button enables. The engine runs again over the updated memo and emits a fresh review.
6. **Approved → IC PDF.** Click Download IC PDF. Playwright renders a paginated A4 memo with the author's House View overlay, stress-test findings, and final verdict.

---

## Tech stack rationale

- **SQLite + Drizzle** — Single-file, zero-ops database that's right for a self-hosted tool. Drizzle gives type-safe schema + migrations.
- **Valyu OAuth (PKCE) + NextAuth bridge** — Sign-in is handled entirely by Valyu (no passwords stored here). The callback page exchanges the code, persists tokens client-side via Zustand, and bridges into a NextAuth JWT session so server-side `auth()` consumers keep working unchanged. The JWT carries the user's Valyu access token so server-side agents can call Valyu under the user's credits when in `valyu` mode.
- **OpenAI ai-sdk** — Structured outputs via Zod schemas, model-agnostic if you want to swap.
- **Valyu** — Deep research + financial-source-friendly search. Used by the Bear Advocate to surface contradicting data. In `valyu` mode, calls route through the OAuth proxy so the signed-in user's credits are charged; in `self-hosted` mode, the server's API key is used directly.
- **Playwright** — Reliable PDF rendering. Heavier than alternatives, but the IC PDF is the deliverable; we want it crisp.
- **Two-stage gate over a synthesizer pass** — Reuses one LLM-heavy pass (the stress-test) for both advisory and binding review. Keeps the binding review snappy.
- **Per-FM ownership** — House View, custom Critic rules, and built-in rule toggles are all scoped to the FM. Memos are evaluated against the author's framework, not a shared one. Built-in rule *definitions* stay global so engine improvements ship to everyone automatically.

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
