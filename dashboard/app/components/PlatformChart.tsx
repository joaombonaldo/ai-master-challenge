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

// Kept for the table's small platform-identity swatches (a neutral dot next
// to each name), NOT used for chart bars -- the chart itself stays
// monochromatic gray with a single gold highlight on the top performer, per
// the "one reserved accent" rule.
export const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#b08a4a",
  TikTok: "#8b8b92",
  YouTube: "#8b8b92",
  Bilibili: "#8b8b92",
  RedNote: "#8b8b92",
};

const FALLBACK_COLOR = "#8b8b92";
const BASE_COLOR = "#6b6c76";
const HIGHLIGHT_COLOR = "#cda45e";

export function platformColor(platform: string): string {
  return PLATFORM_COLORS[platform] ?? FALLBACK_COLOR;
}

interface PlatformChartRow {
  platform: string;
  weightedEngagementRate: number | null;
}

export default function PlatformChart({ rows }: { rows: PlatformChartRow[] }) {
  const data = rows.map((r) => ({
    platform: r.platform,
    ratePct: r.weightedEngagementRate ? r.weightedEngagementRate * 100 : 0,
  }));

  if (data.length === 0) {
    return <div className="empty-state">No data for the current filters.</div>;
  }

  const maxRate = Math.max(...data.map((d) => d.ratePct));

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="platform"
            tick={{ fontSize: 12, fill: "#9d9da3" }}
            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6c6c72" }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
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
          <Bar dataKey="ratePct" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d) => (
              <Cell
                key={d.platform}
                fill={d.ratePct === maxRate && maxRate > 0 ? HIGHLIGHT_COLOR : BASE_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
