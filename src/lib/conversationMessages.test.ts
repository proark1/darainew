import { describe, it, expect } from "vitest";
import { buildConversationMessages } from "./conversationMessages";

describe("buildConversationMessages", () => {
  it("returns just the user turn for a fresh empty session", () => {
    const out = buildConversationMessages({
      userText: "hi",
      messages: [],
      previousConversationMessages: [],
    });
    expect(out).toEqual([{ role: "user", content: "hi" }]);
  });

  it("injects previous context only when session is cold (messages empty)", () => {
    const prev = [
      { role: "user" as const, content: "earlier q" },
      { role: "assistant" as const, content: "earlier a" },
    ];
    const cold = buildConversationMessages({
      userText: "new q",
      messages: [],
      previousConversationMessages: prev,
    });
    expect(cold[0].content).toMatch(/Previous conversation context/);
    expect(cold).toContainEqual({ role: "user", content: "earlier q" });
    expect(cold[cold.length - 1]).toEqual({ role: "user", content: "new q" });

    // Warm: messages already exist → prev context skipped
    const warm = buildConversationMessages({
      userText: "follow-up",
      messages: [{ role: "user", content: "first" }],
      previousConversationMessages: prev,
    });
    expect(warm.find((m) => m.content.startsWith("[Previous"))).toBeUndefined();
  });

  it("truncates long history to the last 10 messages", () => {
    const msgs = Array.from({ length: 15 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `m${i}`,
    }));
    const out = buildConversationMessages({
      userText: "new",
      messages: msgs,
      previousConversationMessages: [],
    });
    // 10 kept + 1 trailing new user turn
    expect(out).toHaveLength(11);
    expect(out[0].content).toBe("m5");
    expect(out[out.length - 1]).toEqual({ role: "user", content: "new" });
  });

  it("drops consecutive duplicate (role, content) pairs", () => {
    const out = buildConversationMessages({
      userText: "next",
      messages: [
        { role: "user", content: "hi" },
        { role: "user", content: "hi" },
        { role: "assistant", content: "yo" },
      ],
      previousConversationMessages: [],
    });
    expect(out.filter((m) => m.content === "hi")).toHaveLength(1);
  });

  it("does not append a duplicate user turn when it already ends with one", () => {
    const out = buildConversationMessages({
      userText: "tail",
      messages: [{ role: "user", content: "tail" }],
      previousConversationMessages: [],
    });
    expect(out.filter((m) => m.content === "tail")).toHaveLength(1);
  });
});
