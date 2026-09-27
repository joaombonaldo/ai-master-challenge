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
import { dataTier } from "@/lib/aggregate-utils";
import DataConfidenceDot, {
  INSUFFICIENT_DATA_MESSAGE,
} from "./DataConfidenceDot";

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
  medianGroupLift,
  groupCount,
  minGroupN,
}: {
  organic: CompareSide;
  sponsored: CompareSide;
  medianGroupLift: number | null;
  groupCount: number;
  minGroupN: number;
}) {
  const organicRate = organic.weightedEngagementRate;
  const sponsoredRate = sponsored.weightedEngagementRate;

  const data = [
    { name: "Organic", ratePct: organicRate ? organicRate * 100 : 0 },
    { name: "Sponsored", ratePct: sponsoredRate ? sponsoredRate * 100 : 0 },
  ];

  // Headline lift is the MEDIAN across matched platform x category x tier
  // groups (a fair, apples-to-apples comparison), not the pooled rates
  // shown in the cards below (which can mix group composition between the
  // organic and sponsored sides).
  const lift = medianGroupLift !== null ? medianGroupLift - 1 : null;

  // Gold highlights only the standout side (the one with the higher rate),
  // per the "one reserved accent" rule -- not a fixed organic/sponsored
  // color pairing.
  const organicIsWinner =
    organicRate !== null && sponsoredRate !== null && organicRate >= sponsoredRate;
  const sponsoredIsWinner =
    organicRate !== null && sponsoredRate !== null && sponsoredRate > organicRate;

  const organicTier = dataTier(organic.n);
  const sponsoredTier = dataTier(sponsored.n);
  const liftTier = medianGroupLift !== null ? dataTier(minGroupN) : "insufficient";

  return (
    <div className="compare-grid">
      <div className="compare-cards">
        <div className={`compare-card ${organicIsWinner ? "winner" : ""}`}>
          <span className="tag">
            <span className="dot" />
            Organic
          </span>
          {organicTier === "insufficient" ? (
            <div className="rate muted-message small">{INSUFFICIENT_DATA_MESSAGE}</div>
          ) : (
            <>
              <div className="rate">
                {fmtPct(organicRate)}
                <DataConfidenceDot n={organic.n} />
              </div>
              <div className="meta">{fmtInt(organic.n)} posts</div>
            </>
          )}
        </div>
        <div className={`compare-card ${sponsoredIsWinner ? "winner" : ""}`}>
          <span className="tag">
            <span className="dot" />
            Sponsored
          </span>
          {sponsoredTier === "insufficient" ? (
            <div className="rate muted-message small">{INSUFFICIENT_DATA_MESSAGE}</div>
          ) : (
            <>
              <div className="rate">
                {fmtPct(sponsoredRate)}
                <DataConfidenceDot n={sponsored.n} />
              </div>
              <div className="meta">{fmtInt(sponsored.n)} posts</div>
            </>
          )}
        </div>
        {lift !== null ? (
          <p className="lift-note">
            Sponsored is{" "}
            <strong>
              {lift >= 0 ? "+" : ""}
              {(lift * 100).toFixed(1)}%
            </strong>{" "}
            vs. organic
            {liftTier === "thin" && <DataConfidenceDot n={minGroupN} />}{" "}
            -- median across{" "}
            {liftTier === "full" ? `${groupCount} matched` : "matched"} platform
            x category x creator-tier groups, comparing only similar
            segments to each other. Not the raw pooled cards above, which
            can mix group composition between organic and sponsored.
          </p>
        ) : (
          <p className="lift-note">{INSUFFICIENT_DATA_MESSAGE}</p>
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
