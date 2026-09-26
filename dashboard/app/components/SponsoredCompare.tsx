"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function fmtInt(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "-";
  return Math.round(n).toLocaleString();
}

function fmtPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "-";
  return `${(n * 100).toFixed(2)}%`;
}

interface CompareSide {
  n: number;
  weightedEngagementRate: number | null;
}

export default function SponsoredCompare({
  organic,
  sponsored,
}: {
  organic: CompareSide;
  sponsored: CompareSide;
}) {
  const organicRate = organic.weightedEngagementRate;
  const sponsoredRate = sponsored.weightedEngagementRate;

  const data = [
    { name: "Organic", ratePct: organicRate ? organicRate * 100 : 0 },
    { name: "Sponsored", ratePct: sponsoredRate ? sponsoredRate * 100 : 0 },
  ];

  let lift: number | null = null;
  if (organicRate && organicRate > 0 && sponsoredRate !== null) {
    lift = (sponsoredRate - organicRate) / organicRate;
  }

  return (
    <div className="compare-grid">
      <div className="compare-cards">
        <div className="compare-card organic">
          <span className="tag">
            <span className="dot" />
            Organic
          </span>
          <div className="rate">{fmtPct(organicRate)}</div>
          <div className="meta">{fmtInt(organic.n)} posts</div>
        </div>
        <div className="compare-card sponsored">
          <span className="tag">
            <span className="dot" />
            Sponsored
          </span>
          <div className="rate">{fmtPct(sponsoredRate)}</div>
          <div className="meta">{fmtInt(sponsored.n)} posts</div>
        </div>
        {lift !== null && (
          <p className="lift-note">
            Sponsored is{" "}
            <strong>
              {lift >= 0 ? "+" : ""}
              {(lift * 100).toFixed(1)}%
            </strong>{" "}
            vs. organic on weighted engagement rate, within the current
            filters (directional -- see STRATEGY.md for the vetted,
            segment-controlled comparison).
          </p>
        )}
      </div>
      <div className="chart-wrap small">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0f4" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)}%`, "Weighted ER"]}
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
            />
            <Bar dataKey="ratePct" radius={[0, 6, 6, 0]} maxBarSize={36}>
              <Cell fill="#0ea5a3" />
              <Cell fill="#f59e0b" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
