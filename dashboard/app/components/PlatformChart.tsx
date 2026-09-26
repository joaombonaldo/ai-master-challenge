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

export const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#e1306c",
  TikTok: "#111827",
  YouTube: "#ef4444",
  Bilibili: "#00a1d6",
  RedNote: "#ff2442",
};

const FALLBACK_COLOR = "#4f46e5";

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

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
          <XAxis
            dataKey="platform"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(2)}%`, "Weighted ER"]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 12,
            }}
          />
          <Bar dataKey="ratePct" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((d) => (
              <Cell key={d.platform} fill={platformColor(d.platform)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
