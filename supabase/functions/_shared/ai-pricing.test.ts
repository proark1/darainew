import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  transcriptionCostUsd,
  transcriptionFooter,
  usageFooter,
  WHISPER_USD_PER_MINUTE,
} from "./ai-pricing.ts";

Deno.test("usageFooter: unchanged shape for AI replies", () => {
  // 1000 in / 500 out on flash: 1000/1e6*0.075 + 500/1e6*0.30 = 0.000225, which
  // binary64 holds as 0.00022499…, so toFixed(5) renders 0.00022 not 0.00023.
  assertEquals(
    usageFooter("gemini-2.5-flash", 1000, 500),
    "\n\n———\n🔢 1,500 tokens (↑1,000 ↓500) · ~$0.00022",
  );
});

Deno.test("transcriptionCostUsd: Whisper is billed per minute", () => {
  const cost = transcriptionCostUsd({
    provider: "openai",
    model: "whisper-1",
    durationSeconds: 36,
  });
  assertAlmostEquals(cost ?? -1, (36 / 60) * WHISPER_USD_PER_MINUTE, 1e-12);
});

Deno.test("transcriptionCostUsd: Gemini is billed on its reported tokens", () => {
  const cost = transcriptionCostUsd({
    provider: "gemini",
    model: "gemini-2.5-flash",
    durationSeconds: 36,
    promptTokens: 1200,
    completionTokens: 80,
  });
  // 1200/1e6*0.075 + 80/1e6*0.30 = 0.000114
  assertAlmostEquals(cost ?? -1, 0.000114, 1e-12);
});

// Duration must not leak into the Gemini branch: it bills tokens, and a clip
// whose length we happen to know is not therefore priced by length.
Deno.test("transcriptionCostUsd: Gemini without token counts is not guessed", () => {
  assertEquals(transcriptionCostUsd({ provider: "gemini", durationSeconds: 600 }), null);
});

Deno.test("transcriptionCostUsd: nothing to price", () => {
  assertEquals(transcriptionCostUsd({ provider: "openai", durationSeconds: null }), null);
  assertEquals(transcriptionCostUsd({ provider: null }), null);
});

Deno.test("transcriptionFooter: Whisper shows audio seconds, not fake tokens", () => {
  const footer = transcriptionFooter({
    provider: "openai",
    model: "whisper-1",
    durationSeconds: 36,
  });
  assertEquals(footer, "\n\n———\n🔢 36s audio · ~$0.00360");
});

Deno.test("transcriptionFooter: Gemini matches the AI reply footer shape", () => {
  const footer = transcriptionFooter({
    provider: "gemini",
    model: "gemini-2.5-flash",
    promptTokens: 1200,
    completionTokens: 80,
  });
  assertEquals(footer, "\n\n———\n🔢 1,280 tokens (↑1,200 ↓80) · ~$0.00011");
});

Deno.test("transcriptionFooter: silent when the cost is unknown", () => {
  assertEquals(transcriptionFooter({ provider: null }), "");
  assertEquals(transcriptionFooter({ provider: "gemini" }), "");
  assertEquals(transcriptionFooter({ provider: "openai", durationSeconds: null }), "");
});

Deno.test("transcriptionFooter: costs above a cent use coarser precision", () => {
  // 30 minutes of Whisper = $0.18, which should not render as $0.18000.
  const footer = transcriptionFooter({ provider: "openai", durationSeconds: 1800 });
  assertEquals(footer, "\n\n———\n🔢 1800s audio · ~$0.180");
});
