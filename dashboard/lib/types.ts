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
