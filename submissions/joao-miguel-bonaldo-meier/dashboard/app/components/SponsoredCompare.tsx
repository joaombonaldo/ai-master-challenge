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
import Typography from "@mui/material/Typography";
import { dataTier } from "@/lib/aggregate-utils";
import DataConfidenceDot from "./DataConfidenceDot";

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

// Literal light-mode chart palette (Recharts renders raw SVG attributes,
// which can't consume MUI's theme tokens directly). Same values as
// theme.ts's light scheme -- app is light-only, no dark-mode branching.
const PALETTE = {
  base: "#6b6c76",
  highlight: "#8a6522",
  grid: "rgba(17,17,20,0.08)",
  tick: "#5c5c64",
  tooltipBg: "#ffffff",
  tooltipText: "#17171a",
  tooltipBorder: "rgba(17,17,20,0.16)",
};

export default function SponsoredCompare({
  organic,
  sponsored,
  medianGroupLift,
  minGroupN,
}: {
  organic: CompareSide;
  sponsored: CompareSide;
  // The fair, group-matched statistic (median of per-group sponsored/organic
  // ratios, computed by aggregateSponsoredCompareControlled) -- same number
  // used by the hero "Patrocinado vs. orgânico (justo)" KPI and by the LLM
  // recommendations. This drives the winner-highlight decision below so the
  // highlight is consistent with the panel's "fair, matched" framing. The
  // raw organic/sponsored rates passed in above are still used to DISPLAY
  // the two pooled numbers -- only the highlight decision reads this prop.
  medianGroupLift: number | null;
  minGroupN: number;
}) {
  const c = PALETTE;

  const organicRate = organic.weightedEngagementRate;
  const sponsoredRate = sponsored.weightedEngagementRate;

  const data = [
    { name: "Orgânico", ratePct: organicRate ? organicRate * 100 : 0 },
    { name: "Patrocinado", ratePct: sponsoredRate ? sponsoredRate * 100 : 0 },
  ];

  // Gold highlights only the standout side, driven by the FAIR, matched-group
  // statistic (medianGroupLift), not by the pooled rate diff -- matching the
  // panel's own "Comparação justa, pareada por plataforma x categoria x tier"
  // claim. medianGroupLift is a ratio (1.03 = sponsored 3% above organic), so
  // it's converted to a percentage-point-equivalent and checked against the
  // same 3-point materiality floor used for the LLM recommendations (see
  // MATERIALITY_FLOOR_PP in app/api/recommendations/route.ts).
  const MATERIALITY_FLOOR_PP = 3;
  const liftDiffPct =
    medianGroupLift !== null ? Math.abs(medianGroupLift - 1) * 100 : 0;
  // Same confidence-tier gating as the hero KPI for this exact statistic
  // (dashboard-client.tsx, "Patrocinado vs. orgânico (justo)"): insufficient
  // tier means no winner is ever shown, regardless of the raw pooled gap.
  const groupTier = medianGroupLift === null ? "insufficient" : dataTier(minGroupN);
  const hasMaterialDifference =
    groupTier !== "insufficient" && liftDiffPct >= MATERIALITY_FLOOR_PP;
  const organicIsWinner = hasMaterialDifference && medianGroupLift! < 1;
  const sponsoredIsWinner = hasMaterialDifference && medianGroupLift! > 1;

  const organicTier = dataTier(organic.n);
  const sponsoredTier = dataTier(sponsored.n);

  function Card({
    tag,
    tier,
    rate,
    n,
    winner,
  }: {
    tag: string;
    tier: string;
    rate: number | null;
    n: number;
    winner: boolean;
  }) {
    return (
      <Box
        sx={{
          borderRadius: "10px",
          p: "14px 16px",
          border: 1,
          borderColor: winner ? "custom.goldBorder" : "divider",
          bgcolor: winner ? "custom.goldSoft" : "transparent",
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: "0.76rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: winner ? "custom.goldStrong" : "text.secondary",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Box
            component="span"
            sx={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: "50%",
              mr: "8px",
              // Same two hex values as the bar chart's PALETTE (c.highlight /
              // c.base) -- previously this used theme tokens (primary.main /
              // custom.seriesB) which are visually close but NOT identical
              // to the bar colors, so the dot and the bar next to it looked
              // like two different palettes. Root cause of the reported
              // grey/brown mismatch.
              bgcolor: winner ? c.highlight : c.base,
            }}
          />
          {tag}
        </Typography>
        {tier === "insufficient" ? (
          <Typography sx={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 600, mt: "8px", color: "text.disabled" }}>
            -
          </Typography>
        ) : (
          <Typography
            sx={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 600, mt: "8px", color: "text.primary" }}
          >
            {fmtPct(rate)}
            <DataConfidenceDot n={n} />
          </Typography>
        )}
        <Typography sx={{ fontSize: "0.76rem", color: "text.disabled", mt: "2px" }}>
          {fmtInt(n)}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "minmax(220px, 320px) 1fr" },
        gap: "32px",
        alignItems: "center",
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Card tag="Orgânico" tier={organicTier} rate={organicRate} n={organic.n} winner={organicIsWinner} />
        <Card tag="Patrocinado" tier={sponsoredTier} rate={sponsoredRate} n={sponsored.n} winner={sponsoredIsWinner} />
      </Box>
      <Box sx={{ width: "100%", height: 170 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.grid} />
            <XAxis
              type="number"
              domain={[0, "auto"]}
              tick={{ fontSize: 11, fill: c.tick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: c.tick }}
              axisLine={false}
              tickLine={false}
              width={80}
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
            <Bar dataKey="ratePct" radius={[0, 4, 4, 0]} maxBarSize={36}>
              <Cell fill={organicIsWinner ? c.highlight : c.base} />
              <Cell fill={sponsoredIsWinner ? c.highlight : c.base} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
