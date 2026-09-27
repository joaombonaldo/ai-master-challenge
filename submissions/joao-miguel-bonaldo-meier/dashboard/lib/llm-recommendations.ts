import type { AggregatedResult, AggregatesFile, Filters } from "./types";
import type { DataTier } from "./aggregate-utils";
import {
  aggregate,
  aggregateByAxis,
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
// copy. Still never raw post rows: everything here is derived from
// aggregate cells (`aggregate` / `aggregateByPlatform` / `aggregateByAxis` /
// `aggregateSponsoredCompareControlled`) that power the rest of the
// dashboard, plus the dataset-wide format/duration/posting-time
// breakdowns baked into aggregates.json by scripts/build_aggregates.py.
//
// Phase 3f fix (leader complaint: "recommendations don't reason over the
// data we have"): the previous version only ever sent a FULL ranked
// breakdown for platform, and gated the category/tier comparison behind
// "exactly one value selected" -- so most of the time the model only saw
// a narrow slice and could not prioritize across the real landscape. Now
// platform, category AND tier are ALWAYS sent fully ranked (every value,
// best to worst, with n + confidence), regardless of what's filtered. See
// buildPrompt in app/api/recommendations/route.ts for how this is used to
// ask the model to PRIORITIZE across axes, not just describe one.
//
// Phase 3g fix (leader decision): format/duration/posting-time breakdowns
// used to be dataset-wide (baked into aggregates.json at build time,
// ignoring the user's filter). The leader flagged this as wrong -- if the
// user filters to "tech" or to "Mega" creators, the format/duration/timing
// suggestion should reflect THAT slice, not the whole dataset. This client
// module no longer computes those three breakdowns at all: it only passes
// the raw `filters` object through in the payload, and the API route
// (app/api/recommendations/route.ts) recomputes format/duration/daypart
// WITHIN that filter server-side, from a richer server-only cube (see
// lib/server-aggregates.ts) that is never shipped to the browser.
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

// Per-metric breakout, platform level only (per leader spec) -- views =
// reach, likes = casual approval, shares = virality/distribution,
// comments = conversation/depth. Additive context only: these do NOT have
// a materiality floor computed (unlike weightedEngagementRatePct via
// axisSpread in the API route), so the prompt explicitly tells the model
// to treat them as informational, not as inputs to the existing
// eixo_tem_diferenca_material / confidence-tier logic.
export interface PlatformMetricStat {
  platform: string;
  posts: number;
  avgViewsPerPost: number | null;
  likeRatePct: number | null;
  shareRatePct: number | null;
  commentRatePct: number | null;
  confidence: DataTier;
}

export interface LlmRecommendationsPayload {
  segment: string;
  posts: number;
  // Raw filter state, passed through so the API route can recompute the
  // format/duration/daypart breakdowns WITHIN this exact filter server-side
  // (see lib/server-aggregates.ts) -- those breakdowns are no longer
  // computed dataset-wide here.
  filters: Filters;
  platformBreakdown: SegmentStat[];
  categoryBreakdown: SegmentStat[];
  tierBreakdown: SegmentStat[];
  // Platform-level only, per leader spec -- see PlatformMetricStat doc.
  platformMetricBreakdown: PlatformMetricStat[];
  sponsoredComparison: {
    medianGroupLiftPct: number | null; // (ratio - 1) * 100
    confidence: DataTier;
    organicPosts: number;
    sponsoredPosts: number;
    groupsCompared: number;
  };
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

/** Build the compact, numbers-only context payload sent to the LLM route. */
export function buildLlmRecommendationsPayload(
  file: AggregatesFile,
  filters: Filters
): LlmRecommendationsPayload {
  const result = aggregate(file, filters);
  const byPlatform = aggregateByPlatform(file, filters);
  const byCategory = aggregateByAxis(file, filters, "categories");
  const byTier = aggregateByAxis(file, filters, "tiers");
  const sponsoredCompare = aggregateSponsoredCompareControlled(file, filters);
  const fallback: Recommendation[] = buildRecommendations(file, filters);

  return {
    segment: describeSegment(filters),
    posts: result.n,
    filters,
    platformBreakdown: byPlatform.map((row) => toSegmentStat(row.platform, row)),
    categoryBreakdown: byCategory.map((row) => toSegmentStat(row.value, row)),
    tierBreakdown: byTier.map((row) => toSegmentStat(row.value, row)),
    platformMetricBreakdown: byPlatform.map((row) => ({
      platform: row.platform,
      posts: row.n,
      avgViewsPerPost: row.avgViewsPerPost,
      likeRatePct: row.likeRate !== null ? row.likeRate * 100 : null,
      shareRatePct: row.shareRate !== null ? row.shareRate * 100 : null,
      commentRatePct: row.commentRate !== null ? row.commentRate * 100 : null,
      confidence: dataTier(row.n),
    })),
    sponsoredComparison: {
      medianGroupLiftPct:
        sponsoredCompare.medianGroupLift !== null ? (sponsoredCompare.medianGroupLift - 1) * 100 : null,
      confidence:
        sponsoredCompare.medianGroupLift === null ? "insufficient" : dataTier(sponsoredCompare.minGroupN),
      organicPosts: sponsoredCompare.organic.n,
      sponsoredPosts: sponsoredCompare.sponsored.n,
      groupsCompared: sponsoredCompare.groupCount,
    },
    fallbackRecommendations: fallback.map((r) => ({
      title: r.title,
      body: r.body,
      action: r.action,
      tone: r.tone,
    })),
  };
}
