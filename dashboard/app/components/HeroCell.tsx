import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

/**
 * One cell of the headline KPI row (hero-grid). `lead` marks the single
 * most important number per view -- gets the reserved gold background/text,
 * per the "one accent used sparingly" rule carried over from the previous
 * CSS design system.
 */
export default function HeroCell({
  label,
  value,
  sub,
  lead = false,
  muted = false,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  lead?: boolean;
  muted?: boolean;
}) {
  return (
    <Box
      sx={{
        bgcolor: lead ? "custom.goldSoft" : "background.paper",
        p: "22px 16px",
        minWidth: 0,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Typography
        component="div"
        sx={{
          fontSize: "0.68rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
          color: lead ? "custom.goldStrong" : "text.disabled",
        }}
      >
        {label}
      </Typography>
      <Typography
        component="div"
        sx={{
          fontFamily: muted ? undefined : "var(--font-serif)",
          fontSize: muted ? "0.85rem" : "2rem",
          fontWeight: muted ? 500 : 600,
          mt: muted ? "6px" : "10px",
          color: lead ? "custom.goldStrong" : muted ? "text.secondary" : "text.primary",
          letterSpacing: muted ? "normal" : "-0.01em",
          lineHeight: muted ? 1.4 : 1,
          fontVariantNumeric: "tabular-nums",
          width: "100%",
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography component="div" sx={{ fontSize: "0.74rem", color: "text.disabled", mt: "8px" }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}
