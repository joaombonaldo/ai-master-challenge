"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "dashboard-theme";
type Theme = "light" | "dark";

/**
 * Manual light/dark switch, independent of OS prefers-color-scheme. Default
 * is light (set by the CSS baseline + the absence of data-theme="dark").
 * The choice is persisted in localStorage and re-applied on load by a tiny
 * blocking script in layout.tsx (avoids a flash of the wrong theme).
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  // Sync local state with whatever the blocking init script already applied
  // to <html data-theme="...">, so the switch reflects reality after mount.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function handleToggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode, etc.) -- theme still works
      // for this session, it just won't persist across reloads.
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleToggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-icon sun" aria-hidden="true">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4.5" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v2.5" />
              <path d="M12 19.5V22" />
              <path d="M4.2 4.2l1.8 1.8" />
              <path d="M18 18l1.8 1.8" />
              <path d="M2 12h2.5" />
              <path d="M19.5 12H22" />
              <path d="M4.2 19.8l1.8-1.8" />
              <path d="M18 6l1.8-1.8" />
            </g>
          </svg>
        </span>
        <span className="theme-toggle-icon moon" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}
