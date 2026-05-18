export function formatRelativeTime(value: string | null) {
  if (!value) {
    return "Never";
  }

  const then = new Date(value).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function isSyncStale(value: string | null) {
  if (!value) {
    return true;
  }

  return Date.now() - new Date(value).getTime() > 24 * 60 * 60 * 1000;
}
