# Social Media Engagement Dashboard (Phase 3a-3d — data layer, filters, lift indicator, fair sponsorship comparison, rule-based recommendations, LLM executive summary)

Next.js (TypeScript, App Router) dashboard over **pre-aggregated** post data.
Phase 3a built the data layer + filterable skeleton (KPI cards, a per-platform
chart). Phase 3b adds two live, pure-arithmetic indicators computed client-side
from the same aggregate cells -- no new aggregation logic, no model, no LLM:

- **Lift vs. baseline**: the currently filtered selection's weighted
  engagement rate compared to its own platform baseline (or the global
  baseline if no platform is selected) -- same "vs. platform average" framing
  as F02-F09/F19/F20 in `findings.json`.
- **Fair sponsored-vs-organic comparison**: instead of pooling all matching
  posts into one organic rate and one sponsored rate, the comparison is
  computed separately within each platform x category x creator-tier group
  implied by the current filters, then the **median** of those per-group
  ratios is reported -- the same "60 matched groups" logic as F11 in
  `findings.json`, not a raw pooled number.

Phase 3c adds a third tab, **Recommendations**, that reacts live to the
current filter selection with plain-language, rule-based comparisons -- no
model, no LLM, no new data pipeline, just more arithmetic on the same
aggregate cells (`lib/recommendations.ts`):

- **Category / creator-tier focus**: when exactly one category (or tier) is
  selected, compares it against every sibling value on that axis (holding
  the rest of the current filters fixed) and reports whichever alternative
  is meaningfully better or worse (>=5% relative), or says plainly that
  there's no meaningful gap. If more or fewer than one value is selected on
  that axis, it says so and asks the user to narrow the filter instead of
  guessing.
- **Sponsorship verdict**: reuses `aggregateSponsoredCompareControlled`
  (the same fair, matched-group sponsored-vs-organic logic as the
  "Sponsored vs. organic" tab) and turns the median lift into a plain
  "pays off here / doesn't / no difference" verdict for the current
  segment.
- Every recommendation is gated by the same `dataTier` confidence floor
  used elsewhere in the app: below 10 matched posts on either side of a
  comparison, no verdict is shown -- an honest "not enough data" message
  and a suggested next step (widen filters) is shown instead.

Phase 3d adds a **"Generate executive summary"** button (below the KPI
hero row) that turns the current filter selection into a short (~100-150
word), plain-language paragraph:

- The client sends only the small aggregate payload already rendered on
  screen (segment description, posts, weighted engagement rate, lift vs.
  baseline, the fair sponsored-vs-organic number and its confidence tier,
  and the current rule-based recommendations) to a serverless API route,
  `app/api/summary/route.ts` -- never raw rows, never the full
  `aggregates.json`.
- That route calls **Groq's free tier** (`llama-3.1-8b-instant`) if a
  `GROQ_API_KEY` env var is configured, and returns the model's text.
- If no key is configured (e.g. local dev with no `.env.local`) **or** the
  live call fails for any reason (timeout, rate limit, network error), the
  route falls back to a **templated, non-LLM summary** built by plain
  string interpolation over the same numbers (`lib/summary.ts`,
  `buildTemplatedSummary`) -- the button never shows a broken/error state,
  it just says which mode produced the text.
- The API key is read server-side only (`process.env.GROQ_API_KEY` inside
  the route handler) and is never sent to, or bundled into, the browser --
  see "Known gaps" below for how this was verified.

## What it does

- `scripts/build_aggregates.py` reads `data/raw/social_media_dataset.csv`
  (never shipped to the app or the browser) and writes a compact aggregate
  artifact to `public/data/aggregates.json`.
- Each row in that artifact is one **aggregate cell**: platform x category x
  creator tier x sponsored flag x month, with post count and summed
  views/likes/shares/comments/followers. There are 2,969 cells covering all
  52,214 source rows (~136 KB).
- Creator tier = follower-count quartiles (Small/Mid/Large/Mega), the same
  GATE-0-approved proxy used in `solution/analysis/02_segmented_analysis.py`
  and `solution/outputs/findings.json`.
