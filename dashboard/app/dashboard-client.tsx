"use client";

import { useMemo, useState } from "react";
import type { AggregatesFile, Filters } from "@/lib/types";
import {
  DEFAULT_FILTERS,
  aggregate,
  aggregateByPlatform,
  aggregateSponsoredCompareControlled,
  computeLiftVsBaseline,
} from "@/lib/aggregate-utils";
import { dataTier } from "@/lib/aggregate-utils";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import PlatformChart, { platformColor } from "./components/PlatformChart";
import SponsoredCompare from "./components/SponsoredCompare";
import LiftIndicator from "./components/LiftIndicator";
import HeroCell from "./components/HeroCell";
import DataConfidenceDot, {
  INSUFFICIENT_DATA_MESSAGE,
} from "./components/DataConfidenceDot";
import HelpTip from "./components/HelpTip";
import RecommendationsPanel from "./components/RecommendationsPanel";
import ExecutiveSummary from "./components/ExecutiveSummary";
import { buildRecommendations } from "@/lib/recommendations";
import { buildExecutiveSummaryPayload } from "@/lib/summary";

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function fmtInt(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "-";
  return Math.round(n).toLocaleString();
}

function fmtPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "-";
  return `${(n * 100).toFixed(2)}%`;
}

type Tab = "platform" | "sponsored" | "recommendations";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ p: "24px 28px", mb: "24px", borderRadius: "14px" }}>
      {children}
    </Card>
  );
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", mb: "20px" }}>
      <Box>
        <Typography component="h2" sx={{ fontFamily: "var(--font-serif)", fontSize: "1.15rem", fontWeight: 600, color: "text.primary", m: 0 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mt: "3px" }}>{subtitle}</Typography>
      </Box>
      {action}
    </Box>
  );
}

function FilterChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        component="label"
        sx={{ display: "block", fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.disabled", mb: "10px" }}
      >
        {label}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <Chip
              key={opt}
              label={opt}
              size="small"
              onClick={() => onToggle(opt)}
              variant={active ? "filled" : "outlined"}
              sx={{
                fontSize: "0.78rem",
                fontWeight: 500,
                borderRadius: "999px",
                bgcolor: active ? "custom.goldSoft" : "transparent",
                borderColor: active ? "custom.goldBorder" : "custom.borderStrong",
                color: active ? "custom.goldStrong" : "text.secondary",
                "&:hover": { borderColor: "custom.goldBorder", color: active ? "custom.goldStrong" : "text.primary" },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}

export default function DashboardClient({
  aggregates,
}: {
  aggregates: AggregatesFile;
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<Tab>("platform");

  const months = aggregates.legend.month;
  const minMonth = months[0];
  const maxMonth = months[months.length - 1];

  const result = useMemo(
    () => aggregate(aggregates, filters),
    [aggregates, filters]
  );
  const byPlatform = useMemo(
    () => aggregateByPlatform(aggregates, filters),
    [aggregates, filters]
  );
  const sponsoredCompare = useMemo(
    () => aggregateSponsoredCompareControlled(aggregates, filters),
    [aggregates, filters]
  );
  const { organic: organicResult, sponsored: sponsoredResult, medianGroupLift } =
    sponsoredCompare;

  const baselineLift = useMemo(
    () => computeLiftVsBaseline(aggregates, filters),
    [aggregates, filters]
  );

  const recommendations = useMemo(
    () => buildRecommendations(aggregates, filters),
    [aggregates, filters]
  );

  const summaryPayload = useMemo(
    () => buildExecutiveSummaryPayload(filters, result, baselineLift, sponsoredCompare, recommendations),
    [filters, result, baselineLift, sponsoredCompare, recommendations]
  );

  const activeFilterCount =
    filters.platforms.length +
    filters.categories.length +
    filters.tiers.length +
    (filters.sponsored !== "all" ? 1 : 0) +
    (filters.monthFrom ? 1 : 0) +
    (filters.monthTo ? 1 : 0);

  return (
    <>
      {/* ---------- Filters: one compact strip, advanced (dates) collapsed ---------- */}
      <Panel>
        <PanelHeader
          title="Filters"
          subtitle={
            activeFilterCount > 0
              ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
              : "Showing all data"
          }
          action={
            <Button variant="outlined" size="small" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Reset filters
            </Button>
          }
        />
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "24px 32px" }}>
          <FilterChips
            label="Platform"
            options={aggregates.legend.platform}
            selected={filters.platforms}
            onToggle={(p) => setFilters((f) => ({ ...f, platforms: toggle(f.platforms, p) }))}
          />
          <FilterChips
            label="Category"
            options={aggregates.legend.category}
            selected={filters.categories}
            onToggle={(c) => setFilters((f) => ({ ...f, categories: toggle(f.categories, c) }))}
          />
          <FilterChips
            label="Creator tier"
            options={aggregates.legend.creator_tier}
            selected={filters.tiers}
            onToggle={(t) => setFilters((f) => ({ ...f, tiers: toggle(f.tiers, t) }))}
          />
          <Box>
            <Typography
              component="label"
              sx={{ display: "block", fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.disabled", mb: "10px" }}
            >
              Sponsorship
            </Typography>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <Select
                value={filters.sponsored}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    sponsored: e.target.value as Filters["sponsored"],
                  }))
                }
              >
                <MenuItem value="all">All posts</MenuItem>
                <MenuItem value="sponsored">Sponsored only</MenuItem>
                <MenuItem value="organic">Organic only</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Accordion
          disableGutters
          elevation={0}
          square
          sx={{
            mt: "20px",
            bgcolor: "transparent",
            "&::before": { display: "none" },
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} sx={{ px: 0, minHeight: 0 }}>
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "text.secondary" }}>
              Advanced: date range
              {(filters.monthFrom || filters.monthTo) ? " (active)" : ""}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "20px", maxWidth: 460 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>From month</InputLabel>
                <Select
                  label="From month"
                  value={filters.monthFrom ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, monthFrom: e.target.value || null }))}
                >
                  <MenuItem value="">{minMonth} (earliest)</MenuItem>
                  {months.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>To month</InputLabel>
                <Select
                  label="To month"
                  value={filters.monthTo ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, monthTo: e.target.value || null }))}
                >
                  <MenuItem value="">{maxMonth} (latest)</MenuItem>
                  {months.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Panel>

      {/* ---------- Headline KPIs: the 4 numbers that matter most, up top ---------- */}
      <Panel>
        <PanelHeader
          title="Result"
          subtitle={`${result.n.toLocaleString()} posts match the current filters`}
        />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" },
            gap: "1px",
            bgcolor: "divider",
            border: 1,
            borderColor: "divider",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          <HeroCell label="Posts" value={fmtInt(result.n)} />
          <HeroCell label="Total views" value={fmtInt(result.sumViews)} />
          <HeroCell
            lead
            label={
              <>
                Weighted engagement rate
                <HelpTip text="Likes + shares + comments, divided by views, combined across every matching post so bigger posts count more." />
              </>
            }
            value={fmtPct(result.weightedEngagementRate)}
          />
          <LiftIndicator result={baselineLift} />
          {(() => {
            const sponsoredVsOrganicTier =
              medianGroupLift === null ? "insufficient" : dataTier(sponsoredCompare.minGroupN);
            if (sponsoredVsOrganicTier === "insufficient" || medianGroupLift === null) {
              return (
                <HeroCell label="Sponsored vs. organic (fair)" value={INSUFFICIENT_DATA_MESSAGE} muted />
              );
            }
            return (
              <HeroCell
                label="Sponsored vs. organic (fair)"
                value={
                  <>
                    {`${medianGroupLift >= 1 ? "+" : ""}${((medianGroupLift - 1) * 100).toFixed(1)}%`}
                    <DataConfidenceDot n={sponsoredCompare.minGroupN} />
                  </>
                }
                sub="median across matched platform x category x tier groups"
              />
            );
          })()}
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" },
            gap: "12px",
            mt: "16px",
          }}
        >
          {[
            ["Total likes", fmtInt(result.sumLikes)],
            ["Total shares", fmtInt(result.sumShares)],
            ["Total comments", fmtInt(result.sumComments)],
            ["Avg views / post", fmtInt(result.avgViewsPerPost)],
            ["Avg followers (creator)", fmtInt(result.avgFollowers)],
          ].map(([label, value]) => (
            <Box key={label} sx={{ border: 1, borderColor: "divider", borderRadius: "10px", p: "12px 14px", textAlign: "center" }}>
              <Typography sx={{ fontSize: "0.68rem", color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: "1.1rem", fontWeight: 600, mt: "5px", color: "text.secondary", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Panel>

      {/* ---------- Executive summary (Phase 3d): optional LLM-assisted recap ---------- */}
      <Panel>
        <ExecutiveSummary payload={summaryPayload} key={JSON.stringify(filters)} />
      </Panel>

      {/* ---------- Secondary detail: tabs instead of stacked panels ---------- */}
      <Panel>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 0,
            mb: "20px",
            "& .MuiTabs-indicator": { display: "none" },
          }}
        >
          {(
            [
              ["platform", "Breakdown by platform"],
              ["sponsored", "Sponsored vs. organic"],
              ["recommendations", "Recommendations"],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <Tab
              key={value}
              value={value}
              label={label}
              disableRipple
              sx={{
                minHeight: 0,
                textTransform: "none",
                fontSize: "0.8rem",
                fontWeight: 500,
                borderRadius: "999px",
                minWidth: 0,
                px: "16px",
                py: "7px",
                mr: "4px",
                color: "text.secondary",
                "&.Mui-selected": {
                  color: "custom.goldStrong",
                  bgcolor: "custom.surfaceMuted",
                  border: 1,
                  borderColor: "custom.goldBorder",
                },
              }}
            />
          ))}
        </Tabs>

        {tab === "platform" && (
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mb: "16px" }}>
              How engagement rate compares across platforms right now
            </Typography>
            <PlatformChart rows={byPlatform} />
            <Divider sx={{ my: "20px" }} />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Platform</TableCell>
                    <TableCell sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Posts</TableCell>
                    <TableCell sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Views</TableCell>
                    <TableCell sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Weighted ER</TableCell>
                    <TableCell sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Avg views/post</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {byPlatform.map((row) => (
                    <TableRow key={row.platform}>
                      <TableCell sx={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "text.primary" }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: platformColor(row.platform) }} />
                        {row.platform}
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.85rem" }}>{fmtInt(row.n)}</TableCell>
                      <TableCell sx={{ fontSize: "0.85rem" }}>{fmtInt(row.sumViews)}</TableCell>
                      <TableCell sx={{ fontSize: "0.85rem" }}>{fmtPct(row.weightedEngagementRate)}</TableCell>
                      <TableCell sx={{ fontSize: "0.85rem" }}>{fmtInt(row.avgViewsPerPost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {tab === "sponsored" && (
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mb: "16px" }}>
              Weighted engagement rate, within current filters
            </Typography>
            <SponsoredCompare
              organic={organicResult}
              sponsored={sponsoredResult}
              medianGroupLift={medianGroupLift}
              groupCount={sponsoredCompare.groupCount}
              minGroupN={sponsoredCompare.minGroupN}
            />
          </Box>
        )}

        {tab === "recommendations" && (
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mb: "16px" }}>
              Rule-based comparisons for the current filter selection -- not a prediction, just
              plain arithmetic over the segments above
            </Typography>
            <RecommendationsPanel recommendations={recommendations} />
          </Box>
        )}
      </Panel>
    </>
  );
}
