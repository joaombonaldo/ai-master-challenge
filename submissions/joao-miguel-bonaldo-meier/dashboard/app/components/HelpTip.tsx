"use client";

import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";

/**
 * Small inline "?" icon with a hover/focus tooltip (MUI Tooltip). Used to
 * fold one short, essential explanation next to a label instead of a
 * separate methodology panel -- e.g. what "lift" means, or how a rate is
 * calculated. Keep the text to a single plain-language sentence.
 */
export default function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip title={text} enterTouchDelay={0}>
      <Box
        component="span"
        tabIndex={0}
        aria-label={text}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          verticalAlign: "middle",
          ml: "6px",
          width: 15,
          height: 15,
          borderRadius: "50%",
          border: 1,
          borderColor: "divider",
          cursor: "help",
          fontSize: "0.65rem",
          fontWeight: 600,
          color: "text.disabled",
          lineHeight: 1,
        }}
      >
        ?
      </Box>
    </Tooltip>
  );
}
