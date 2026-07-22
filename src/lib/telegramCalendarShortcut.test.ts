import { describe, expect, it } from "vitest";
import {
  buildScheduleEventToolXml,
  parseTelegramCalendarShortcut,
} from "../../supabase/functions/_shared/telegram-calendar-shortcut";

const now = new Date("2026-07-03T20:59:00Z"); // 22:59 in Europe/Berlin
const timeZone = "Europe/Berlin";

describe("Telegram calendar shortcut", () => {
  it("parses a German voice transcript with STT 'Tage' instead of 'Trage'", () => {
    const event = parseTelegramCalendarShortcut(
      "Tage im Kalender ein, morgen um 16 Uhr, Kindergeburtstag, Alia und Sali.",
      { now, timeZone },
    );

    expect(event).toEqual({
      title: "Kindergeburtstag, Alia und Sali",
      startTime: "2026-07-04T16:00:00+02:00",
      endTime: "2026-07-04T17:00:00+02:00",
    });
  });

  it("parses 'Mache einen Kalendereintrag' voice wording", () => {
    const event = parseTelegramCalendarShortcut(
      "Mache einen Kalendereintrag, morgen 16 Uhr, Kindergeburtstag, Adia und Sali.",
      { now, timeZone },
    );

    expect(event?.title).toBe("Kindergeburtstag, Adia und Sali");
    expect(event?.startTime).toBe("2026-07-04T16:00:00+02:00");
    expect(buildScheduleEventToolXml(event!)).toContain("<tool>schedule_event</tool>");
  });

  it("does not parse ordinary chat with a date and time but no calendar intent", () => {
    expect(
      parseTelegramCalendarShortcut("Morgen 16 Uhr klingt gut fuer den Spielplatz.", {
        now,
        timeZone,
      }),
    ).toBeNull();
  });

  it("keeps the minutes when the time is written as HH:MM Uhr", () => {
    // Regression: normalizeText() strips the colon ("14:00" -> "14 00"), which
    // used to make parseTime match "00 Uhr" and schedule the event at midnight.
    const event = parseTelegramCalendarShortcut("Termin morgen um 14:00 Uhr Zahnarzt", {
      now,
      timeZone,
    });

    expect(event?.startTime).toBe("2026-07-04T14:00:00+02:00");
    expect(event?.title).toBe("Zahnarzt");
  });

  it("honours an explicit written-out date over a bare weekday", () => {
    // Regression: "montag den 3. august" used to resolve to the *next* Monday
    // (a week early) at midnight, because only the weekday "montag" was read.
    const event = parseTelegramCalendarShortcut(
      "montag den 3. august habe ich einen termin mit florian vom nft gym um 14:00 uhr in meerbusch",
      { now, timeZone },
    );

    expect(event?.startTime).toBe("2026-08-03T14:00:00+02:00");
    expect(event?.title).toBe("mit florian vom nft gym in meerbusch");
  });

  it("parses a numeric dd.mm. date", () => {
    const event = parseTelegramCalendarShortcut("Termin am 3.8. um 9:30 Uhr Zahnarzt", {
      now,
      timeZone,
    });

    expect(event?.startTime).toBe("2026-08-03T09:30:00+02:00");
  });

  it("rolls a bare day+month that already passed into next year", () => {
    const event = parseTelegramCalendarShortcut("Termin am 3. Januar um 10 Uhr Brunch", {
      now, // 2026-07-03, so 3 January is next year
      timeZone,
    });

    expect(event?.startTime).toBe("2027-01-03T10:00:00+01:00");
  });

  it("does not mistake a dotted time or a person named August for a date", () => {
    const event = parseTelegramCalendarShortcut(
      "Kalendereintrag Termin morgen 14.30 Uhr mit August",
      { now, timeZone },
    );

    expect(event?.startTime).toBe("2026-07-04T14:30:00+02:00");
  });

  it("defers a malformed explicit date to the model instead of guessing", () => {
    expect(
      parseTelegramCalendarShortcut("Termin am 40. August um 10 Uhr Quatsch", { now, timeZone }),
    ).toBeNull();
  });
});
