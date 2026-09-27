// Types for the pre-aggregated data artifact (public/data/aggregates.json).
// See dashboard/scripts/build_aggregates.py for how this file is generated.
// Every row is an AGGREGATE CELL (platform x category x creator_tier x
// sponsored x month x content_type x language x audience_location) -- never
// a single post/row from the raw dataset.
//
// content_type/language/audience_location were added as 3 more filter
// dimensions (see solution/outputs/dashboard_columns_profile.md -- all 3
// are 0% missing, low cardinality: 4/5/8 values, and independent of each
// other). Measured on the real dataset: adding all 3 grows the cube from
// 2,969 cells (~140 KB) to 44,884 cells (~2.0 MB raw / ~622 KB gzip) --
// bigger than the original ~140 KB ballpark, but Next.js/Vercel serve
// public/ JSON with gzip/brotli compression, so real wire size stays well
// under 1 MB. Note the resulting density is low (44,884 cells for 52,214
// source rows, ~1.16 rows/cell average) -- still strictly aggregated sums
// (no post ids, no raw per-post fields), never individual rows.
export type AggregateRow = [
  platformIdx: number,
  categoryIdx: number,
  tierIdx: number,
  sponsored: 0 | 1,
  monthIdx: number,
  contentTypeIdx: number,
  languageIdx: number,
  audienceLocationIdx: number,
  n: number,
  sumViews: number,
  sumLikes: number,
  sumShares: number,
  sumComments: number,
  sumFollowers: number,
];

export interface AggregatesFile {
  generated_at: string;
  source: string;
  row_count_source: number;
  cell_count: number;
  legend: {
    platform: string[];
    category: string[];
    creator_tier: string[];
    sponsored: string[];
    month: string[];
    content_type: string[];
    language: string[];
    audience_location: string[];
  };
  columns: string[];
  creator_tier_follower_bounds: Record<string, [number, number]>;
  methodology_note: string;
  data: AggregateRow[];
}

// ---------------------------------------------------------------------
// SERVER-ONLY artifact (dashboard/data/server_aggregates.json). NOT under
// public/, NEVER fetched from client code -- see
// scripts/build_aggregates.py build_server_aggregates() and
// lib/server-aggregates.ts. Extends the public cube's 5 dimensions with
// content_type x length_bucket x daypart so app/api/recommendations/
// route.ts can compute format/duration/posting-time breakdowns WITHIN the
// dashboard's active filter instead of dataset-wide. Kept out of the
// public cube because the full 8-dimension cross product has ~40.7k
// non-empty cells (~1.5+ MB) vs. ~3k cells (~140 KB) for the 5-dimension
// public cube -- too much to ship to the browser for a feature only the
// server-side LLM prompt needs.
// language / audience_location were added as 2 more dimensions (10 total)
// so computeFilteredFormatBreakdown/computeFilteredDaypartBreakdown/
// computeFilteredDurationBreakdown (app/api/recommendations) also respect
// the content_type/language/audience_location filters added to Filters,
// not just platform/category/tier/sponsored/month. Measured: 51,614
// non-empty cells (~2 MB) -- server-only, never shipped to the browser.
export type ServerAggregateRow = [
  platformIdx: number,
  categoryIdx: number,
  tierIdx: number,
  sponsored: 0 | 1,
  monthIdx: number,
  contentTypeIdx: number,
  lengthBucketIdx: number,
  daypartIdx: number,
  languageIdx: number,
  audienceLocationIdx: number,
  n: number,
  sumViews: number,
  sumLikes: number,
  sumShares: number,
  sumComments: number,
];

export interface ServerAggregatesFile {
  generated_at: string;
  note: string;
  legend: {
    platform: string[];
    category: string[];
    creator_tier: string[];
    sponsored: string[];
    month: string[];
    content_type: string[];
    length_bucket: string[];
    daypart: string[];
    language: string[];
    audience_location: string[];
  };
  columns: string[];
  data: ServerAggregateRow[];
}

export interface Filters {
  platforms: string[]; // empty = all
  categories: string[]; // empty = all
  tiers: string[]; // empty = all
  sponsored: "all" | "sponsored" | "organic";
  monthFrom: string | null;
  monthTo: string | null;
  contentTypes: string[]; // empty = all
  languages: string[]; // empty = all
  audienceLocations: string[]; // empty = all
}

export interface AggregatedResult {
  n: number;
  sumViews: number;
  sumLikes: number;
  sumShares: number;
  sumComments: number;
  sumFollowers: number;
  weightedEngagementRate: number | null; // (likes+shares+comments)/views
  // Per-metric breakouts of the blended rate above -- same sums, no new
  // data. Each answers a different business question even when the
  // blended rate looks flat: likeRate = casual approval (reach ->
  // approval), shareRate = virality/distribution, commentRate =
  // conversation/depth. See lib/aggregate-utils.ts `aggregate()` for the
  // exact arithmetic (all are numerator/sumViews).
  likeRate: number | null;
  shareRate: number | null;
  commentRate: number | null;
  avgViewsPerPost: number | null;
  avgFollowers: number | null;
  cellCount: number;
}
