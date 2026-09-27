import aggregatesData from "@/public/data/aggregates.json";
import type { AggregatesFile } from "@/lib/types";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import DashboardClient from "./dashboard-client";
import AppTopBar from "./components/AppTopBar";

// The JSON is imported at build time (server-side / bundled), never fetched
// as a separate raw-CSV network request. It already contains only
// pre-computed summaries (platform x category x creator_tier x sponsored x
// month) -- see dashboard/scripts/build_aggregates.py. No per-post row ever
// appears here.
const aggregates = aggregatesData as unknown as AggregatesFile;

export default function Page() {
  return (
    <>
      <AppTopBar generatedAt={aggregates.generated_at} />
      <Container component="main" maxWidth={false} sx={{ maxWidth: 1180, py: "36px", pb: "96px" }}>
        <Box
          component="header"
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "24px",
            mb: "40px",
            pb: "24px",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box>
            <Typography
              component="h1"
              sx={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: "2rem", letterSpacing: "-0.01em", m: "0 0 8px", color: "text.primary" }}
            >
              Engagement across platforms
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.88rem", maxWidth: 620, lineHeight: 1.6 }}>
              See what&apos;s driving engagement across Instagram, TikTok,
              YouTube, Bilibili and RedNote. Filter by platform, category,
              creator tier, sponsorship and month to explore.
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0, pl: "24px", borderLeft: 1, borderColor: "divider" }}>
            <Typography sx={{ fontFamily: "var(--font-serif)", fontSize: "1.9rem", fontWeight: 600, color: "text.primary", lineHeight: 1 }}>
              {aggregates.row_count_source.toLocaleString()}
            </Typography>
            <Typography sx={{ fontSize: "0.68rem", color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.06em", mt: "6px" }}>
              Posts analyzed
            </Typography>
          </Box>
        </Box>
        <DashboardClient aggregates={aggregates} />
      </Container>
    </>
  );
}
