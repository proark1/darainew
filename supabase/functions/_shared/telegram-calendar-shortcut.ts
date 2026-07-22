export interface TelegramCalendarShortcut {
  title: string;
  startTime: string;
  endTime: string;
}

interface ParseOptions {
  now?: Date;
  timeZone?: string;
  defaultDurationMinutes?: number;
}

const WEEKDAYS: Record<string, number> = {
  sonntag: 0,
  sunday: 0,
  montag: 1,
  monday: 1,
  dienstag: 2,
  tuesday: 2,
  mittwoch: 3,
  wednesday: 3,
  donnerstag: 4,
  thursday: 4,
  freitag: 5,
  friday: 5,
  samstag: 6,
  saturday: 6,
};

const MONTHS: Record<string, number> = {
  januar: 1,
  jaenner: 1,
  jänner: 1,
  january: 1,
  jan: 1,
  februar: 2,
  february: 2,
  feb: 2,
  maerz: 3,
  märz: 3,
  marz: 3,
  march: 3,
  mrz: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mai: 5,
  may: 5,
  juni: 6,
  june: 6,
  jun: 6,
  juli: 7,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  oktober: 10,
  october: 10,
  okt: 10,
  oct: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  december: 12,
  dez: 12,
  dec: 12,
};

// Longest names first so "september" wins over "sep" in the alternation.
const MONTH_NAME_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getZonedParts(date: Date, timeZone: string) {
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
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatOffset(offsetMs: number): string {
  const sign = offsetMs >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMs);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  return `${sign}${pad2(hours)}:${pad2(minutes)}`;
}

