import { describe, expect, it } from "vitest";
import {
  clampMeetingLimit,
  formatMeetingList,
} from "../../supabase/functions/_shared/meeting-list";

const rows = [
  { start_time: "2026-08-03T06:45:00.000Z", title: "Agentur für Arbeit", location: "Room 341" },
  { start_time: "2026-08-03T12:00:00.000Z", title: "Florian NFT Gym" },
];

describe("formatMeetingList", () => {
  it("numbers each meeting and renders times in the given timezone", () => {
    const out = formatMeetingList(rows, "Europe/Berlin");
    expect(out).toContain("📅 Your next 2 meetings:");
    expect(out).toContain("1. ");
    expect(out).toContain("2. ");
    // 06:45Z / 12:00Z shown as Berlin summer time (+02:00).
    expect(out).toContain("08:45");
    expect(out).toContain("14:00");
    expect(out).toContain("Agentur für Arbeit @ Room 341");
    expect(out).toContain("Florian NFT Gym");
  });

  it("includes the edit-by-number hint", () => {
    expect(formatMeetingList(rows, "Europe/Berlin")).toContain('"3 16:00"');
  });

  it("defaults to Berlin when no timezone is passed", () => {
    expect(formatMeetingList([rows[1]])).toContain("14:00");
  });

  it("handles an empty list", () => {
    expect(formatMeetingList([])).toBe("📭 No upcoming meetings.");
  });

  it("uses singular wording for one meeting", () => {
    expect(formatMeetingList([rows[0]], "Europe/Berlin")).toContain("Your next 1 meeting:");
  });
});

describe("clampMeetingLimit", () => {
  it("defaults to 5 and clamps to [1, 20]", () => {
    expect(clampMeetingLimit(undefined)).toBe(5);
    expect(clampMeetingLimit("10")).toBe(10);
    expect(clampMeetingLimit(0)).toBe(5); // Number(0) || 5 -> 5
    expect(clampMeetingLimit(100)).toBe(20);
    expect(clampMeetingLimit(-3)).toBe(1);
  });
});
