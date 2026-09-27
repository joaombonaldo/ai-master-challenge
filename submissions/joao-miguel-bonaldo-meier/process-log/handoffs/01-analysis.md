# Handoff 01 — Phase 1: Analysis (GATE 1 approved)

**Delivered:** solution/outputs/findings.json (F01-F20), solution/outputs/charts/*.png (5), solution/analysis/{01_profile,02_segmented_analysis,03_audit_rebuild}.py (run_all.py regenerates all).

**Agents used:** data-scientist (sonnet) — profiling, segmented analysis, audit, chart fixes; head-of-marketing (sonnet) — 5 review rounds.

**AI got wrong / corrected:** (1) Labeled dataset "LIKELY-SYNTHETIC" and proposed a "methodology demo" framing — leader corrected: treat as real business data in all client-facing text. (2) Used stats jargon (p-value, decile, strata) in quotable findings — leader required plain marketing language. (3) Built chart 02 with a zoomed y-axis that visually exaggerated a <0.2% difference — caught by head-of-marketing review, rebuilt.

**Leader decisions:** dataset framed as real data, not synthetic; sponsorship payoff = engagement lift only, no invented $ ROI; creator-size proxy = follower_count quartiles; segment-first + underperformer analysis required; independent audit + narrow-combination hunt requested and completed (6,760 combos tested, no combo >1.3%); all logged in process-log/DECISIONS.md.

**Open questions for Phase 2:** none blocking — strategist proceeds from findings.json (F01-F20) to write solution/STRATEGY.md (PT-BR).
