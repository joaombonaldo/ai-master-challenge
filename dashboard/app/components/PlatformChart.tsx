"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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

// One metric selector drives this chart instead of always showing the
// blended weighted engagement rate -- views/likes/shares/comments answer
// different business questions (reach vs. casual approval vs. virality
// vs. conversation depth) even when the blended rate looks flat across
// platforms. See lib/aggregate-utils.ts for the underlying arithmetic.
export type PlatformChartMetric = "blended" | "like" | "share" | "comment";

export const PLATFORM_CHART_METRICS: Array<{ value: PlatformChartMetric; label: string; tooltipLabel: string }> = [
  { value: "blended", label: "Engajamento", tooltipLabel: "TE ponderada" },
  { value: "like", label: "Curtidas", tooltipLabel: "Taxa de curtidas" },
  { value: "share", label: "Compart.", tooltipLabel: "Taxa de compartilhamentos" },
  { value: "comment", label: "Comentários", tooltipLabel: "Taxa de comentários" },
];

interface PlatformChartRow {
  platform: string;
  weightedEngagementRate: number | null;
  likeRate: number | null;
  shareRate: number | null;
  commentRate: number | null;
}

function pickRate(row: PlatformChartRow, metric: PlatformChartMetric): number | null {
  switch (metric) {
    case "like":
      return row.likeRate;
    case "share":
      return row.shareRate;
    case "comment":
      return row.commentRate;
    default:
      return row.weightedEngagementRate;
  }
}

export default function PlatformChart({
  rows,
  metric = "blended",
}: {
  rows: PlatformChartRow[];
  metric?: PlatformChartMetric;
}) {
  const c = PALETTE;
  const tooltipLabel =
    PLATFORM_CHART_METRICS.find((m) => m.value === metric)?.tooltipLabel ?? "TE ponderada";

  const data = rows.map((r) => {
    const rate = pickRate(r, metric);
    return {
      platform: r.platform,
      ratePct: rate ? rate * 100 : 0,
    };
  });

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
        <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
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
            formatter={(value: number) => [`${value.toFixed(2)}%`, tooltipLabel]}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${c.tooltipBorder}`,
              background: c.tooltipBg,
              color: c.tooltipText,
              fontSize: 12,
            }}
            labelStyle={{ color: c.tooltipText }}
          />
          <Bar dataKey="ratePct" radius={[4, 4, 0, 0]} maxBarSize={48} fill={c.base}>
            {/* Value printed directly on each bar so the number the user is
                looking at always matches the metric just selected -- before
                this, only bar height changed on toggle and the actual value
                was hidden behind a hover tooltip, which read as "nothing
                happened" to a non-technical user. */}
            <LabelList
              dataKey="ratePct"
              position="top"
              formatter={(value: number) => `${value.toFixed(2)}%`}
              style={{ fill: c.tickStrong, fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
