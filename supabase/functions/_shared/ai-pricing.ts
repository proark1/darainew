// Per-model token pricing + a compact usage footer for Telegram replies.
//
// Rates are USD per 1M tokens. Flash rates match what logAIUsage has always
// used ($0.075 in / $0.30 out). Pro rates are best-effort ESTIMATES — adjust
// here when you have exact figures; the cost shown to users is labelled "~".

import { db } from "./supabase-edge.ts";

export interface ModelRate {
  inputPer1M: number;
  outputPer1M: number;
}

/**
 * Admin-controlled flag (app_settings.telegram_token_usage_enabled) gating the
 * per-reply token/cost footer on Telegram. Defaults to ON (fails open) so a
 * missing row or a read error still shows usage.
 */
export async function isUsageFooterEnabled(supabaseClient: unknown): Promise<boolean> {
  try {
    const { data } = await db(supabaseClient)
      .from("app_settings")
      .select("value")
      .eq("key", "telegram_token_usage_enabled")
      .maybeSingle();
    if (!data) return true;
    return data.value === true || data.value === "true";
  } catch {
    return true;
  }
}

const PRICING: Record<string, ModelRate> = {
  "gemini-3-flash-preview": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-2.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  // Estimate — verify against current Gemini Pro pricing before relying on it.
  "gemini-3-pro-preview": { inputPer1M: 1.25, outputPer1M: 10.0 },
};
const DEFAULT_RATE: ModelRate = { inputPer1M: 0.075, outputPer1M: 0.3 };

export function rateFor(model: string): ModelRate {
  return PRICING[model] ?? DEFAULT_RATE;
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const r = rateFor(model);
  return (promptTokens / 1_000_000) * r.inputPer1M + (completionTokens / 1_000_000) * r.outputPer1M;
}

function formatUsd(cost: number): string {
  return cost >= 0.01 ? `$${cost.toFixed(3)}` : `$${cost.toFixed(5)}`;
}

const n = (x: number) => x.toLocaleString("en-US");

// Compact footer appended to a Telegram reply. Emphasises the SUM of input +
// output tokens, with the split and an estimated cost.
export function usageFooter(model: string, promptTokens: number, completionTokens: number): string {
  const total = promptTokens + completionTokens;
  const cost = estimateCostUsd(model, promptTokens, completionTokens);
  return `\n\n———\n🔢 ${n(total)} tokens (↑${n(promptTokens)} ↓${n(completionTokens)}) · ~${formatUsd(cost)}`;
}

// Whisper is billed per minute of audio, rounded up to the second, and returns
// no token usage at all. https://openai.com/api/pricing
export const WHISPER_USD_PER_MINUTE = 0.006;

export interface TranscriptionUsage {
  provider: "openai" | "gemini" | null;
  model?: string | null;
  durationSeconds?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
}

export function transcriptionCostUsd(usage: TranscriptionUsage): number | null {
  if (usage.provider === "gemini") {
    // Gemini reports real token counts for audio; price them like any other
    // call to that model.
    if (usage.promptTokens == null && usage.completionTokens == null) return null;
    return estimateCostUsd(
      usage.model || "gemini-2.5-flash",
      usage.promptTokens ?? 0,
      usage.completionTokens ?? 0,
    );
  }
  if (usage.provider === "openai") {
    if (usage.durationSeconds == null) return null;
    return (usage.durationSeconds / 60) * WHISPER_USD_PER_MINUTE;
  }
  return null;
}

/**
 * Cost footer for a transcript, in the same shape as usageFooter.
 *
 * The two providers bill on different units and the footer says which one it
 * is rather than flattening both into a fake token count: Gemini reports real
 * audio tokens, Whisper reports none and charges per minute. Returns "" when
 * there is nothing trustworthy to show.
 */
export function transcriptionFooter(usage: TranscriptionUsage): string {
  const cost = transcriptionCostUsd(usage);
  if (cost === null) return "";

  if (usage.provider === "gemini") {
    const prompt = usage.promptTokens ?? 0;
    const completion = usage.completionTokens ?? 0;
    return `\n\n———\n🔢 ${n(prompt + completion)} tokens (↑${n(prompt)} ↓${n(completion)}) · ~${formatUsd(cost)}`;
  }

  const seconds = Math.round(usage.durationSeconds ?? 0);
  return `\n\n———\n🔢 ${seconds}s audio · ~${formatUsd(cost)}`;
}
