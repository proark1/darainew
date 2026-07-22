// Timezone-aware helpers for editing existing calendar events.
//
// Used when the user changes only the clock time of a meeting ("change meeting 3
// to 16:00"): the calendar date must stay put and only the time moves, evaluated
// in the user's timezone rather than the Deno server's UTC.

const DEFAULT_TIMEZONE = "Europe/Berlin";

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

// Parse a spoken/typed clock time: "16:00", "16.00", "16 00", "16", "9:30",
// "16 Uhr", "16h". Returns {hour, minute} or null.
export function parseClockTime(value: string): { hour: number; minute: number } | null {
  const m = String(value)
    .trim()
    .match(/^([01]?\d|2[0-3])(?:\s*[:.\s]\s*([0-5]\d))?\s*(?:uhr|h)?$/i);
  if (!m) return null;
  return { hour: Number(m[1]), minute: m[2] ? Number(m[2]) : 0 };
}

// Move an event to a new wall-clock time on the SAME calendar date (as seen in
// `timeZone`), returning a UTC ISO string. DST-safe: the offset is re-checked
// against the resolved instant so a spring-forward/fall-back boundary is handled.
export function applyTimeToIso(
  iso: string,
  hhmm: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string | null {
  const base = new Date(iso);
  if (isNaN(base.getTime())) return null;
  const t = parseClockTime(hhmm);
  if (!t) return null;

  const d = zonedParts(base, timeZone); // the event's calendar date in `timeZone`
  const wallClockUtc = Date.UTC(d.year, d.month - 1, d.day, t.hour, t.minute, 0);
  let offset = offsetMs(new Date(wallClockUtc), timeZone);
  let instant = new Date(wallClockUtc - offset);
  const corrected = offsetMs(instant, timeZone);
  if (corrected !== offset) {
    offset = corrected;
    instant = new Date(wallClockUtc - offset);
  }
  return instant.toISOString();
}
