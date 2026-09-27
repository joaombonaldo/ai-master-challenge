import type { AggregatedResult, AggregatesFile, Filters } from "./types";
import type { DataTier } from "./aggregate-utils";
import {
  aggregate,
  aggregateByPlatform,
  aggregateSponsoredCompareControlled,
  dataTier,
} from "./aggregate-utils";
import { describeSegment, buildRecommendations, type Recommendation } from "./recommendations";

// ---------------------------------------------------------------------
// Payload for the LLM-generated recommendations tab (app/api/recommendations
// /route.ts). Unlike lib/summary.ts (which sends the LLM the already-
// written rule-based sentences to rephrase), this payload sends only RAW
// AGGREGATE NUMBERS -- rates, counts, lifts, confidence tiers -- so the
// model has to reason over the numbers itself, not restate pre-written
// copy. Still never raw post rows: everything here is derived from the
// same aggregate cells (`aggregate` / `aggregateByPlatform` /
// `aggregateSponsoredCompareControlled`) that power the rest of the
// dashboard.
//
// `fallbackRecommendations` carries the existing rule-based engine's
// output too -- the API route's client caller uses it as the safety net
// if the LLM call fails or returns something that doesn't validate.
// ---------------------------------------------------------------------

export interface SegmentStat {
  value: string;
  posts: number;
  weightedEngagementRatePct: number | null;
  confidence: DataTier;
}

export interface AxisComparison {
  axisLabel: string; // "categoria" | "tier de criador"
  current: SegmentStat;
  best: SegmentStat | null; // best-performing sibling on this axis, if any has enough data
  worst: SegmentStat | null; // worst-performing sibling on this axis, if any has enough data
}

export interface LlmRecommendationsPayload {
  segment: string;
  posts: number;
  platformBreakdown: SegmentStat[];
  sponsoredComparison: {
    medianGroupLiftPct: number | null; // (ratio - 1) * 100
    confidence: DataTier;
    organicPosts: number;
    sponsoredPosts: number;
    groupsCompared: number;
  };
  categoryComparison: AxisComparison | null; // only when exactly one category is selected
  tierComparison: AxisComparison | null; // only when exactly one creator tier is selected
  fallbackRecommendations: Array<{ title: string; body: string; action: string; tone: string }>;
}

function toSegmentStat(value: string, result: AggregatedResult): SegmentStat {
  return {
    value,
    posts: result.n,
    weightedEngagementRatePct:
      result.weightedEngagementRate !== null ? result.weightedEngagementRate * 100 : null,
    confidence: dataTier(result.n),
  };
}

type AxisKey = "categories" | "tiers";

const AXIS_LABEL: Record<AxisKey, string> = {
  categories: "categoria",
  tiers: "tier de criador",
};

function buildAxisComparison(
  file: AggregatesFile,
  filters: Filters,
  axis: AxisKey
): AxisComparison | null {
  const selected = filters[axis];
  if (selected.length !== 1) return null;

  const current = selected[0];
  const currentResult = aggregate(file, filters);
  const currentStat = toSegmentStat(current, currentResult);

  const legendKey = axis === "categories" ? "category" : "creator_tier";
  const alternatives = file.legend[legendKey].filter((v) => v !== current);

  let best: SegmentStat | null = null;
  let worst: SegmentStat | null = null;

  for (const alt of alternatives) {
    const altFilters: Filters = { ...filters, [axis]: [alt] };
    const altResult = aggregate(file, altFilters);
    if (altResult.n === 0 || altResult.weightedEngagementRate === null) continue;
    const stat = toSegmentStat(alt, altResult);
    if (dataTier(stat.posts) === "insufficient") continue;
    if (!best || (stat.weightedEngagementRatePct ?? -Infinity) > (best.weightedEngagementRatePct ?? -Infinity)) {
      best = stat;
    }
    if (!worst || (stat.weightedEngagementRatePct ?? Infinity) < (worst.weightedEngagementRatePct ?? Infinity)) {
      worst = stat;
    }
  }

  return { axisLabel: AXIS_LABEL[axis], current: currentStat, best, worst };
}

/** Build the compact, numbers-only context payload sent to the LLM route. */
export function buildLlmRecommendationsPayload(
  file: AggregatesFile,
  filters: Filters
): LlmRecommendationsPayload {
  const result = aggregate(file, filters);
  const byPlatform = aggregateByPlatform(file, filters);
  const sponsoredCompare = aggregateSponsoredCompareControlled(file, filters);
  const fallback: Recommendation[] = buildRecommendations(file, filters);

  return {
    segment: describeSegment(filters),
    posts: result.n,
    platformBreakdown: byPlatform.map((row) => toSegmentStat(row.platform, row)),
    sponsoredComparison: {
      medianGroupLiftPct:
        sponsoredCompare.medianGroupLift !== null ? (sponsoredCompare.medianGroupLift - 1) * 100 : null,
      confidence:
        sponsoredCompare.medianGroupLift === null ? "insufficient" : dataTier(sponsoredCompare.minGroupN),
      organicPosts: sponsoredCompare.organic.n,
      sponsoredPosts: sponsoredCompare.sponsored.n,
      groupsCompared: sponsoredCompare.groupCount,
    },
    categoryComparison: buildAxisComparison(file, filters, "categories"),
    tierComparison: buildAxisComparison(file, filters, "tiers"),
    fallbackRecommendations: fallback.map((r) => ({
      title: r.title,
      body: r.body,
      action: r.action,
      tone: r.tone,
    })),
  };
}
