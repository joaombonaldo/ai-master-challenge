"use client";

/**
 * Small inline "?" icon with a native hover/focus tooltip (title attribute).
 * Used to fold one short, essential explanation next to a label instead of
 * a separate methodology panel -- e.g. what "lift" means, or how a rate is
 * calculated. Keep the text to a single plain-language sentence.
 */
export default function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" title={text} aria-label={text} tabIndex={0}>
      <span className="help-tip-mark">?</span>
    </span>
  );
}
