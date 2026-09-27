import type {
  AggregatedResult,
  AggregatesFile,
  Filters,
} from "./types";

export const DEFAULT_FILTERS: Filters = {
  platforms: [],
  categories: [],
  tiers: [],
  sponsored: "all",
  monthFrom: null,
  monthTo: null,
};

/** Does one aggregate-cell row match the current filter selection? */
function rowMatches(
  row: AggregatesFile["data"][number],
  file: AggregatesFile,
  filters: Filters
): boolean {
  const [platformIdx, categoryIdx, tierIdx, sponsored, monthIdx] = row;

  if (filters.platforms.length > 0) {
    const platform = file.legend.platform[platformIdx];
    if (!filters.platforms.includes(platform)) return false;
  }
  if (filters.categories.length > 0) {
    const category = file.legend.category[categoryIdx];
    if (!filters.categories.includes(category)) return false;
  }
  if (filters.tiers.length > 0) {
    const tier = file.legend.creator_tier[tierIdx];
    if (!filters.tiers.includes(tier)) return false;
  }
  if (filters.sponsored === "sponsored" && sponsored !== 1) return false;
  if (filters.sponsored === "organic" && sponsored !== 0) return false;

  const month = file.legend.month[monthIdx];
  if (filters.monthFrom && month < filters.monthFrom) return false;
  if (filters.monthTo && month > filters.monthTo) return false;

  return true;
}

/**
 * Combine every matching cell by SUMMING raw counts (sums are additive and
 * therefore exact for any filter combination), then derive rates from the
 * combined sums. This is a weighted average, not a median-of-medians
 * approximation -- see build_aggregates.py docstring.
 */
export function aggregate(
  file: AggregatesFile,
  filters: Filters
): AggregatedResult {
  let n = 0;
  let sumViews = 0;
  let sumLikes = 0;
  let sumShares = 0;
  let sumComments = 0;
  let sumFollowers = 0;
  let cellCount = 0;

  for (const row of file.data) {
    if (!rowMatches(row, file, filters)) continue;
    cellCount += 1;
    n += row[5];
    sumViews += row[6];
    sumLikes += row[7];
    sumShares += row[8];
    sumComments += row[9];
    sumFollowers += row[10];
  }

  return {
    n,
    sumViews,
    sumLikes,
    sumShares,
    sumComments,
    sumFollowers,
    weightedEngagementRate:
      sumViews > 0 ? (sumLikes + sumShares + sumComments) / sumViews : null,
    avgViewsPerPost: n > 0 ? sumViews / n : null,
    avgFollowers: n > 0 ? sumFollowers / n : null,
    cellCount,
  };
}

/** Same aggregate, broken down by platform, for the breakdown table. */
export function aggregateByPlatform(
  file: AggregatesFile,
  filters: Filters
): Array<{ platform: string } & AggregatedResult> {
  const platforms =
    filters.platforms.length > 0 ? filters.platforms : file.legend.platform;
  return platforms.map((platform) => {
    const scoped: Filters = { ...filters, platforms: [platform] };
    return { platform, ...aggregate(file, scoped) };
  });
}

// ---------------------------------------------------------------------
// Phase 3b: lift indicator + fair (controlled) sponsored comparison.
// Both are pure arithmetic on aggregate cells -- no model, no LLM. This
// mirrors the methodology of findings.json F19/F20 (direct ratio vs. a
// baseline) and F11 (median of per-group differences across matched
// platform x category x creator-tier groups), NOT the raw pooled
// sponsored-vs-organic split that Phase 3a's SponsoredCompare used.
// ---------------------------------------------------------------------

export interface LiftResult {
  selectionRate: number | null;
  baselineRate: number | null;
  lift: number | null; // ratio, e.g. 1.009 == +0.9%
  n: number;
  baselineN: number;
  baselineLabel: string;
}

/**
 * Lift = current filtered selection's weighted engagement rate vs. that
 * selection's own platform baseline (same platform(s), but ignoring
 * category/tier/sponsored/month cuts) -- or the global baseline if no
 * platform is selected. This is the same "vs. platform average" framing
 * as F02-F09/F19/F20 in findings.json, computed live from whatever cells
 * match the current filters. It is NOT directly comparable number-for-
 * number with findings.json: findings.json compares MEDIAN engagement
 * rate per post, this dashboard compares a WEIGHTED AVERAGE (sum of
 * sums) -- both are simple ratios of the same underlying data, just a
 * different central-tendency choice, so treat this as directional, not
 * a reproduction of a specific finding.
 */
