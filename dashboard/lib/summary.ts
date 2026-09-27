import type { AggregatedResult, Filters } from "./types";
import type { LiftResult, ControlledSponsoredResult, DataTier } from "./aggregate-utils";
import type { Recommendation } from "./recommendations";
import { dataTier } from "./aggregate-utils";
import { describeSegment } from "./recommendations";

// ---------------------------------------------------------------------
// Phase 3d: executive summary. This file is imported by BOTH the client
// (to build the compact payload from numbers already on screen) and the
// server API route (app/api/summary/route.ts, for the templated
// fallback) -- it must stay free of secrets and side effects so it is
// safe to bundle into client JS.
//
// The payload is deliberately tiny (a handful of numbers + short strings
// already shown in the UI) -- never raw rows, never the full aggregates
// file. See app/api/summary/route.ts for the LLM call and env var.
// ---------------------------------------------------------------------

export interface ExecutiveSummaryPayload {
  segment: string;
  posts: number;
  weightedEngagementRatePct: number | null;
  liftPct: number | null;
  liftBaselineLabel: string;
  sponsoredVsOrganicPct: number | null;
  sponsoredDataTier: DataTier;
  recommendations: Array<{ title: string; body: string; action: string; tone: string }>;
}

/** Build the compact payload from values the dashboard has already computed. */
export function buildExecutiveSummaryPayload(
  filters: Filters,
  result: AggregatedResult,
  baselineLift: LiftResult,
  sponsoredCompare: ControlledSponsoredResult,
  recommendations: Recommendation[]
): ExecutiveSummaryPayload {
  return {
    segment: describeSegment(filters),
    posts: result.n,
    weightedEngagementRatePct:
      result.weightedEngagementRate !== null ? result.weightedEngagementRate * 100 : null,
    liftPct: baselineLift.lift !== null ? (baselineLift.lift - 1) * 100 : null,
    liftBaselineLabel: baselineLift.baselineLabel,
    sponsoredVsOrganicPct:
      sponsoredCompare.medianGroupLift !== null
        ? (sponsoredCompare.medianGroupLift - 1) * 100
        : null,
    sponsoredDataTier:
      sponsoredCompare.medianGroupLift === null
        ? "insufficient"
        : dataTier(sponsoredCompare.minGroupN),
    recommendations: recommendations.map((r) => ({
      title: r.title,
      body: r.body,
      action: r.action,
      tone: r.tone,
    })),
  };
}

function pct(n: number | null, digits = 1): string {
  if (n === null || Number.isNaN(n)) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/**
 * Plain-language, templated (non-LLM) executive summary built by simple
 * string interpolation over the same payload sent to the LLM. Used
 * whenever no free-tier API key is configured, or whenever the live LLM
 * call fails for any reason -- the button must never show a broken state.
 */
export function buildTemplatedSummary(payload: ExecutiveSummaryPayload): string {
  const lines: string[] = [];

  lines.push(
    `Looking at ${payload.segment} (${payload.posts.toLocaleString()} posts), the weighted engagement rate is ${
      payload.weightedEngagementRatePct !== null ? payload.weightedEngagementRatePct.toFixed(2) + "%" : "not available for this filter"
    }.`
  );

  if (payload.liftPct !== null) {
    const cmp = Math.abs(payload.liftPct) < 1 ? "about in line with" : payload.liftPct > 0 ? "above" : "below";
    lines.push(`That's ${cmp} the ${payload.liftBaselineLabel} (${pct(payload.liftPct)}).`);
  }

  if (payload.sponsoredDataTier === "insufficient" || payload.sponsoredVsOrganicPct === null) {
    lines.push("There isn't enough matched sponsored/organic data here to say whether sponsorship pays off in this segment.");
  } else if (Math.abs(payload.sponsoredVsOrganicPct) < 3) {
    lines.push("Sponsored and organic posts perform about the same here, so sponsorship isn't buying extra engagement on its own.");
  } else if (payload.sponsoredVsOrganicPct > 0) {
    lines.push(`Sponsored posts outperform matched organic posts by ${pct(payload.sponsoredVsOrganicPct)} here.`);
  } else {
    lines.push(`Sponsored posts underperform matched organic posts by ${pct(Math.abs(payload.sponsoredVsOrganicPct))} here -- organic does at least as well.`);
  }

  const actionable = payload.recommendations.find((r) => r.tone === "positive" || r.tone === "negative");
  if (actionable) {
    lines.push(actionable.action);
  } else {
    const neutral = payload.recommendations.find((r) => r.tone === "neutral");
    if (neutral) lines.push(neutral.action);
  }

  return lines.join(" ");
}
