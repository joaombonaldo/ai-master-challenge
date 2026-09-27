import ThemeToggle from "./ThemeToggle";

/**
 * Sticky app chrome: product identity + live status + theme toggle. This is
 * what separates the app from "a rendered CSV" -- a persistent top bar that
 * stays in place while the content below is filtered, independent of which
 * section (Overview today, Sponsorship / Recommendations later) is showing.
 */
export default function AppTopBar({
  generatedAt,
}: {
  generatedAt: string;
}) {
  const generatedDate = generatedAt.slice(0, 10);
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="wordmark">
          <span className="wordmark-mark" aria-hidden="true" />
          <span className="wordmark-text">
            Pulse<span className="wordmark-accent">Board</span>
          </span>
        </div>
        <div className="topbar-right">
          <span className="status-pill">
            <span className="status-dot" aria-hidden="true" />
            Live &middot; data as of {generatedDate}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
