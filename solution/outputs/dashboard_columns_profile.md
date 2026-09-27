# Dashboard columns profile (scoping note, not a finding)

Quick pandas profile of `data/raw/social_media_dataset.csv` (52,214 rows) for columns the
leader is considering exposing in the dashboard. Not part of `findings.json` / strategy;
purely to inform UI scope.

## 1. Exact column names
- `content_type` (exists as named)
- `language` (exists as named)
- `audience_location` (this is the geography column; there is also `disclosure_location`,
  which is unrelated -- it describes where the sponsorship disclosure appears, e.g.
  caption/video/hashtags/none, not audience geography)

## 2. Cardinality, top values, missingness
No nulls in any of these columns (0.00% missing across all).

**content_type** -- 4 distinct values
video 31,500 | image 10,303 | mixed 5,213 | text 5,198

**language** -- 5 distinct values
English 26,110 | Chinese 10,428 | Hindi 5,272 | Spanish 5,227 | Japanese 5,177

**audience_location** -- 8 distinct values (all shown, top ~8 = all)
China 6,648 | UK 6,570 | Japan 6,553 | Brazil 6,505 | USA 6,498 | Germany 6,497 |
India 6,484 | Russia 6,459 (near-uniform counts, ~6.5K each)

(For reference, `disclosure_location` -- not requested but easily confused with
audience_location -- has 4 values: none 29,900 | caption 8,944 | video 7,246 | hashtags 6,124.)

## 3. language vs audience_location redundancy check
Crosstabbed language x audience_location. Every location has essentially the same
language mix (dominant-language share per location is ~0.49-0.51 everywhere, i.e. no
location is skewed toward one language). The two columns are **independent, not
redundant** -- each location has a near-identical proportional split across all 5
languages. Same near-uniform independence check done for language x disclosure_location.
Both are safe to expose as separate, non-collinear filters.

## 4. views/likes/shares/comments_count confirmation
Confirmed via `solution/analysis/01_profile.py` (engagement-rate recompute) and
`dashboard/scripts/build_aggregates.py` (aggregate builder): `views`, `likes`, `shares`,
`comments_count` are the raw per-post count columns already summed to build engagement
rate everywhere in the pipeline -- ER = (likes+shares+comments)/views, computed as a
weighted sum-of-sums ratio in the dashboard cube (`sum_likes+sum_shares+sum_comments)/
sum_views`), matching the per-row recompute used in Phase 0. No new columns needed; these
are already the base of every ER metric shown today.

## 5. Quick directional ER check (language / audience_location)
Same method as existing findings: group median ER vs overall median (0.19899), n>=30 floor.

**By language:** biggest positive = Spanish, lift 1.0008x (n=5,227). Biggest negative =
English, lift 0.9997x (n=26,110). Full spread across all 5 languages: 0.9997x-1.0008x.

**By audience_location:** biggest positive = UK, lift 1.0003x (n=6,570). Biggest negative =
India, lift 0.9994x (n=6,484). Full spread across all 8 locations: 0.9994x-1.0003x.

**By content_type** (bonus, same method, already partially covered elsewhere): text
highest at 1.0007x (n=5,198), video lowest at 0.9998x (n=31,500).

All deviations are under 0.1% relative to baseline -- an order of magnitude smaller even
than the weak +1.3% best segment already reported in the main analysis. This is
consistent with every other axis tested: another flat/no-signal dimension, not a new
lever.

## Bottom line for the UI decision
- `content_type` is already used server-side (recommendations cube); safe and cheap to
  also expose as a client-side filter -- only 4 categories, no missingness.
- `language` and `audience_location` are both clean, fully-populated, low-cardinality
  (5 and 8 values) and genuinely independent of each other, so either could be added as a
  standalone filter without redundancy concerns -- but neither shows any engagement
  differentiation worth surfacing as an "insight"; they would only be useful as slice/filter
  controls, not as a recommended lever.
- `views`/`likes`/`shares`/`comments_count` need no new work: already the base inputs to
  the ER calculation used throughout the dashboard.
