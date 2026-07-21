import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { geminiDeclineReason, GEMINI_STT_MODEL, OPENAI_STT_MODEL } from "./telegram-stt.ts";

Deno.test("model constants match what the request actually sends", () => {
  assertEquals(GEMINI_STT_MODEL, "gemini-2.5-flash");
  assertEquals(OPENAI_STT_MODEL, "whisper-1");
});

Deno.test("geminiDeclineReason: a normal completion is not a decline", () => {
  assertEquals(
    geminiDeclineReason({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }],
    }),
    null,
  );
});

// Gemini omits finishReason on some complete responses; that is not a refusal.
Deno.test("geminiDeclineReason: a missing finishReason is not a decline", () => {
  assertEquals(
    geminiDeclineReason({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }),
    null,
  );
});

Deno.test("geminiDeclineReason: safety and recitation stops are declines", () => {
  assertEquals(geminiDeclineReason({ candidates: [{ finishReason: "SAFETY" }] }), "SAFETY");
  assertEquals(geminiDeclineReason({ candidates: [{ finishReason: "RECITATION" }] }), "RECITATION");
  assertEquals(geminiDeclineReason({ candidates: [{ finishReason: "MAX_TOKENS" }] }), "MAX_TOKENS");
});

// A prompt-level block has no candidates at all, only promptFeedback.
Deno.test("geminiDeclineReason: a blocked prompt is a decline", () => {
  assertEquals(
    geminiDeclineReason({ promptFeedback: { blockReason: "OTHER" }, candidates: [] }),
    "OTHER",
  );
});

Deno.test("geminiDeclineReason: an empty response is a decline, not a silent pass", () => {
  assertEquals(geminiDeclineReason({}), "NO_CANDIDATES");
  assertEquals(geminiDeclineReason({ candidates: [] }), "NO_CANDIDATES");
  assertEquals(geminiDeclineReason(null), "NO_CANDIDATES");
  assertEquals(geminiDeclineReason(undefined), "NO_CANDIDATES");
});

// The case this guard exists for: Gemini answers with prose instead of the
// requested JSON. Without the guard the lenient parser hands that refusal back
// as the transcript, and a non-empty transcript stops the provider loop before
// Whisper is ever tried.
Deno.test("geminiDeclineReason: a refusal carries a non-STOP finishReason", () => {
  const refusal = {
    candidates: [
      {
        finishReason: "SAFETY",
        content: { parts: [{ text: "I'm sorry, I can't help with that." }] },
      },
    ],
  };
  assertEquals(geminiDeclineReason(refusal), "SAFETY");
});
