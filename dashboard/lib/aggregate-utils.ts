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
