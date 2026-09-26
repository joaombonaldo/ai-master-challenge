# Social Media Engagement Dashboard (Phase 3a — data layer + filter skeleton)

Next.js (TypeScript, App Router) dashboard over **pre-aggregated** post data.
This is Phase 3a only: data layer + filterable skeleton, redesigned for
readability (KPI cards, a sponsored-vs-organic chart, and a per-platform
chart, all computed live client-side from the same aggregate cells -- no new
aggregation logic). No lift indicator against segment baselines, rule-based
recommendations, or LLM summary yet — those are sub-phases 3b–3e (see
`process-log/DECISIONS.md`, ~19:55 entry).

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
