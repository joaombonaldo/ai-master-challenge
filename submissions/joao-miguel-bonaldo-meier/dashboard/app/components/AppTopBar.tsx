import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";

/**
 * Sticky app chrome: product identity + live status. This is what separates
 * the app from "a rendered CSV" -- a persistent top bar that stays in place
 * while the content below is filtered, independent of which section
 * (Overview today, Sponsorship / Recommendations later) is showing.
 */
export default function AppTopBar({
  generatedAt,
}: {
  generatedAt: string;
}) {
  const generatedDate = generatedAt.slice(0, 10);
  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        backdropFilter: "saturate(180%) blur(8px)",
      }}
    >
      <Toolbar sx={{ maxWidth: 1180, width: "100%", mx: "auto", px: "24px !important" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "9px", flexGrow: 1 }}>
          <Box
            aria-hidden="true"
            sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: "primary.main" }}
          />
          <Typography
            component="span"
            sx={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: "1.05rem", letterSpacing: "-0.01em", color: "text.primary" }}
          >
            Pulse<Box component="span" sx={{ color: "primary.main" }}>Board</Box>
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Chip
            size="small"
            variant="outlined"
            label={`Ao vivo · dados de ${generatedDate}`}
            icon={
              <Box
                aria-hidden="true"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: "#3bb273",
                  boxShadow: "0 0 0 3px rgba(59, 178, 115, 0.18)",
                  ml: "10px !important",
                }}
              />
            }
            sx={{
              fontSize: "0.72rem",
              fontWeight: 500,
              color: "text.secondary",
              bgcolor: "custom.surfaceMuted",
              borderColor: "divider",
            }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
