// Relative timestamps for notification feeds. Absolute dates ("2026-07-31")
// force the reader to do arithmetic; "5m ago" is what they actually want to
// know when triaging a list of alerts.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function timeAgo(iso) {
  if (!iso) return "";

  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const diff = Date.now() - then.getTime();

  // Clock skew between client and server can push a fresh row into the
  // future. Showing "in 3 minutes" for a just-created alert looks broken.
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;

  // Past a week, a real date is more useful than "37d ago".
  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: then.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

// Full timestamp for the title attribute, so hovering gives the exact time.
export function fullTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}
