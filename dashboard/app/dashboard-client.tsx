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
import LlmReportSection from "./components/LlmReportSection";
import { buildRecommendations } from "@/lib/recommendations";
import { buildExecutiveSummaryPayload } from "@/lib/summary";
import { buildLlmRecommendationsPayload } from "@/lib/llm-recommendations";

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

function Panel({ children, dense }: { children: React.ReactNode; dense?: boolean }) {
  return (
    <Card
      variant="outlined"
      sx={
        dense
          ? { p: "12px 20px", mb: "16px", borderRadius: "12px" }
          : { p: "24px 28px", mb: "24px", borderRadius: "14px" }
      }
    >
      {children}
    </Card>
  );
}

function PanelHeader({
  title,
  subtitle,
  action,
  dense,
}: {
  title: string;
  subtitle: React.ReactNode;
  action?: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", mb: dense ? "10px" : "20px" }}>
      <Box>
        <Typography component="h2" sx={{ fontFamily: "var(--font-serif)", fontSize: dense ? "0.9rem" : "1.15rem", fontWeight: 600, color: "text.primary", m: 0 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", mt: "2px" }}>{subtitle}</Typography>
      </Box>
      {action}
    </Box>
  );
}

const FILTER_LABEL_SX = {
  display: "block",
  fontSize: "0.62rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "text.disabled",
  mb: "4px",
};

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
    <Box sx={{ flexShrink: 0 }}>
      <Typography component="label" sx={FILTER_LABEL_SX}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "nowrap", gap: "4px" }}>
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
                height: "22px",
                fontSize: "0.72rem",
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

  const months = aggregates.legend.month;
  // Most recent month first, per leader feedback -- these lists are for
  // picking a range endpoint, and people scan for "recent" before "oldest".
  const monthsDesc = useMemo(() => [...months].reverse(), [months]);

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

  const llmRecommendationsPayload = useMemo(
    () => buildLlmRecommendationsPayload(aggregates, filters),
    [aggregates, filters]
  );

  // Month-range setters: auto-correct the other endpoint so "from" can
  // never end up after "to". Both dropdowns always render the identical
  // full month list (same order, most-recent-first) -- no options are
  // disabled or hidden per leader feedback; an invalid combination is
  // prevented only by bumping the other endpoint to match.
  function setMonthFrom(value: string | null) {
    setFilters((f) => ({
      ...f,
      monthFrom: value,
      monthTo: value && f.monthTo && f.monthTo < value ? value : f.monthTo,
    }));
  }
  function setMonthTo(value: string | null) {
    setFilters((f) => ({
      ...f,
      monthTo: value,
      monthFrom: value && f.monthFrom && f.monthFrom > value ? value : f.monthFrom,
    }));
  }

  const activeFilterCount =
    filters.platforms.length +
    filters.categories.length +
    filters.tiers.length +
    (filters.sponsored !== "all" ? 1 : 0) +
    (filters.monthFrom ? 1 : 0) +
    (filters.monthTo ? 1 : 0);

  return (
    <>
      {/* ---------- Filters: one dense utility strip, filters row + status/reset row below ---------- */}
      <Panel dense>
        <Box sx={{ display: "flex", flexWrap: "nowrap", alignItems: "flex-end", gap: "28px", overflowX: "auto", pb: "2px" }}>
          <FilterChips
            label="Plataforma"
            options={aggregates.legend.platform}
            selected={filters.platforms}
            onToggle={(p) => setFilters((f) => ({ ...f, platforms: toggle(f.platforms, p) }))}
          />
          <FilterChips
            label="Categoria"
            options={aggregates.legend.category}
            selected={filters.categories}
            onToggle={(c) => setFilters((f) => ({ ...f, categories: toggle(f.categories, c) }))}
          />
          <FilterChips
            label="Tier de criador"
            options={aggregates.legend.creator_tier}
            selected={filters.tiers}
            onToggle={(t) => setFilters((f) => ({ ...f, tiers: toggle(f.tiers, t) }))}
          />
          <Box sx={{ flexShrink: 0 }}>
            <Typography component="label" sx={FILTER_LABEL_SX}>
              Patrocínio
            </Typography>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value={filters.sponsored}
                sx={{ height: "30px", fontSize: "0.78rem" }}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    sponsored: e.target.value as Filters["sponsored"],
                  }))
                }
              >
                <MenuItem value="all">Todos os posts</MenuItem>
                <MenuItem value="sponsored">Somente patrocinados</MenuItem>
                <MenuItem value="organic">Somente orgânicos</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "nowrap", gap: "8px", flexShrink: 0 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="label" sx={FILTER_LABEL_SX}>
                Mês inicial
              </Typography>
              <FormControl size="small" sx={{ minWidth: 92, width: 92 }}>
                <Select
                  value={filters.monthFrom ?? ""}
                  sx={{ height: "30px", fontSize: "0.78rem" }}
                  onChange={(e) => setMonthFrom(e.target.value || null)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {monthsDesc.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="label" sx={FILTER_LABEL_SX}>
                Mês final
              </Typography>
              <FormControl size="small" sx={{ minWidth: 92, width: 92 }}>
                <Select
                  value={filters.monthTo ?? ""}
                  sx={{ height: "30px", fontSize: "0.78rem" }}
                  onChange={(e) => setMonthTo(e.target.value || null)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {monthsDesc.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: "14px", mt: "12px" }}>
          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", whiteSpace: "nowrap" }}>
            {activeFilterCount > 0
              ? `${activeFilterCount} filtro${activeFilterCount === 1 ? "" : "s"} ativo${activeFilterCount === 1 ? "" : "s"}`
              : "Mostrando todos os dados"}
          </Typography>
          <Button variant="outlined" size="small" sx={{ height: "30px" }} onClick={() => setFilters(DEFAULT_FILTERS)}>
            Limpar
          </Button>
        </Box>
      </Panel>

      {/* ---------- Section: unified LLM report (executive summary + recommendations), one button, one section ---------- */}
      <Panel>
        <LlmReportSection
          summaryPayload={summaryPayload}
          recommendationsPayload={llmRecommendationsPayload}
          resetKey={JSON.stringify(filters)}
        />
      </Panel>

      {/* ---------- Headline KPIs: the 4 numbers that matter most, up top ---------- */}
      <Panel>
        <PanelHeader
          title="Resultado"
          subtitle={`${result.n.toLocaleString()} posts correspondem aos filtros atuais`}
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
          <HeroCell label="Total de visualizações" value={fmtInt(result.sumViews)} />
          <HeroCell
            lead
            label={
              <>
                Taxa de engajamento ponderada
                <HelpTip text="Curtidas + compartilhamentos + comentários, divididos pelas visualizações, combinados entre todos os posts correspondentes, então posts maiores contam mais." />
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
                <HeroCell label="Patrocinado vs. orgânico (justo)" value={INSUFFICIENT_DATA_MESSAGE} muted />
              );
            }
            return (
              <HeroCell
                label="Patrocinado vs. orgânico (justo)"
                value={
                  <>
                    {`${medianGroupLift >= 1 ? "+" : ""}${((medianGroupLift - 1) * 100).toFixed(1)}%`}
                    <DataConfidenceDot n={sponsoredCompare.minGroupN} />
                  </>
                }
                sub="mediana entre grupos pareados de plataforma x categoria x tier"
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
            ["Total de curtidas", fmtInt(result.sumLikes)],
            ["Total de compartilhamentos", fmtInt(result.sumShares)],
            ["Total de comentários", fmtInt(result.sumComments)],
            ["Média de visualizações / post", fmtInt(result.avgViewsPerPost)],
            ["Média de seguidores (criador)", fmtInt(result.avgFollowers)],
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

      {/* ---------- Section 1: platform breakdown -- always visible, no tab gate ---------- */}
      <Panel>
        <PanelHeader
          title="Detalhamento por plataforma"
          subtitle="Como a taxa de engajamento se compara entre plataformas agora"
        />
        <PlatformChart rows={byPlatform} />
        <Divider sx={{ my: "20px" }} />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Plataforma</TableCell>
                <TableCell sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Posts</TableCell>
                <TableCell sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Visualizações</TableCell>
                <TableCell sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>TE ponderada</TableCell>
                <TableCell sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Média visual./post</TableCell>
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
      </Panel>

      {/* ---------- Section 2: sponsored vs. organic -- always visible, no tab gate ---------- */}
      <Panel>
        <PanelHeader title="Patrocinado vs. orgânico" subtitle="Comparação justa, pareada por plataforma x categoria x tier de criador" />
        <SponsoredCompare
          organic={organicResult}
          sponsored={sponsoredResult}
          medianGroupLift={medianGroupLift}
          minGroupN={sponsoredCompare.minGroupN}
        />
      </Panel>
    </>
  );
}
