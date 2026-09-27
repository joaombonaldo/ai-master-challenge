import fs from "node:fs";
import path from "node:path";
import type { Filters, ServerAggregatesFile, ServerAggregateRow } from "./types";
import { dataTier, type DataTier } from "./aggregate-utils";
import type { SegmentStat } from "./llm-recommendations";

// ---------------------------------------------------------------------
// Phase 3g: server-only companion to lib/aggregate-utils.ts.
//
// This module uses node:fs and reads a file outside public/, so importing
// it from any "use client" component would break the build (fs is not
// available in the browser bundle) -- that is an intentional guardrail, not
// a missing dependency; no extra package (e.g. "server-only") is added for
// this given the project's "keep dependencies minimal" rule.
//
// Reads dashboard/data/server_aggregates.json -- an 8-dimension cube
// (platform x category x creator_tier x sponsored x month x content_type x
// length_bucket x daypart) that is NEVER placed under public/ and NEVER
// imported from client ("use client") code. This module is only imported
// by app/api/recommendations/route.ts (runtime = "nodejs"), so the extra
// ~1.5 MB of granularity this cube carries is read once per server
// process/request and never sent to the browser.
//
// Why this file exists instead of extending the public cube: the leader
// asked for format/duration/posting-time recommendations to respect the
// dashboard's active filter, same as platform/category/tier already do.
// The public cube (platform x category x tier x sponsored x month) has
// ~2,969 non-empty cells (~140 KB). Naively adding content_type x
// length_bucket x daypart as three more filterable dimensions to that same
// public cube produces ~40,682 non-empty cells (~1.5+ MB, measured on the
// real dataset, not just the combinatorial upper bound of ~192k) -- a 10x+
// payload increase to every browser tab just to power three breakdowns
// only the LLM prompt needs. So it lives here instead, server-only.
// ---------------------------------------------------------------------

const SERVER_DATA_PATH = path.join(process.cwd(), "data", "server_aggregates.json");

let cached: ServerAggregatesFile | null = null;

function load(): ServerAggregatesFile {
  if (cached) return cached;
  const raw = fs.readFileSync(SERVER_DATA_PATH, "utf-8");
  cached = JSON.parse(raw) as ServerAggregatesFile;
  return cached;
}

function rowMatchesFilters(
  row: ServerAggregateRow,
  file: ServerAggregatesFile,
  filters: Filters
): boolean {
  const [platformIdx, categoryIdx, tierIdx, sponsored, monthIdx, contentTypeIdx, , , languageIdx, audienceLocationIdx] = row;

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

  if (filters.contentTypes.length > 0) {
    const contentType = file.legend.content_type[contentTypeIdx];
    if (!filters.contentTypes.includes(contentType)) return false;
  }
  if (filters.languages.length > 0) {
    const language = file.legend.language[languageIdx];
    if (!filters.languages.includes(language)) return false;
  }
  if (filters.audienceLocations.length > 0) {
    const location = file.legend.audience_location[audienceLocationIdx];
    if (!filters.audienceLocations.includes(location)) return false;
  }

  return true;
}

interface Sums {
  n: number;
  sumViews: number;
  sumLikes: number;
  sumShares: number;
  sumComments: number;
}

function emptySums(): Sums {
  return { n: 0, sumViews: 0, sumLikes: 0, sumShares: 0, sumComments: 0 };
}

function addRow(sums: Sums, row: ServerAggregateRow): void {
  sums.n += row[10];
  sums.sumViews += row[11];
  sums.sumLikes += row[12];
  sums.sumShares += row[13];
  sums.sumComments += row[14];
}

function toSegmentStat(value: string, sums: Sums): SegmentStat {
  return {
    value,
    posts: sums.n,
    weightedEngagementRatePct:
      sums.sumViews > 0 ? ((sums.sumLikes + sums.sumShares + sums.sumComments) / sums.sumViews) * 100 : null,
    confidence: dataTier(sums.n),
  };
}

/** Format (content_type) breakdown, grouped WITHIN the active filter. */
export function computeFilteredFormatBreakdown(filters: Filters): SegmentStat[] {
  const file = load();
  const byIdx = new Map<number, Sums>();
  for (const row of file.data) {
    if (!rowMatchesFilters(row, file, filters)) continue;
    const idx = row[5];
    const sums = byIdx.get(idx) ?? emptySums();
    addRow(sums, row);
    byIdx.set(idx, sums);
  }
  return file.legend.content_type
    .map((value, idx) => toSegmentStat(value, byIdx.get(idx) ?? emptySums()))
    .filter((s) => s.posts > 0);
}

/** Posting-time (daypart) breakdown, grouped WITHIN the active filter. */
export function computeFilteredDaypartBreakdown(filters: Filters): SegmentStat[] {
  const file = load();
  const byIdx = new Map<number, Sums>();
  for (const row of file.data) {
    if (!rowMatchesFilters(row, file, filters)) continue;
    const idx = row[7];
    const sums = byIdx.get(idx) ?? emptySums();
    addRow(sums, row);
    byIdx.set(idx, sums);
  }
  return file.legend.daypart
    .map((value, idx) => toSegmentStat(value, byIdx.get(idx) ?? emptySums()))
    .filter((s) => s.posts > 0);
}

/**
 * Duration-within-format breakdown, grouped WITHIN the active filter.
 * length_bucket is only meaningful paired with its content_type (buckets
 * are quartiles of content_length computed separately per format, since
 * units differ -- video seconds vs. text/caption characters), so this
 * groups by (content_type, length_bucket) together, same as the removed
 * client-side dataset-wide version did.
 */
export function computeFilteredDurationBreakdown(
  filters: Filters
): Array<SegmentStat & { format: string }> {
  const file = load();
  const byKey = new Map<string, Sums>();
  for (const row of file.data) {
    if (!rowMatchesFilters(row, file, filters)) continue;
    const key = `${row[5]}:${row[6]}`;
    const sums = byKey.get(key) ?? emptySums();
    addRow(sums, row);
    byKey.set(key, sums);
  }
  const out: Array<SegmentStat & { format: string }> = [];
  for (const [key, sums] of byKey.entries()) {
    if (sums.n === 0) continue;
    const [ctIdxStr, lbIdxStr] = key.split(":");
    const ctIdx = Number(ctIdxStr);
    const lbIdx = Number(lbIdxStr);
    const stat = toSegmentStat(file.legend.length_bucket[lbIdx], sums);
    out.push({ ...stat, format: file.legend.content_type[ctIdx] });
  }
  return out;
}

/** Re-exported for callers that only need the confidence tier helper. */
export type { DataTier };
