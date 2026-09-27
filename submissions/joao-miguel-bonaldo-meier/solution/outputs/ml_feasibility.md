# ML Feasibility Spike — Phase 3 Scoping

Scope: quick honest check only (not production code, not saved to `solution/analysis/`,
not part of `findings.json`). Same data load logic as `02_segmented_analysis.py`
(quartile creator tiers, hour/day-of-week from `post_date`, hashtag count).
Seed fixed at 42. n = 52,214 rows used (no missing values dropped any rows).

## 1. Regression: predict engagement_rate directly

Model: Gradient Boosting Regressor (150 trees, depth 3) on platform, content
category, content type, creator tier, sponsored flag, day-of-week, content
length, follower count, hour, hashtag count.

- Holdout R2: **-0.00066** (essentially zero; negative means it does no better
  than the mean, in fact fractionally worse on this split).
- Holdout RMSE: 0.004823 vs a naive "always predict the training mean" RMSE of
  0.004822 — no improvement.
- Repeated with log1p(engagement_rate) target (heavy-tail-friendly transform):
  R2 = -0.00068. Same result.

**Reading:** the model found nothing. This matches Phase 1 (F17-F19): no
feature or combination of features moves engagement more than ~1.3% from
baseline, and 1.3% of noise is not enough for any model to build a reliable
number-predicting function.

## 2. Classification: top decile vs bottom decile of engagement

Model: Random Forest Classifier (200 trees, depth 6) on the same features,
predicting whether a post lands in the global top 10% or bottom 10% of
engagement rate (n = 10,444 posts, perfectly balanced 50/50 by construction).

- AUC: **0.481** (below 0.5 — worse than a coin flip; not statistically
  distinguishable from random given the noise in a single split).
- Accuracy: **48.7%** vs a naive majority-class baseline of **50.0%** — the
  model is not better than guessing.

**Reading:** even the easiest possible framing (extreme top vs extreme bottom,
not the full spread) gives no lift over chance. This is the strongest possible
disconfirmation of a usable predictive signal in this dataset with these
features.

## 3. Feature importances (caveat: model has no real predictive power)

Because both models have ~zero explanatory power, importances describe what
the trees latched onto while overfitting noise, not genuine drivers. With that
caveat, the ranking is at least directionally consistent between the two
models and matches Phase 1 — follower_count, content_length and hour rank
above platform/category/sponsorship in both models, and is_sponsored and
creator_tier consistently rank lowest. Treat this only as "if there is
anything at all to look at later, look at creator size, length, and posting
hour before sponsorship or category" — not as a validated result.

## Verdict

**Not worth building a predictive engagement model in Phase 3.** Two model
families, two framings (regression on the raw number, classification on
easy top-vs-bottom decile) both come back at essentially chance level (R2 ~ 0,
AUC ~ 0.48). This is consistent with, not contradictory to, the Phase 1
finding that no segment beats baseline by more than ~1.3%.

A dashboard should **not** show a "predicted engagement score" or "expected
engagement rate" for a post — that would imply precision the data cannot
support, and once a client checks it against reality it will visibly fail. If
the leader still wants a Phase 3 tool, options that keep it honest:
- A **descriptive/monitoring dashboard**: baselines by platform, drill-downs
  by segment, sponsorship comparison — presenting what Phase 1 found, not a
  new prediction.
- A soft **"how does this post compare to its platform baseline" indicator**,
  computed as actual-vs-median lift (the same method already used for
  findings), not a model output — directional, transparent, and defensible.
- If a real predictive tool is wanted later, it would need either (a) a true
  cost/revenue outcome column instead of engagement_rate, since engagement
  itself carries almost no variance to explain, or (b) richer creative
  features (actual video/audio content signals, thumbnail, hook timing,
  caption quality) beyond the metadata columns available here — none of
  which exist in the current CSV.

## Method notes / limits of this spike

- No hyperparameter tuning was done; a single reasonable configuration was
  tried per model, as intended for a feasibility read, not a leaderboard.
- Single 80/20 split (seed=42), no cross-validation — sufficient to see "no
  signal" but not precise enough to rank tiny differences between models.
- This file is a standalone scoping artifact only; it does not modify
  `solution/analysis/`, `findings.json`, or any Phase 1/2 deliverable.
