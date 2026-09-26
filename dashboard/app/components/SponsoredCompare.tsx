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

const BASE_COLOR = "#6b6c76";
const HIGHLIGHT_COLOR = "#cda45e";

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

  // Gold highlights only the standout side (the one with the higher rate),
  // per the "one reserved accent" rule -- not a fixed organic/sponsored
  // color pairing.
  const organicIsWinner =
    organicRate !== null && sponsoredRate !== null && organicRate >= sponsoredRate;
  const sponsoredIsWinner =
    organicRate !== null && sponsoredRate !== null && sponsoredRate > organicRate;

  return (
    <div className="compare-grid">
      <div className="compare-cards">
        <div className={`compare-card ${organicIsWinner ? "winner" : ""}`}>
          <span className="tag">
            <span className="dot" />
            Organic
          </span>
          <div className="rate">{fmtPct(organicRate)}</div>
          <div className="meta">{fmtInt(organic.n)} posts</div>
        </div>
        <div className={`compare-card ${sponsoredIsWinner ? "winner" : ""}`}>
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
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#6c6c72" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: "#9d9da3" }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)}%`, "Weighted ER"]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#16161a",
                color: "#f2f1ec",
                fontSize: 12,
              }}
              labelStyle={{ color: "#f2f1ec" }}
            />
            <Bar dataKey="ratePct" radius={[0, 4, 4, 0]} maxBarSize={36}>
              <Cell fill={organicIsWinner ? HIGHLIGHT_COLOR : BASE_COLOR} />
              <Cell fill={sponsoredIsWinner ? HIGHLIGHT_COLOR : BASE_COLOR} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
