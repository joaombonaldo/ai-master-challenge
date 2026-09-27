// Types for the pre-aggregated data artifact (public/data/aggregates.json).
// See dashboard/scripts/build_aggregates.py for how this file is generated.
// Every row is an AGGREGATE CELL (platform x category x creator_tier x
// sponsored x month) -- never a single post/row from the raw dataset.

export type AggregateRow = [
  platformIdx: number,
  categoryIdx: number,
  tierIdx: number,
  sponsored: 0 | 1,
  monthIdx: number,
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
export type ServerAggregateRow = [
  platformIdx: number,
  categoryIdx: number,
  tierIdx: number,
  sponsored: 0 | 1,
  monthIdx: number,
  contentTypeIdx: number,
  lengthBucketIdx: number,
  daypartIdx: number,
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
}

export interface AggregatedResult {
  n: number;
  sumViews: number;
  sumLikes: number;
  sumShares: number;
  sumComments: number;
  sumFollowers: number;
  weightedEngagementRate: number | null; // (likes+shares+comments)/views
  avgViewsPerPost: number | null;
  avgFollowers: number | null;
  cellCount: number;
}
