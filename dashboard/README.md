# Social Media Engagement Dashboard (Phase 3a+3b — data layer, filters, lift indicator, fair sponsorship comparison)

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

Rule-based recommendations and the LLM executive summary are still pending —
those are sub-phases 3c-3e (see `process-log/DECISIONS.md`, ~19:55 entry).

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
- No LLM calls, no ML model, no recommendations in this phase — verified
  zero-cost runtime.

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

# 3. Run the dev server.
npm run dev
# open http://localhost:3000

# Or build + run production mode:
npm run build
npm run start
```

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
   integration. No environment variables are required for this phase.
4. `public/data/aggregates.json` is checked into git, so Vercel builds
   deterministically without needing access to `data/raw/` at all.
5. If the raw dataset changes later, re-run
   `python3 scripts/build_aggregates.py` locally, commit the updated
   `public/data/aggregates.json`, and redeploy (or wire this into a CI step —
   out of scope for 3a).

## Known gaps / deviations (for the leader)

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
