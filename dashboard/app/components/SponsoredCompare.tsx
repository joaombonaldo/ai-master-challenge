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
  groupCount,
  minGroupN,
}: {
  organic: CompareSide;
  sponsored: CompareSide;
  medianGroupLift: number | null;
  groupCount: number;
  minGroupN: number;
}) {
  const c = PALETTE;

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
              bgcolor: winner ? "primary.main" : "custom.seriesB",
            }}
          />
          {tag}
        </Typography>
        {tier === "insufficient" ? (
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 500, color: "text.secondary", mt: "8px" }}>
            {INSUFFICIENT_DATA_MESSAGE}
          </Typography>
        ) : (
          <>
            <Typography
              sx={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 600, mt: "8px", color: "text.primary" }}
            >
              {fmtPct(rate)}
              <DataConfidenceDot n={n} />
            </Typography>
            <Typography sx={{ fontSize: "0.76rem", color: "text.disabled", mt: "2px" }}>
              {fmtInt(n)} posts
            </Typography>
          </>
        )}
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
        <Card tag="Organic" tier={organicTier} rate={organicRate} n={organic.n} winner={organicIsWinner} />
        <Card tag="Sponsored" tier={sponsoredTier} rate={sponsoredRate} n={sponsored.n} winner={sponsoredIsWinner} />
        {lift !== null ? (
          <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mt: "6px", lineHeight: 1.6 }}>
            Sponsored is{" "}
            <Box component="strong" sx={{ color: "custom.goldStrong", fontWeight: 600 }}>
              {lift >= 0 ? "+" : ""}
              {(lift * 100).toFixed(1)}%
            </Box>{" "}
            vs. organic
            {liftTier === "thin" && <DataConfidenceDot n={minGroupN} />}{" "}
            -- median across{" "}
            {liftTier === "full" ? `${groupCount} matched` : "matched"} platform
            x category x creator-tier groups, comparing only similar
            segments to each other. Not the raw pooled cards above, which
            can mix group composition between organic and sponsored.
          </Typography>
        ) : (
          <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mt: "6px" }}>
            {INSUFFICIENT_DATA_MESSAGE}
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
