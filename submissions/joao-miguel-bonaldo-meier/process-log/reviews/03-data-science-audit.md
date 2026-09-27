# Second-Opinion Data Science Audit — Phase 1 Findings

Auditor: independent data-scientist review (2026-09-26). Scope: verify F01/F11/F17,
hunt for narrow-combo signal, fix unreadable charts, update findings.json.
Code: `solution/analysis/03_audit_rebuild.py` (adds to `run_all.py`).

## Part 1 — Verification: original work is accurate

Re-derived everything from `data/raw/social_media_dataset.csv` independently (own
pandas code, not by trusting printed script output). All three numbers check out exactly:

- **F01 (creator size doesn't move engagement):** max within-platform tier spread =
  1.002x. Confirmed to 3 decimals.
- **F17 (reach doesn't scale with followers):** correlation between `follower_count`
  and `views` = 0.005 (essentially zero); median views ~10,100 in every tier from
  Small (125K median followers) to Mega (874K). Confirmed.
- **F11 (sponsorship shows no lift):** 60 matched strata (platform x creator tier x
  category, n>=30 each side), lift range 0.993x-1.006x, only 3.3% of strata hit
  p<0.05. Confirmed.

**No methodology errors found.** Denominators, matching logic, and the n>=30 filter
are all applied correctly and consistently. Verdict: the original analysis is accurate.

## Part 2 — Narrow-signal hunt: still nothing, even when hunted for directly

Searched every 3-way and 4-way combination across 8 dimensions (platform, content
type, category, time of day, creator size as quartile tier, creator size as a
100K+ cut, sponsorship, content length bucket) — 6,760 combinations with n>=30 each
(30 is the same floor used throughout the project; below it, medians on ~10K-row
platforms get noisy).

**Result: nothing clears a practical-significance bar.** Across all 6,760 cells, the
biggest deviation from a platform's typical engagement rate is +1.3% (best) and
-1.4% (worst) — both far under the 5% bar this project uses for "a real difference."
99.99%+ of cells fall inside +/-2%.

**Most interesting standout (best, n=55):** RedNote, text posts, Small creators,
longest-length bucket -> +1.3% vs. platform median. Still not meaningful.

**Most interesting standout (worst, n=53):** YouTube, mixed-format tech posts,
afternoon -> -1.4% vs. platform median. Still not meaningful.

**Leader's specific example, tested directly:** long videos (>60 seconds), posted in
the evening, in the tech category, from creators with 100K+ followers (n=1,019
across all 5 platforms). Best-performing platform for this exact combination is
Bilibili, which reaches only +0.5% above its own usual rate. This "obvious winner"
combination does not stand out in this data either.

**What I tried:** exhaustive combo search (not cherry-picked), the leader's named
example, and a distribution check of all 6,760 lifts (see new chart
`05_narrow_combo_search.png`) — the whole distribution is a tight bell curve within
+/-1.5%, with nothing near the +/-5% dashed reference lines. This is a genuine null
result, not a case of not looking hard enough.

New findings F18 (verification), F19 (narrow-hunt summary), F20 (leader's specific
example) added to `findings.json`.

## Part 3 — Charts fixed

Diagnosis of why 01, 03, 04 were unreadable (chart 02 was fine and left untouched):
1. **Zero-based y-axis on near-constant values.** Engagement rate sits at ~0.199-0.200
   everywhere, and lift ratios sit at ~0.99-1.01 everywhere. Plotted from 0, every bar
   looked the same height — the actual story (tiny, real differences) was invisible.
2. **Abbreviated, undecodable labels.** Segment labels like "Re/tex/beau/Small" require
   a legend the exec doesn't have.
3. Chart 01 also had severe x-axis label overlap (28 platform/tier labels crammed
   together, illegible).

Fix applied to all three: switched to horizontal bar charts of **% difference vs. the
platform's typical (median) engagement rate**, sorted, with a zero reference line,
full plain-language labels (platform, format, category, creator size, n), and
direct value labels on each bar. Added a new supporting chart,
`05_narrow_combo_search.png`, showing the full distribution of the 6,760-combo search
for Part 2. All charts regenerate via `solution/analysis/03_audit_rebuild.py`.

## Reproducibility issue found (not part of the original brief, but material)

`solution/analysis/02_segmented_analysis.py` regenerates `findings.json` in its
**raw, pre-review form**: `signal_verdict: "LIKELY-SYNTHETIC"`, "Kaggle" wording in
the docstring/caveats, and some untranslated jargon in claim text. The leader
explicitly rejected that framing at GATE 1 (`process-log/DECISIONS.md`, "CORREÇÃO
pós-GATE 1" entry) and head-of-marketing round 2 approved a plain-language,
"WEAK-SIGNAL" version instead (`process-log/reviews/02-findings-review.md`). That
approved wording only existed as manual edits layered on top of the script's output
— running `run_all.py` from scratch would have silently reverted to the rejected
language. I fixed the 5 concrete banned-language spots directly in
`02_segmented_analysis.py` (signal_verdict, evidence bullets, caveats, two code
comments) so re-running the pipeline no longer regresses. I did **not** rewrite every
claim string in `02_segmented_analysis.py` to match the full plain-language pass from
review round 2 (e.g., isolating "Mann-Whitney U"/"p-value"/"decile"/"pp" into
`technical_detail` was done by hand during review, not by the script) — that gap
still exists and should be closed before the next full pipeline re-run, or QA should
diff against the currently committed `findings.json` rather than blindly re-running
`run_all.py`.

## What changed in findings.json / charts
- `findings.json`: restored the approved (plain-language, WEAK-SIGNAL) version as the
  base, appended F18/F19/F20, added one caveat line pointing to this report. File is
  15.0 KB (within the 15 KB cap), 20 findings total (within the 25 cap). No existing
  finding text or numbers were altered.
- Charts: `01_er_platform_tier.png`, `03_top_bottom_segments.png`,
  `04_sponsorship_lift.png` rebuilt; `05_narrow_combo_search.png` added.
- `solution/analysis/03_audit_rebuild.py` added to `run_all.py`.
