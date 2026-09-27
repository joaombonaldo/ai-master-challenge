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
import Box from "@mui/material/Box";

// Neutral swatch for the table's small platform-identity dots -- every
// platform gets the same neutral gray so no bar/dot reads as arbitrarily
// more "important" than another. The chart itself highlights only the
// current standout (highest value) with the reserved gold accent, computed
// per-render from the data, not hardcoded per platform.
const NEUTRAL_SWATCH = "#8b8b92";

export function platformColor(_platform: string): string {
  return NEUTRAL_SWATCH;
}

// Literal light-mode chart palette (Recharts renders raw SVG attributes,
// which can't consume MUI's theme tokens directly). Same values as
// theme.ts's light scheme -- app is light-only, no dark-mode branching.
const PALETTE = {
  base: "#6b6c76",
  highlight: "#8a6522",
  grid: "rgba(17,17,20,0.08)",
  axisLine: "rgba(17,17,20,0.16)",
  tickMuted: "#86868d",
  tickStrong: "#5c5c64",
  tooltipBg: "#ffffff",
  tooltipText: "#17171a",
  tooltipBorder: "rgba(17,17,20,0.16)",
};

interface PlatformChartRow {
  platform: string;
  weightedEngagementRate: number | null;
}

export default function PlatformChart({ rows }: { rows: PlatformChartRow[] }) {
  const c = PALETTE;

  const data = rows.map((r) => ({
    platform: r.platform,
    ratePct: r.weightedEngagementRate ? r.weightedEngagementRate * 100 : 0,
  }));

  if (data.length === 0) {
    return (
      <Box sx={{ py: "24px", textAlign: "center", color: "text.disabled", fontSize: "0.9rem" }}>
        No data for the current filters.
      </Box>
    );
  }

  const maxRate = Math.max(...data.map((d) => d.ratePct));

  return (
    <Box sx={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
          <XAxis
            dataKey="platform"
            tick={{ fontSize: 12, fill: c.tickStrong }}
            axisLine={{ stroke: c.axisLine }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: c.tickMuted }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(2)}%`, "Weighted ER"]}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${c.tooltipBorder}`,
              background: c.tooltipBg,
              color: c.tooltipText,
              fontSize: 12,
            }}
            labelStyle={{ color: c.tooltipText }}
          />
          <Bar dataKey="ratePct" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d) => (
              <Cell
                key={d.platform}
                fill={d.ratePct === maxRate && maxRate > 0 ? c.highlight : c.base}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