- The dashboard UI (`app/dashboard-client.tsx`) lets you filter by platform,
  category, creator tier, sponsorship, and a month range. On every filter
  change it recombines the matching cells client-side (`lib/aggregate-utils.ts`)
  by summing counts (sums are exact/additive for any filter combination) and
  deriving a weighted engagement rate = sum(likes+shares+comments)/sum(views).
- No LLM calls, no ML model — the Recommendations tab (Phase 3c) is pure
  rule-based arithmetic on the same aggregate cells, zero runtime cost.

## Data privacy / token-budget rule

Raw per-post rows never reach the browser. Only the aggregate cells above are
in `public/data/aggregates.json` (no `content_id`, `creator_id`,
`creator_name`, `content_url`, `comments_text`, `sponsor_name`, etc.).
Verified by inspecting the built page and the served JSON — see QA notes
below.

## Run locally

Requirements: Node 18+ (tested on Node 25), Python 3 with `pandas` (already
a project dependency, see `solution/analysis/requirements.txt` if present).

```bash
cd dashboard

# 1. (Re)generate the aggregate artifact from the raw CSV.
#    Only needs to be re-run if the raw dataset changes.
python3 scripts/build_aggregates.py

# 2. Install JS dependencies.
npm install

# 3. (Optional) enable the LLM-generated executive summary -- see below.
#    Without this step the dashboard works exactly the same, the summary
#    button just returns a templated (non-AI) paragraph instead.
cp .env.example .env.local
# edit .env.local and paste a free Groq API key into GROQ_API_KEY

# 4. Run the dev server.
npm run dev
# open http://localhost:3000

# Or build + run production mode:
npm run build
npm run start
```

### Optional: enabling the AI-generated executive summary

The "Generate executive summary" button works out of the box with **zero
configuration** (it uses a templated fallback). To have it call a real LLM
instead:

1. Create a free account at https://console.groq.com (no credit card
   required) and generate an API key at https://console.groq.com/keys.
2. Copy `.env.example` to `.env.local` and set `GROQ_API_KEY=<your key>`.
3. Restart `npm run dev` / redeploy. `.env.local` is git-ignored -- never
   commit a real key.
4. On Vercel: Project Settings -> Environment Variables -> add
   `GROQ_API_KEY` (Production + Preview) -- do not add it to any client
   (`NEXT_PUBLIC_*`) variable.