export function computeLiftVsBaseline(
  file: AggregatesFile,
  filters: Filters
): LiftResult {
  const selection = aggregate(file, filters);

  const baselineFilters: Filters = {
    ...DEFAULT_FILTERS,
    platforms: filters.platforms,
  };
  const baseline = aggregate(file, baselineFilters);

  const baselineLabel =
    filters.platforms.length === 1
      ? `${filters.platforms[0]} average`
      : filters.platforms.length > 1
      ? "selected platforms' average"
      : "global average";

  let lift: number | null = null;
  if (
    baseline.weightedEngagementRate !== null &&
    baseline.weightedEngagementRate > 0 &&
    selection.weightedEngagementRate !== null
  ) {
    lift = selection.weightedEngagementRate / baseline.weightedEngagementRate;
  }

  return {
    selectionRate: selection.weightedEngagementRate,
    baselineRate: baseline.weightedEngagementRate,
    lift,
    n: selection.n,
    baselineN: baseline.n,
    baselineLabel,
  };
}

export interface ControlledSponsoredResult {
  organic: AggregatedResult; // pooled, shown for context (n, rate)
  sponsored: AggregatedResult; // pooled, shown for context (n, rate)
  medianGroupLift: number | null; // median of per-group sponsored/organic ratios
  groupCount: number; // number of platform x category x tier groups compared
  minGroupN: number; // smallest organic/sponsored n among compared groups
}

const MIN_GROUP_N = 10; // floor to avoid noisy tiny groups; findings.json used n>=30 on the full dataset, this dashboard slices further by user filters so a lower floor is used and disclosed in the UI.

// ---------------------------------------------------------------------
// Plain-language data-confidence tiering for live lift/comparison numbers.
// The dashboard's interactive floor (MIN_GROUP_N = 10 above) is looser than
// findings.json's rigor bar (n>=30) because users can narrow filters to
// small slices. Rather than exposing that gap as stats jargon, every
// lift/comparison value is tagged with one of three tiers so non-technical
// users get a friendly, honest signal instead of a number that looks more
// solid than it is. See components/DataConfidenceDot.tsx for the UI.
// ---------------------------------------------------------------------

export type DataTier = "full" | "thin" | "insufficient";

export function dataTier(n: number): DataTier {
  if (n >= 30) return "full";
  if (n >= 10) return "thin";
  return "insufficient";
}

/**
 * Fair sponsored-vs-organic comparison: instead of pooling all matching
 * cells into one organic rate and one sponsored rate (which mixes
 * platform/category/tier composition between the two groups), this
 * computes the sponsored/organic ratio SEPARATELY within each
 * platform x category x tier combination implied by the current filters,
 * then takes the MEDIAN of those group-level ratios. This is the same
 * "matched groups" logic as F11 in findings.json (60 groups = 5
 * platforms x 3 categories x 4 tiers when no filter narrows them).
 */
export function aggregateSponsoredCompareControlled(
  file: AggregatesFile,
  filters: Filters
): ControlledSponsoredResult {
  const platforms =
    filters.platforms.length > 0 ? filters.platforms : file.legend.platform;
  const categories =
    filters.categories.length > 0 ? filters.categories : file.legend.category;
  const tiers = filters.tiers.length > 0 ? filters.tiers : file.legend.creator_tier;

  const organic = aggregate(file, { ...filters, sponsored: "organic" });
  const sponsored = aggregate(file, { ...filters, sponsored: "sponsored" });

  const groupLifts: number[] = [];
  let minGroupN = Infinity;

  for (const platform of platforms) {
    for (const category of categories) {
      for (const tier of tiers) {
        const groupFilters: Filters = {
          ...filters,
          platforms: [platform],
          categories: [category],
          tiers: [tier],
        };
        const o = aggregate(file, { ...groupFilters, sponsored: "organic" });
        const s = aggregate(file, { ...groupFilters, sponsored: "sponsored" });
        if (
          o.n >= MIN_GROUP_N &&
          s.n >= MIN_GROUP_N &&
          o.weightedEngagementRate !== null &&
          o.weightedEngagementRate > 0 &&
          s.weightedEngagementRate !== null
        ) {
          groupLifts.push(s.weightedEngagementRate / o.weightedEngagementRate);
          minGroupN = Math.min(minGroupN, o.n, s.n);
        }
      }
    }
  }

  groupLifts.sort((a, b) => a - b);
  const mid = Math.floor(groupLifts.length / 2);
  const medianGroupLift =
    groupLifts.length === 0
      ? null
      : groupLifts.length % 2 === 1
      ? groupLifts[mid]
      : (groupLifts[mid - 1] + groupLifts[mid]) / 2;

  return {
    organic,
    sponsored,
    medianGroupLift,
    groupCount: groupLifts.length,
    minGroupN: Number.isFinite(minGroupN) ? minGroupN : 0,
  };
}
