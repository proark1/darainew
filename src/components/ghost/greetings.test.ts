import { describe, it, expect } from "vitest";
import { pickGreetingBank, getRandomGreeting } from "./greetings";

describe("pickGreetingBank", () => {
  it("picks morning before noon", () => {
    expect(pickGreetingBank(0)[0]).toMatch(/morning/i);
    expect(pickGreetingBank(11)[0]).toMatch(/morning/i);
  });

  it("picks afternoon 12-16", () => {
    expect(pickGreetingBank(12)[0]).toMatch(/afternoon/i);
    expect(pickGreetingBank(16)[0]).toMatch(/afternoon/i);
  });

  it("picks evening 17-20", () => {
    expect(pickGreetingBank(17)[0]).toMatch(/evening/i);
    expect(pickGreetingBank(20)[0]).toMatch(/evening/i);
  });

  it("picks night 21+", () => {
    const bank = pickGreetingBank(23);
    expect(bank.some((g) => /night|midnight|sleep/i.test(g))).toBe(true);
  });
});

describe("getRandomGreeting", () => {
  it("returns a non-empty string", () => {
    expect(getRandomGreeting(new Date("2025-05-21T09:00:00"))).toMatch(/\S/);
  });

  it("morning greeting contains a morning phrase", () => {
    const out = getRandomGreeting(new Date("2025-05-21T09:00:00"));
    expect(out).toMatch(/morning|shine|early bird/i);
  });
});
