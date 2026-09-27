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

  // Headline lift is the MEDIAN across matched platform x category x tier
  // groups (a fair, apples-to-apples comparison), not the pooled rates
  // shown in the cards below (which can mix group composition between the
  // organic and sponsored sides).
  const lift = medianGroupLift !== null ? medianGroupLift - 1 : null;
  // A lift that rounds to 0.0% either way isn't an informative number --
  // per leader feedback, don't show a "+0.0%" that reads as a real result.
  const liftDisplay = lift !== null && Math.abs(lift * 100) >= 0.05 ? lift : null;

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
        {liftDisplay !== null ? (
          <Typography
            sx={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", fontWeight: 600, color: "custom.goldStrong", mt: "6px" }}
          >
            {liftDisplay >= 0 ? "+" : ""}
            {(liftDisplay * 100).toFixed(1)}%
            {liftTier === "thin" && <DataConfidenceDot n={minGroupN} />}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: "1.1rem", fontWeight: 600, color: "text.disabled", mt: "6px" }}>
            -
          </Typography>
        )}
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
