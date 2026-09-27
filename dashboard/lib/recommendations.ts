import type { AggregatedResult, AggregatesFile, Filters } from "./types";
import {
  aggregate,
  aggregateSponsoredCompareControlled,
  dataTier,
} from "./aggregate-utils";

// ---------------------------------------------------------------------
// Phase 3c: rule-based recommendations, computed live from the same
// aggregate cells already loaded for the rest of the dashboard. No new
// data pipeline, no model, no LLM -- every recommendation below is a
// direct comparison between aggregate-cell rollups (the same `aggregate`
// and `aggregateSponsoredCompareControlled` helpers the KPI/tabs use),
// gated by the same plain-language confidence tiers (`dataTier`) used
// everywhere else in the app. If a comparison doesn't clear the
// confidence floor, we say so instead of forcing a recommendation --
// same honesty rule as the rest of the dashboard.
// ---------------------------------------------------------------------

export type RecommendationTone = "positive" | "negative" | "neutral" | "insufficient";

export interface Recommendation {
  id: string;
  title: string;
  body: string;
  action: string;
  tone: RecommendationTone;
}

const MEANINGFUL_DIFF_PCT = 5; // relative %, below this we call it "about the same"
const MEANINGFUL_SPONSOR_DIFF_PCT = 3; // relative %, matches the dashboard's flat-signal framing

function fmtPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "-";
  return `${(n * 100).toFixed(2)}%`;
}

/** Plain-language label for the segment implied by the current filters. */
export function describeSegment(filters: Filters): string {
  const parts: string[] = [];
  parts.push(
    filters.platforms.length === 1
      ? filters.platforms[0]
      : filters.platforms.length > 1
      ? `${filters.platforms.length} selected platforms`
      : "all platforms"
  );
  parts.push(
    filters.categories.length === 1
      ? filters.categories[0]
      : filters.categories.length > 1
      ? `${filters.categories.length} selected categories`
      : "all categories"
  );
  parts.push(
    filters.tiers.length === 1
      ? `${filters.tiers[0]}-tier creators`
      : filters.tiers.length > 1
      ? `${filters.tiers.length} selected creator tiers`
      : "all creator tiers"
  );
  if (filters.sponsored !== "all") {
    parts.push(filters.sponsored === "sponsored" ? "sponsored posts only" : "organic posts only");
  }
  return parts.join(", ");
}

/**
 * Sponsorship recommendation for the CURRENT filter selection: reuses the
 * fair, matched-group sponsored-vs-organic comparison (median lift across
 * platform x category x creator-tier groups) that already powers the
 * "Sponsored vs. organic" tab, and turns it into a plain "does this pay
 * off here?" verdict, only when the underlying data clears the same
 * confidence floor already used for that tab.
 */
export function buildSponsorRecommendation(
  file: AggregatesFile,
  filters: Filters
): Recommendation {
  const segment = describeSegment(filters);
  const cmp = aggregateSponsoredCompareControlled(file, filters);

  if (cmp.medianGroupLift === null || dataTier(cmp.minGroupN) === "insufficient") {
    return {
      id: "sponsorship",
      title: "Should you sponsor this segment?",
      body: `There isn't enough matched data (organic and sponsored posts in the same platform x category x creator-tier group) for ${segment} to say whether sponsoring pays off here.`,
      action:
        "Widen the filter (drop the creator-tier or category filter) or wait for more sponsored posts to accumulate in this segment before deciding.",
      tone: "insufficient",
    };
  }

  const pct = (cmp.medianGroupLift - 1) * 100;
  const thin = dataTier(cmp.minGroupN) === "thin";
  const thinNote = thin
    ? " (based on a fairly small number of matched posts -- treat this as a directional signal, not a firm number)"
    : "";

  if (pct >= MEANINGFUL_SPONSOR_DIFF_PCT) {
    return {
      id: "sponsorship",
      title: "Should you sponsor this segment?",
      body: `Sponsored posts in ${segment} score ${pct.toFixed(1)}% higher engagement than matched organic posts${thinNote}.`,
      action:
        "This is one of the segments where sponsorship shows a real edge -- it's a reasonable place to prioritize sponsorship budget over segments with no measurable lift.",
      tone: "positive",
    };
  }
  if (pct <= -MEANINGFUL_SPONSOR_DIFF_PCT) {
    return {
      id: "sponsorship",
      title: "Should you sponsor this segment?",
      body: `Sponsored posts in ${segment} score ${Math.abs(pct).toFixed(1)}% lower engagement than matched organic posts${thinNote}.`,
      action:
        "Don't pay a premium to sponsor content in this segment on engagement grounds alone -- organic performs at least as well here.",
      tone: "negative",
    };
  }
  return {
    id: "sponsorship",
    title: "Should you sponsor this segment?",
    body: `Sponsored and organic posts in ${segment} perform about the same (${pct >= 0 ? "+" : ""}${pct.toFixed(
      1
    )}%, within normal variation)${thinNote}.`,
    action:
      "Sponsorship isn't buying extra engagement in this segment -- only sponsor here for reasons other than engagement (reach, relationship, contractual), not to chase engagement lift.",
    tone: "neutral",
  };
}

type AxisKey = "categories" | "tiers";

