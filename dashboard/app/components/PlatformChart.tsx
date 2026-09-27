"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Box from "@mui/material/Box";

// Neutral swatch for the table's small platform-identity dots -- every
// platform gets the same neutral gray so no bar/dot reads as arbitrarily
// more "important" than another. Deliberate exception to the "gold on
// standout" rule used elsewhere in the app: this breakdown-by-platform
// chart and table use a single flat grey for every platform, no highlight
// color at all, per leader feedback.
// Matches PALETTE.base below exactly -- previously this was a separate
// hardcoded hex (#8b8b92) that didn't match the chart bars' gray
// (#6b6c76), so the small identity dot in the breakdown table looked like
// a third, unexplained color next to the chart. Single source of truth now.
const NEUTRAL_SWATCH = "#6b6c76";

export function platformColor(_platform: string): string {
  return NEUTRAL_SWATCH;
}

// Literal light-mode chart palette (Recharts renders raw SVG attributes,
// which can't consume MUI's theme tokens directly). Same values as
// theme.ts's light scheme -- app is light-only, no dark-mode branching.
// No `highlight` entry here on purpose -- this chart never uses the gold
// accent (see NEUTRAL_SWATCH note above).
const PALETTE = {
  base: "#6b6c76",
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
        Nenhum dado para os filtros atuais.
      </Box>
    );
  }

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
            formatter={(value: number) => [`${value.toFixed(2)}%`, "TE ponderada"]}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${c.tooltipBorder}`,
              background: c.tooltipBg,
              color: c.tooltipText,
              fontSize: 12,
            }}
            labelStyle={{ color: c.tooltipText }}
          />
          <Bar dataKey="ratePct" radius={[4, 4, 0, 0]} maxBarSize={48} fill={c.base} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
