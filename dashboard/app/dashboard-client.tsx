"use client";

import { useMemo, useState } from "react";
import type { AggregatesFile, Filters } from "@/lib/types";
import { DEFAULT_FILTERS, aggregate, aggregateByPlatform } from "@/lib/aggregate-utils";
import PlatformChart, { platformColor } from "./components/PlatformChart";
import SponsoredCompare from "./components/SponsoredCompare";

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function fmtInt(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "-";
  return Math.round(n).toLocaleString();
}

function fmtPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "-";
  return `${(n * 100).toFixed(2)}%`;
}

type Tab = "platform" | "sponsored";

export default function DashboardClient({
  aggregates,
}: {
  aggregates: AggregatesFile;
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<Tab>("platform");

  const months = aggregates.legend.month;
  const minMonth = months[0];
  const maxMonth = months[months.length - 1];

  const result = useMemo(
    () => aggregate(aggregates, filters),
    [aggregates, filters]
  );
  const byPlatform = useMemo(
    () => aggregateByPlatform(aggregates, filters),
    [aggregates, filters]
  );
  const organicResult = useMemo(
    () => aggregate(aggregates, { ...filters, sponsored: "organic" }),
    [aggregates, filters]
  );
  const sponsoredResult = useMemo(
    () => aggregate(aggregates, { ...filters, sponsored: "sponsored" }),
    [aggregates, filters]
  );

  const lift = useMemo(() => {
    const o = organicResult.weightedEngagementRate;
    const s = sponsoredResult.weightedEngagementRate;
    if (o === null || o === 0 || s === null) return null;
    return (s - o) / o;
  }, [organicResult, sponsoredResult]);

  const activeFilterCount =
    filters.platforms.length +
    filters.categories.length +
    filters.tiers.length +
    (filters.sponsored !== "all" ? 1 : 0) +
    (filters.monthFrom ? 1 : 0) +
    (filters.monthTo ? 1 : 0);

  return (
    <>
      {/* ---------- Filters: one compact strip, advanced (dates) collapsed ---------- */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Filters</h2>
            <p className="panel-subtitle">
              {activeFilterCount > 0
                ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
                : "Showing all data"}
            </p>
          </div>
          <button className="reset-btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset filters
          </button>
        </div>
        <div className="filter-strip">
          <div className="filter-group">
            <label>Platform</label>
            <div className="chip-row">
              {aggregates.legend.platform.map((p) => (
                <button
                  key={p}
                  className={`chip ${filters.platforms.includes(p) ? "active" : ""}`}
                  onClick={() =>
                    setFilters((f) => ({ ...f, platforms: toggle(f.platforms, p) }))
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Category</label>
            <div className="chip-row">
              {aggregates.legend.category.map((c) => (
                <button
                  key={c}
                  className={`chip ${filters.categories.includes(c) ? "active" : ""}`}
                  onClick={() =>
                    setFilters((f) => ({ ...f, categories: toggle(f.categories, c) }))
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Creator tier</label>
            <div className="chip-row">
              {aggregates.legend.creator_tier.map((t) => (
                <button
                  key={t}
                  className={`chip ${filters.tiers.includes(t) ? "active" : ""}`}
                  onClick={() =>
                    setFilters((f) => ({ ...f, tiers: toggle(f.tiers, t) }))
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Sponsorship</label>
            <div className="select-wrap" style={{ maxWidth: 170 }}>
              <select
                value={filters.sponsored}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    sponsored: e.target.value as Filters["sponsored"],
                  }))
                }
              >
                <option value="all">All posts</option>
                <option value="sponsored">Sponsored only</option>
                <option value="organic">Organic only</option>
              </select>
            </div>
          </div>
        </div>

        <details className="advanced-filters">
          <summary>
            Advanced: date range
            {(filters.monthFrom || filters.monthTo) ? " (active)" : ""}
          </summary>
          <div className="advanced-body">
            <div className="filter-group">
              <label>From month</label>
              <div className="select-wrap">
                <select
                  value={filters.monthFrom ?? ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, monthFrom: e.target.value || null }))
                  }
                >
                  <option value="">{minMonth} (earliest)</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-group">
              <label>To month</label>
              <div className="select-wrap">
                <select
                  value={filters.monthTo ?? ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, monthTo: e.target.value || null }))
                  }
                >
                  <option value="">{maxMonth} (latest)</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* ---------- Headline KPIs: the 4 numbers that matter most, up top ---------- */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Result</h2>
            <p className="panel-subtitle">
              {result.n.toLocaleString()} posts across {result.cellCount.toLocaleString()}{" "}
              matched cells
            </p>
          </div>
        </div>

        <div className="hero-grid">
          <div className="hero-cell">
            <div className="label">Posts</div>
            <div className="value">{fmtInt(result.n)}</div>
          </div>
          <div className="hero-cell">
            <div className="label">Total views</div>
            <div className="value">{fmtInt(result.sumViews)}</div>
          </div>
          <div className="hero-cell lead">
            <div className="label">Weighted engagement rate</div>
            <div className="value">{fmtPct(result.weightedEngagementRate)}</div>
          </div>
          <div className="hero-cell">
            <div className="label">Sponsored vs. organic</div>
            <div className="value">
              {lift === null ? "-" : `${lift >= 0 ? "+" : ""}${(lift * 100).toFixed(1)}%`}
            </div>
            <div className="sub">weighted ER lift, current filters</div>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">Total likes</div>
            <div className="value">{fmtInt(result.sumLikes)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total shares</div>
            <div className="value">{fmtInt(result.sumShares)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total comments</div>
            <div className="value">{fmtInt(result.sumComments)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Avg views / post</div>
            <div className="value">{fmtInt(result.avgViewsPerPost)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Avg followers (creator)</div>
            <div className="value">{fmtInt(result.avgFollowers)}</div>
          </div>
        </div>

        <p className="note" style={{ marginTop: 20 }}>
          Engagement rate = (likes + shares + comments) / views, weighted
          across all matched aggregate cells (sum of sums, not an average of
          averages). This is a live filter, not a finding or recommendation --
          see solution/outputs/findings.json for the vetted, segmented
          analysis this dashboard is built on top of.
        </p>
      </section>

      {/* ---------- Secondary detail: tabs instead of stacked panels ---------- */}
      <section className="panel">
        <div className="tab-row">
          <button
            className={`tab-btn ${tab === "platform" ? "active" : ""}`}
            onClick={() => setTab("platform")}
          >
            Breakdown by platform
          </button>
          <button
            className={`tab-btn ${tab === "sponsored" ? "active" : ""}`}
            onClick={() => setTab("sponsored")}
          >
            Sponsored vs. organic
          </button>
        </div>

        {tab === "platform" && (
          <div>
            <p className="panel-subtitle" style={{ marginBottom: 16 }}>
              Weighted engagement rate per platform, within current filters
            </p>
            <PlatformChart rows={byPlatform} />
            <hr className="section-divider" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Posts</th>
                    <th>Views</th>
                    <th>Weighted ER</th>
                    <th>Avg views/post</th>
                  </tr>
                </thead>
                <tbody>
                  {byPlatform.map((row) => (
                    <tr key={row.platform}>
                      <td className="platform-cell">
                        <span
                          className="platform-swatch"
                          style={{ background: platformColor(row.platform) }}
                        />
                        {row.platform}
                      </td>
                      <td>{fmtInt(row.n)}</td>
                      <td>{fmtInt(row.sumViews)}</td>
                      <td>{fmtPct(row.weightedEngagementRate)}</td>
                      <td>{fmtInt(row.avgViewsPerPost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "sponsored" && (
          <div>
            <p className="panel-subtitle" style={{ marginBottom: 16 }}>
              Weighted engagement rate, within current filters
            </p>
            <SponsoredCompare organic={organicResult} sponsored={sponsoredResult} />
          </div>
        )}
      </section>

      {/* ---------- Methodology: collapsed by default, one click away ---------- */}
      <section className="panel">
        <details className="methodology-details">
          <summary>
            <h2 className="panel-title" style={{ margin: 0 }}>
              Methodology
            </h2>
            <span className="chevron">&#8250;</span>
          </summary>
          <p className="note">{aggregates.methodology_note}</p>
          <p className="note" style={{ marginTop: 10 }}>
            Creator tier follower-count bounds:{" "}
            {Object.entries(aggregates.creator_tier_follower_bounds)
              .map(([tier, [lo, hi]]) => `${tier} ${lo.toLocaleString()}-${hi.toLocaleString()}`)
              .join(" | ")}
          </p>
          <p className="note" style={{ marginTop: 10 }}>
            Data generated: {aggregates.generated_at} from {aggregates.source}.
            Phase 3a scope: filterable aggregate skeleton -- no rule-based
            recommendations or LLM summary yet (see process-log/DECISIONS.md,
            sub-phases 3c-3e).
          </p>
        </details>
      </section>
    </>
  );
}