const AXIS_CONFIG: Record<
  AxisKey,
  { legendKey: "category" | "creator_tier"; label: string; title: string }
> = {
  categories: { legendKey: "category", label: "category", title: "Category focus" },
  tiers: { legendKey: "creator_tier", label: "creator tier", title: "Creator-tier focus" },
};

/**
 * Compares the currently selected value on one axis (category or creator
 * tier) against every sibling value on that same axis, holding every other
 * current filter fixed -- e.g. "within TikTok + Mid-tier, is Tech doing
 * better or worse than the other categories?". Only fires when exactly one
 * value is selected on that axis (otherwise there's no single segment to
 * compare), and only reports a gap when both sides clear the same
 * confidence floor used everywhere else in the app.
 */
export function buildAxisRecommendation(file: AggregatesFile, filters: Filters, axis: AxisKey): Recommendation {
  const { legendKey, label, title } = AXIS_CONFIG[axis];
  const selected = filters[axis];

  if (selected.length !== 1) {
    return {
      id: axis,
      title,
      body: `Select exactly one ${label} (on top of your other filters) to see how it compares against the alternatives.`,
      action: `Narrow the ${label} filter above to get a segment-specific comparison.`,
      tone: "insufficient",
    };
  }

  const current = selected[0];
  const currentResult = aggregate(file, filters);

  if (dataTier(currentResult.n) === "insufficient" || currentResult.weightedEngagementRate === null) {
    return {
      id: axis,
      title,
      body: `Not enough posts for ${current} under these filters to compare it fairly against other ${label} options.`,
      action: "Widen the filters (e.g. remove the date range or creator-tier filter) and check again.",
      tone: "insufficient",
    };
  }

  const alternatives = file.legend[legendKey].filter((v) => v !== current);
  let best: { value: string; result: AggregatedResult } | null = null;
  let worst: { value: string; result: AggregatedResult } | null = null;

  for (const alt of alternatives) {
    const altFilters: Filters = { ...filters, [axis]: [alt] };
    const altResult = aggregate(file, altFilters);
    if (dataTier(altResult.n) === "insufficient" || altResult.weightedEngagementRate === null) continue;
    if (!best || altResult.weightedEngagementRate > (best.result.weightedEngagementRate ?? -Infinity)) {
      best = { value: alt, result: altResult };
    }
    if (!worst || altResult.weightedEngagementRate < (worst.result.weightedEngagementRate ?? Infinity)) {
      worst = { value: alt, result: altResult };
    }
  }

  if (!best || !worst) {
    return {
      id: axis,
      title,
      body: `None of the other ${label} options have enough matching posts under these filters to compare against ${current}.`,
      action: "Widen the filters and check again once more data is available for the alternatives.",
      tone: "insufficient",
    };
  }

  const currentRate = currentResult.weightedEngagementRate;
  const diffBestPct = ((best.result.weightedEngagementRate! - currentRate) / currentRate) * 100;
  const diffWorstPct = ((worst.result.weightedEngagementRate! - currentRate) / currentRate) * 100;
  const anyThin =
    dataTier(currentResult.n) === "thin" ||
    dataTier(best.result.n) === "thin" ||
    dataTier(worst.result.n) === "thin";
  const thinNote = anyThin ? " (small sample on at least one side -- treat as directional)" : "";

  const betterFound = best.value !== current && diffBestPct >= MEANINGFUL_DIFF_PCT;
  const worseFound = worst.value !== current && diffWorstPct <= -MEANINGFUL_DIFF_PCT;

  if (!betterFound && !worseFound) {
    return {
      id: axis,
      title,
      body: `Under these filters, ${current} performs about the same as the other ${label} options -- no meaningful gap either way (best alternative ${
        best.value
      } is ${diffBestPct >= 0 ? "+" : ""}${diffBestPct.toFixed(1)}%)${thinNote}.`,
      action: `No urgent reason to shift focus away from ${current} on engagement grounds alone.`,
      tone: "neutral",
    };
  }

  const sentences: string[] = [];
  if (betterFound) {
    sentences.push(
      `${best.value} performs ${diffBestPct.toFixed(1)}% better than ${current} under these filters (${fmtPct(
        best.result.weightedEngagementRate
      )} vs. ${fmtPct(currentRate)}).`
    );
  }
  if (worseFound) {
    sentences.push(
      `${worst.value} performs ${Math.abs(diffWorstPct).toFixed(1)}% worse than ${current} (${fmtPct(
        worst.result.weightedEngagementRate
      )} vs. ${fmtPct(currentRate)}).`
    );
  }

  return {
    id: axis,
    title,
    body: `${sentences.join(" ")}${thinNote}`,
    action: betterFound
      ? `Consider shifting some of the content mix from ${current} toward ${best.value} for this combination of filters, and monitor whether the gap holds up over the next few weeks.`
      : `${current} is still the better of the two -- no reason to move toward ${worst.value} based on engagement.`,
    tone: betterFound ? "positive" : "neutral",
  };
}

/** All recommendations for the current filter selection, in display order. */
export function buildRecommendations(file: AggregatesFile, filters: Filters): Recommendation[] {
  return [
    buildAxisRecommendation(file, filters, "categories"),
    buildAxisRecommendation(file, filters, "tiers"),
    buildSponsorRecommendation(file, filters),
  ];
}