function instantToZonedIso(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  const offset = formatOffset(getTimeZoneOffsetMs(date, timeZone));
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(
    parts.minute,
  )}:00${offset}`;
}

function localDateTimeToZonedIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let offset = getTimeZoneOffsetMs(new Date(wallClockUtc), timeZone);
  let instant = new Date(wallClockUtc - offset);
  const correctedOffset = getTimeZoneOffsetMs(instant, timeZone);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    instant = new Date(wallClockUtc - offset);
  }
  return instantToZonedIso(instant, timeZone);
}

function addDaysToDateParts(year: number, month: number, day: number, days: number) {
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function parseDateOffset(normalized: string, now: Date, timeZone: string): number | null {
  if (/\b(?:ubermorgen|uebermorgen|overmorrow)\b/.test(normalized)) return 2;
  if (/\b(?:morgen|tomorrow)\b/.test(normalized)) return 1;
  if (/\b(?:heute|today)\b/.test(normalized)) return 0;

  const weekdayEntry = Object.entries(WEEKDAYS).find(([name]) =>
    new RegExp(`\\b${name}\\b`).test(normalized),
  );
  if (!weekdayEntry) return null;

  const current = getZonedParts(now, timeZone);
  const currentDay = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
  const targetDay = weekdayEntry[1];
  const offset = (targetDay - currentDay + 7) % 7;
  return offset === 0 ? 7 : offset;
}

function toMatchable(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isValidCalendarDay(day: number, month: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= DAYS_IN_MONTH[month - 1];
}

// A bare day+month (no year) means the next upcoming occurrence: this year if it
// is still ahead, otherwise next year.
function inferYear(month: number, day: number, now: Date, timeZone: string): number {
  const current = getZonedParts(now, timeZone);
  if (month < current.month || (month === current.month && day < current.day)) {
    return current.year + 1;
  }
  return current.year;
}

// Parses a date the user wrote out explicitly — "3. august", "3 august 2026",
// "3.8." or "03.08.2026". Runs on the raw text because normalizeText() strips the
// dots that distinguish a date ("14.30") from a time and separate day/month/year.
function parseExplicitDate(
  original: string,
  now: Date,
  timeZone: string,
): { year: number; month: number; day: number } | null {
  const text = toMatchable(original);

  const nameMatch = text.match(
    new RegExp(`\\b(\\d{1,2})\\.?\\s*(${MONTH_NAME_PATTERN})\\b(?:\\s+(\\d{4}))?`),
  );
  if (nameMatch) {
    const day = Number(nameMatch[1]);
    const month = MONTHS[nameMatch[2]];
    if (isValidCalendarDay(day, month)) {
      const year = nameMatch[3] ? Number(nameMatch[3]) : inferYear(month, day, now, timeZone);
      return { year, month, day };
    }
  }

  // Require the trailing dot after the month so a decimal ("in 3.5 stunden") or a
  // dotted time ("14.30 uhr") is not mistaken for a date.
  const numericMatch = text.match(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{2,4}))?/);
  if (numericMatch) {
    const day = Number(numericMatch[1]);
    const month = Number(numericMatch[2]);
    if (isValidCalendarDay(day, month)) {
      let year: number;
      if (numericMatch[3]) {
        const raw = Number(numericMatch[3]);
        year = raw < 100 ? 2000 + raw : raw;
      } else {
        year = inferYear(month, day, now, timeZone);
      }
      return { year, month, day };
    }
  }

  return null;
}

// True when the user clearly typed a calendar date (a day number next to a month
// name, or a dd.mm. numeric date) even if it did not resolve to a valid day. Such
// messages defer to the model instead of silently falling back to a weekday match.
function hasExplicitDateAttempt(original: string): boolean {
  const text = toMatchable(original);
  if (new RegExp(`\\b\\d{1,2}\\.?\\s*(?:${MONTH_NAME_PATTERN})\\b`).test(text)) return true;
  return /\b\d{1,2}\.\s*\d{1,2}\./.test(text);
}

// An explicit date (e.g. "3. august") always wins over a bare weekday ("montag"),
// which resolves to the *next* such weekday and would otherwise be a week early.
function resolveEventDate(
  original: string,
  normalized: string,
  now: Date,
  timeZone: string,
): { year: number; month: number; day: number } | null {
  const explicit = parseExplicitDate(original, now, timeZone);
  if (explicit) return explicit;
  if (hasExplicitDateAttempt(original)) return null;

  const offset = parseDateOffset(normalized, now, timeZone);
  if (offset == null) return null;
  const current = getZonedParts(now, timeZone);
  return addDaysToDateParts(current.year, current.month, current.day, offset);
}

function parseTime(normalized: string): { hour: number; minute: number } | null {
  // normalizeText() turns "14:00" into "14 00", so the minute separator may be a
  // stripped colon/dot (now a space) as well as a literal ":" or ".".
  const explicit = normalized.match(/\b(?:um\s*)?([01]?\d|2[0-3])(?:\s*[:.\s]\s*(\d{2}))?\s*uhr\b/);
  const withUm = normalized.match(/\bum\s*([01]?\d|2[0-3])(?:\s*[:.]\s*(\d{2}))?\b/);
  const match = explicit || withUm;
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: match[2] ? Number(match[2]) : 0,
  };
}

function hasCalendarTrigger(normalized: string): boolean {
  return (
    /\b(?:kalendereintrag|termin)\b/.test(normalized) ||
    /\bkalender\b/.test(normalized) ||
    /\b(?:trag|trage|tage|mache|mach|erstelle|erstell)\b.*\bkalender\b.*\bein\b/.test(normalized)
  );
}

function hasDateWord(normalized: string): boolean {
  return (
    /\b(?:heute|morgen|ubermorgen|uebermorgen|today|tomorrow)\b/.test(normalized) ||
    Object.keys(WEEKDAYS).some((day) => new RegExp(`\\b${day}\\b`).test(normalized)) ||
    Object.keys(MONTHS).some((month) => new RegExp(`\\b${month}\\b`).test(normalized))
  );
}

function hasTimeWord(normalized: string): boolean {
  return (
    /\b(?:um\s*)?([01]?\d|2[0-3])(?:\s*[:.\s]\s*(\d{2}))?\s*uhr\b/.test(normalized) ||
    /\bum\s*([01]?\d|2[0-3])(?:\s*[:.]\s*(\d{2}))?\b/.test(normalized)
  );
}

function cleanupTitle(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:!-]+|[\s,.;:!-]+$/g, "")
    .replace(/^(?:bitte|und|fuer|fur)\s+/i, "")
    .trim();
}

// Drops German lead-in filler left after the date/time/trigger words are removed,
// e.g. "habe ich einen …" or a dangling leading article, so the title reads cleanly.
function stripTitleFiller(value: string): string {
  return value
    .replace(/^(?:ich\s+)?hab(?:e)?\s+(?:ich\s+)?(?:noch\s+)?(?:einen?|eine)\b\s*/i, "")
    .replace(/^(?:einen?|eine|den|dem)\s+/i, "")
    .trim();
}

function extractTitle(text: string): string {
  // Split on commas/semicolons only — never on the period, which is part of dates
  // ("3. august", "3.8.") and abbreviations.
  const chunks = text
    .split(/[,;]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const titleChunks = chunks.filter((chunk) => {
    const normalized = normalizeText(chunk);
    return !hasCalendarTrigger(normalized) && !hasDateWord(normalized) && !hasTimeWord(normalized);
  });
  const chunkTitle = stripTitleFiller(cleanupTitle(titleChunks.join(", ")));
  if (chunkTitle) return chunkTitle;

  let fallback = text;
  // Written-out dates: "den 3. august 2026", "am 3 august".
  fallback = fallback.replace(
    new RegExp(
      `\\b(?:am|an|den|dem|vom|zum|fuer|fur|für)?\\s*\\d{1,2}\\.?\\s*(?:${MONTH_NAME_PATTERN})\\b(?:\\s+\\d{4})?`,
      "gi",
    ),
    " ",
  );
  // Numeric dates: "3.8.", "03.08.2026".
  fallback = fallback.replace(
    /\b(?:am|an|den|dem|vom)?\s*\d{1,2}\.\s*\d{1,2}\.(?:\s*\d{2,4})?/gi,
    " ",
  );
  // Weekdays and relative day words.
  fallback = fallback.replace(
    new RegExp(`\\b(?:${Object.keys(WEEKDAYS).join("|")})\\b`, "gi"),
    " ",
  );
  fallback = fallback.replace(/\b(?:heute|morgen|uebermorgen|übermorgen|today|tomorrow)\b/gi, " ");
  fallback = fallback.replace(
    /\b(?:um\s*)?([01]?\d|2[0-3])(?:\s*[:.\s]\s*(\d{2}))?\s*uhr\b/gi,
    " ",
  );
  fallback = fallback.replace(/\bum\s*([01]?\d|2[0-3])(?:\s*[:.]\s*(\d{2}))?\b/gi, " ");
  fallback = fallback.replace(
    /\b(?:mach(?:e)?|erstell(?:e)?|trag(?:e)?|tage)\b\s*(?:einen?\s+)?(?:kalendereintrag|termin)?\s*(?:in\s+den\s+kalender)?\s*(?:ein)?/gi,
    " ",
  );
  fallback = fallback.replace(/\b(?:in\s+den\s+)?kalender\s*(?:eintragen|ein)?\b/gi, " ");
  fallback = fallback.replace(/\b(?:kalendereintrag|termin)\b/gi, " ");
  // Timezone qualifiers: "berlin(er) zeit", "deutscher zeit", "ortszeit".
  fallback = fallback.replace(/\b(?:berlin(?:er)?|deutsche[rns]?|mez|mesz|orts)\s*zeit\b/gi, " ");
  return stripTitleFiller(cleanupTitle(fallback));
}

export function parseTelegramCalendarShortcut(
  text: string,
  opts: ParseOptions = {},
): TelegramCalendarShortcut | null {
  const original = cleanupTitle(text || "");
  if (!original) return null;

  const normalized = normalizeText(original);
  if (!hasCalendarTrigger(normalized)) return null;

  const timeZone = opts.timeZone || "Europe/Berlin";
  const now = opts.now || new Date();
  const targetDate = resolveEventDate(original, normalized, now, timeZone);
  const time = parseTime(normalized);
  if (!targetDate || !time) return null;

  const title = extractTitle(original);
  if (title.length < 3) return null;

  const startTime = localDateTimeToZonedIso(
    targetDate.year,
    targetDate.month,
    targetDate.day,
    time.hour,
    time.minute,
    timeZone,
  );
  const duration = opts.defaultDurationMinutes ?? 60;
  const endTime = instantToZonedIso(
    new Date(new Date(startTime).getTime() + duration * 60_000),
    timeZone,
  );

  return { title, startTime, endTime };
}

export function buildScheduleEventToolXml(event: TelegramCalendarShortcut): string {
  return `<tool>schedule_event</tool><event>${JSON.stringify(event)}</event>`;
}
