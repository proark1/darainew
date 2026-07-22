// Shared renderer for the numbered "list meetings" reply, so the deterministic
// /listmeetings slash command (telegram-router) and the manage_event list tool
// (chat) produce byte-identical output — and the numbering the user sees matches
// the index used to edit a meeting by its number.

const DEFAULT_TIMEZONE = "Europe/Berlin";

export interface MeetingRow {
  start_time: string;
  title: string;
  location?: string | null;
}

// Clamp a requested meeting count to the supported range (default 5, max 20).
export function clampMeetingLimit(n: unknown): number {
  return Math.max(1, Math.min(20, Number(n) || 5));
}

function fmtWhen(iso: string, tz: string): string {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  };
  try {
    return dt.toLocaleString("en-GB", opts);
  } catch {
    // Invalid timezone string — fall back to the server clock rather than throw.
    return dt.toLocaleString("en-GB", { ...opts, timeZone: undefined });
  }
}

export function formatMeetingList(rows: MeetingRow[], tz: string = DEFAULT_TIMEZONE): string {
  if (!rows || rows.length === 0) return "📭 No upcoming meetings.";
  const lines = rows.map((e, i) => {
    const when = fmtWhen(e.start_time, tz);
    return `${i + 1}. ${when} — ${e.title}${e.location ? ` @ ${e.location}` : ""}`;
  });
  return (
    `📅 Your next ${rows.length} meeting${rows.length === 1 ? "" : "s"}:\n${lines.join("\n")}` +
    `\n\nEdit one by its number — e.g. "3 16:00" or "3 title Dentist".`
  );
}