**Known limitation:** this MVP intentionally uses a free-tier model
(Groq's `llama-3.1-8b-instant`) so the tool has zero marginal cost and no
paid dependency to run the evaluation. A paid model (e.g. Claude or GPT)
would produce more fluent, nuanced summaries and is the planned upgrade
path once the tool is validated -- see `process-log/DECISIONS.md`
(~19:55 entry) for the leader's explicit call to defer this.

`npm run build` produces a fully static export of the one page (confirmed:
`○ (Static) prerendered as static content`), so there is no server-side
runtime dependency beyond serving static files.

## Deploying to Vercel (not done in this phase)

1. Push this repo to GitHub (or connect the existing repo).
2. In Vercel: "Add New Project" → import the repo → set **Root Directory**
   to `dashboard/` (this is what makes the app self-contained under a
   subdirectory).
3. Framework preset: Next.js (auto-detected). Build command
   `npm run build`, output handled automatically by the Next.js Vercel
   integration. No environment variables are required to run the app --
   the only optional one is `GROQ_API_KEY` (Phase 3d, see above), and the
   app works fully without it.
4. `public/data/aggregates.json` is checked into git, so Vercel builds
   deterministically without needing access to `data/raw/` at all.
5. If the raw dataset changes later, re-run
   `python3 scripts/build_aggregates.py` locally, commit the updated
   `public/data/aggregates.json`, and redeploy (or wire this into a CI step —
   out of scope for 3a).

## Known gaps / deviations (for the leader)

- UI layer migrated to Material UI (MUI v7: `@mui/material`, `@emotion/*`,
  `@mui/material-nextjs`'s `v15-appRouter` cache provider, `@mui/icons-material`
  for the theme-toggle icons only). No data logic, aggregation, recommendation
  rules or the `/api/summary` route changed. Visual identity (gold accent,
  Fraunces/Inter pairing, light-default/dark-toggle) is preserved through a
  custom MUI theme (`app/theme.ts`) using MUI's CSS-variables theming mode
  (`cssVariables` + `colorSchemes`), so there's no re-render flash on toggle
  and no flash-of-wrong-theme on load (`InitColorSchemeScript` in
  `layout.tsx` replaces the old hand-written blocking script).
  `app/globals.css` now only holds the two font custom properties; everything
  else is MUI components + `sx`. Charts (recharts) keep their own light/dark
  color constants since SVG attributes can't consume MUI's CSS-var tokens
  directly. Known minor difference: the platform/sponsored chart tooltips now
  follow the active theme (previously always dark-styled, even in light mode).
- `npm audit`: fixed, 0 vulnerabilities. The original 2 findings (1 high, 1
  critical) turned out to be two separate issues, not one: the critical one
  was in Next.js itself (a bundle of RSC/Server Actions/Image-Optimizer DoS
  and SSRF advisories affecting all `>=13.0.0 <15.5.24` builds -- there was no
  patched Next.js 14.2.x release, 14.2.35 was already the last one on that
  line), and the high one was the transitive `postcss` path-traversal/XSS
  advisories. Fix: upgraded Next.js from 14.2.35 to **14.2.35 -> 15.5.24**
  (the first Next 15.x patch release with all advisories closed; still React
  18, still App Router static export, no Next 16 jump) and pinned
  `postcss` to `8.5.28` via an `overrides` entry in `package.json` (same
  major version, build-time-only dependency, no app code touches it
  directly). Verified with `npm audit` (0 vulnerabilities) and `npm run
  build` (still `○ (Static)` output, same route).
- Month is the "date" granularity used for aggregation (25 months in range),
  not daily — chosen to keep the artifact small and cells reasonably
  populated; can be changed if the leader wants finer date filtering.
- The weighted engagement rate shown here (sum of sums) is mathematically
  exact for any filter combination but is a different statistic from the
  per-segment **medians** reported in `findings.json`/`STRATEGY.md` (medians
  of medians don't combine additively). On this dataset the two are within
  ~0.01pp of each other for every platform (verified against
  `findings.json` baselines), consistent with the documented WEAK-SIGNAL,
  near-uniform engagement pattern — but the dashboard should not be read as
  reproducing the exact median figures cited in the strategy doc.
- Phase 3b's "Lift vs. baseline" and "Sponsored vs. organic (fair)" numbers
  are directional for the same reason (weighted average, not median) and say
  so in their captions. Sanity check: the dashboard's controlled sponsored
  comparison across all data (no filters) gives a median lift of **1.0005x**
  (+0.05%) across 60 matched platform x category x tier groups, vs.
  `findings.json` F11's median-based **1.0x, range 0.993x-1.006x** across the
  same 60 groups — same order of magnitude and same "no real effect"
  conclusion, not a different universe.
- The fair sponsored comparison requires >=10 posts on both sides of a group
  to count it (a lower floor than `findings.json`'s n>=30, since the
  dashboard slices further by user-chosen filters); if a filter combination
  leaves too few matched groups, the UI says so instead of showing a number.
- Phase 3d's LLM call could only be tested in this environment in
  **templated fallback mode** (no real `GROQ_API_KEY` was configured here)
  -- verified: `POST /api/summary` with no env var set returns
  `{"text": ..., "source": "template"}` with a 200, and the home page
  still builds/serves normally. Testing the live Groq path end-to-end
  requires a real free API key, which whoever deploys this should supply
  (see "Optional: enabling the AI-generated executive summary" above).
- Verified the API key never reaches the browser: `grep -r "GROQ_API_KEY"
  .next/static` after `npm run build` returns no matches, and the route
  handler (`app/api/summary/route.ts`) is compiled as a server-only
  function (`ƒ /api/summary`, not `○ (Static)`) while `/` remains static.

## Smoke test (for qa-tester)

```bash
cd dashboard
python3 scripts/build_aggregates.py   # regenerate; should print "Wrote ... 2969 cells from 52,214 rows"
npm install
npm run build                          # must succeed with 0 errors, page shown as Static
npm run start -- -p 3411 &
sleep 3
curl -s http://localhost:3411/ | grep -c "Social Media Engagement Dashboard"   # expect 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3411/data/aggregates.json  # expect 200
curl -s http://localhost:3411/data/aggregates.json | grep -Eo "creator_id|content_url|comments_text|sponsor_name" # expect NO output (no raw fields)
kill %1
```

Manual check: open the app in a browser, toggle platform/category/tier chips
and the sponsorship dropdown — the "Result" and "Breakdown by platform"
numbers must change immediately and match the sum-of-matching-cells you'd
get by re-running `build_aggregates.py`'s groupby logic on the filtered
subset.

Phase 3b checks:
- The hero row must show a "Lift vs. baseline" cell and a "Sponsored vs.
  organic (fair)" cell alongside Posts/Views/Weighted ER — both update on
  every filter change.
- Selecting a single platform (e.g. Bilibili) with no other filters should
  make "Lift vs. baseline" caption read "Bilibili average" and the lift value
  should be close to 0% (this dataset is flat-signal by design, see
  `findings.json`).
- Switch to the "Sponsored vs. organic" tab: the headline lift number must
  differ from a naive `(sponsoredRate - organicRate) / organicRate` on the
  pooled cards above it whenever the platform/category/tier composition of
  sponsored vs. organic posts differs (i.e. it is not simply recomputing the
  pooled cards) — it is the median across matched groups instead.
- Narrow the filters until fewer than 10 matched groups remain (e.g. pick one
  platform + one category + one tier) — the sponsored tab should show the
  "not enough matched groups" message instead of a fabricated number.

Phase 3c checks:
- Open the "Recommendations" tab with no filters active: the category and
  tier cards should ask you to select exactly one value (there's no single
  segment to compare against siblings yet); the sponsorship card should show
  a verdict (global data clears the confidence floor).
- Select exactly one category (e.g. Tech): the category card should now
  compare Tech against the other categories and either name a better/worse
  alternative with a percentage, or say there's no meaningful gap — never a
  generic tip.
- Narrow filters to a single platform + category + tier (a small slice):
  cards should show the "not enough data" message rather than a number once
  the underlying `n` drops below the confidence floor.
- `grep -RniE "findings\.json|process-log|F[0-9]{2}\b" lib/recommendations.ts app/components/RecommendationsPanel.tsx`
  should return nothing (no internal artifact names in UI-facing code).

Phase 3d checks (no `GROQ_API_KEY` needed for these):
- Click "Generate executive summary" with no filters active: within a
  second or two it should show a short paragraph and, underneath it, either
  "Generated by a free-tier AI model." or "Generated from the numbers above
  (no AI model configured for this run)." -- never a blank state or a
  visible error.
- `curl -s -X POST http://localhost:3411/api/summary -H "Content-Type:
  application/json" -d '{"segment":"all platforms","posts":100,
  "weightedEngagementRatePct":4.2,"liftPct":0.1,
  "liftBaselineLabel":"global average","sponsoredVsOrganicPct":0.5,
  "sponsoredDataTier":"full","recommendations":[]}'` should return
  `{"text": "...", "source": "template"}` with HTTP 200 when no
  `GROQ_API_KEY` is set.
- `grep -RniE "findings\.json|process-log|F[0-9]{2}\b" lib/summary.ts
  app/api/summary/route.ts app/components/ExecutiveSummary.tsx` should
  return nothing (same no-internal-artifact-names rule as Phase 3c).
- `npm run build && grep -r "GROQ_API_KEY" .next/static` should return
  nothing (key never bundled into client JS).
