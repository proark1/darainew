import { describe, expect, it } from "vitest";
import { applyTimeToIso, parseClockTime } from "../../supabase/functions/_shared/event-time";

describe("applyTimeToIso", () => {
  it("moves the clock time but keeps the Berlin calendar date (summer, +02:00)", () => {
    // 2026-08-03T14:00 Berlin == 12:00Z. Move to 16:00 Berlin == 14:00Z.
    expect(applyTimeToIso("2026-08-03T12:00:00.000Z", "16:00", "Europe/Berlin")).toBe(
      "2026-08-03T14:00:00.000Z",
    );
  });

  it("accepts a stored offset ISO as input", () => {
    expect(applyTimeToIso("2026-08-03T14:00:00+02:00", "09:30", "Europe/Berlin")).toBe(
      "2026-08-03T07:30:00.000Z",
    );
  });

  it("keeps the date across winter (+01:00)", () => {
    // 2026-01-05T10:00 Berlin == 09:00Z. Move to 18:00 Berlin == 17:00Z.
    expect(applyTimeToIso("2026-01-05T09:00:00.000Z", "18:00", "Europe/Berlin")).toBe(
      "2026-01-05T17:00:00.000Z",
    );
  });

  it("defaults to Berlin and parses '16 Uhr' phrasing", () => {
    expect(applyTimeToIso("2026-08-03T12:00:00.000Z", "16 Uhr")).toBe("2026-08-03T14:00:00.000Z");
  });

  it("uses the event's Berlin date even when the new time lands on the previous UTC day", () => {
    // 00:30 Berlin on Aug 3 == 22:30Z on Aug 2 — still Aug 3 in the user's day.
    expect(applyTimeToIso("2026-08-03T12:00:00.000Z", "00:30", "Europe/Berlin")).toBe(
      "2026-08-02T22:30:00.000Z",
    );
  });

  it("returns null on an unparseable time", () => {
    expect(applyTimeToIso("2026-08-03T12:00:00.000Z", "banana")).toBeNull();
  });
});

describe("parseClockTime", () => {
  it("parses common formats", () => {
    expect(parseClockTime("16:00")).toEqual({ hour: 16, minute: 0 });
    expect(parseClockTime("9:30")).toEqual({ hour: 9, minute: 30 });
    expect(parseClockTime("16")).toEqual({ hour: 16, minute: 0 });
    expect(parseClockTime("16 Uhr")).toEqual({ hour: 16, minute: 0 });
    expect(parseClockTime("8.45")).toEqual({ hour: 8, minute: 45 });
  });

  it("rejects nonsense and out-of-range values", () => {
    expect(parseClockTime("25:00")).toBeNull();
    expect(parseClockTime("banana")).toBeNull();
  });
});
