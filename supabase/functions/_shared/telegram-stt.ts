import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

export interface TelegramTranscriptionResult {
  transcript: string | null;
  language: string | null;
  confidence: number | null;
  durationSeconds: number | null;
  provider: "openai" | "gemini" | null;
  error?: string;
  fileSize?: number | null;
  /** Exact model that produced the transcript, for cost attribution. */
  model?: string | null;
  /**
   * Gemini reports real token usage for audio and we pass it through rather
   * than estimating from duration. Whisper bills per minute and reports no
   * tokens at all, so these stay null there — see transcriptionFooter.
   */
  promptTokens?: number | null;
  completionTokens?: number | null;
}

const TELEGRAM_PUBLIC_FILE_LIMIT_BYTES = 20 * 1024 * 1024;

// Named so the cost footer can price the exact model that ran.
export const OPENAI_STT_MODEL = "whisper-1";
export const GEMINI_STT_MODEL = "gemini-2.5-flash";

/**
 * Why Gemini refused to produce a transcript, or null if it answered normally.
 *
 * Gemini is a language model asked to return JSON, so it can decline or get
 * cut off instead of transcribing. Its reply is then prose ("I can't help with
 * that"), which the lenient parse below would happily hand back AS the
 * transcript — and because a non-empty transcript ends the provider loop, the
 * next provider would never get a turn. Reading finishReason/blockReason turns
 * that into an explicit failure so the fallback runs.
 */
export function geminiDeclineReason(data: unknown): string | null {
  const d = (data ?? {}) as {
    candidates?: Array<{ finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  const blockReason = d.promptFeedback?.blockReason;
  if (blockReason) return blockReason;
  const candidate = d.candidates?.[0];
  if (!candidate) return "NO_CANDIDATES";
  const finishReason = candidate.finishReason;
  // Absent finishReason is normal on a complete response.
  if (finishReason && finishReason !== "STOP") return finishReason;
  return null;
}

async function tg(
  method: string,
  body: Record<string, unknown>,
  telegramKey: string,
): Promise<Record<string, unknown>> {
  const r = await fetch(`https://api.telegram.org/bot${telegramKey}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Telegram ${method} failed [${r.status}]: ${JSON.stringify(data)}`);
  return data;
}

function extensionForMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  if (lower.includes("mp4") || lower.includes("m4a")) return "m4a";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("webm")) return "webm";
  return "audio";
}

function geminiAudioMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes("mpeg") || lower.includes("mp3")) return "audio/mp3";
  if (lower.includes("x-m4a") || lower.includes("m4a")) return "audio/aac";
  if (lower.includes("mp4")) return "audio/aac";
  return mime || "audio/ogg";
}

async function loadTelegramAudio(args: {
  fileId: string;
  telegramKey: string;
  expectedFileSize?: number | null;
}): Promise<{ bytes: Uint8Array; fileSize: number | null }> {
  const fileRes = await tg("getFile", { file_id: args.fileId }, args.telegramKey);
  const result = fileRes?.result as { file_path?: string; file_size?: number } | undefined;
  const filePath = result?.file_path;
  const fileSize = result?.file_size ?? args.expectedFileSize ?? null;
  if (!filePath) throw new Error("Telegram did not return a file path.");
  if (fileSize && fileSize > TELEGRAM_PUBLIC_FILE_LIMIT_BYTES) {
    throw new Error("Voice message is larger than Telegram Bot API download limit.");
  }
  const dl = await fetch(`https://api.telegram.org/file/bot${args.telegramKey}/${filePath}`);
  if (!dl.ok) throw new Error(`Telegram file download failed [${dl.status}]`);
  return { bytes: new Uint8Array(await dl.arrayBuffer()), fileSize };
}

async function transcribeWithOpenAi(
  bytes: Uint8Array,
  mime: string,
): Promise<TelegramTranscriptionResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey)
    return {
      transcript: null,
      language: null,
      confidence: null,
      durationSeconds: null,
      provider: null,
      error: "OPENAI_API_KEY not configured",
    };

  const fd = new FormData();
  fd.append("model", OPENAI_STT_MODEL);
  fd.append(
    "file",
    new Blob([bytes as unknown as BlobPart], { type: mime }),
    `telegram-voice.${extensionForMime(mime)}`,
  );
  fd.append("response_format", "verbose_json");

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  const data = await r.json().catch(async () => ({ error: { message: await r.text() } }));
  if (!r.ok) {
    const message = data?.error?.message || `OpenAI STT failed [${r.status}]`;
    return {
      transcript: null,
      language: null,
      confidence: null,
      durationSeconds: null,
      provider: "openai",
      error: message,
    };
  }
  return {
    transcript: String(data?.text || "").trim() || null,
    language: data?.language ? String(data.language) : null,
    confidence: null,
    durationSeconds: typeof data?.duration === "number" ? data.duration : null,
    provider: "openai",
    // Whisper is billed per minute of audio and returns no token usage.
    model: OPENAI_STT_MODEL,
  };
}

async function transcribeWithGemini(
  bytes: Uint8Array,
  mime: string,
): Promise<TelegramTranscriptionResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey)
    return {
      transcript: null,
      language: null,
      confidence: null,
      durationSeconds: null,
      provider: null,
      error: "GEMINI_API_KEY not configured",
    };

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_STT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Transcribe this Telegram voice message verbatim in the original language. " +
                  'Return only JSON: {"text":"...","language":"en|de|unknown","confidence":0.0-1.0}.',
              },
              { inline_data: { mime_type: geminiAudioMime(mime), data: encodeBase64(bytes) } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    },
  );
  const data = await r.json().catch(async () => ({ error: { message: await r.text() } }));
  if (!r.ok) {
    const message = data?.error?.message || `Gemini STT failed [${r.status}]`;
    return {
      transcript: null,
      language: null,
      confidence: null,
      durationSeconds: null,
      provider: "gemini",
      error: message,
    };
  }

  // Gemini bills audio as input tokens and reports the real count; use it
  // rather than deriving one from the clip length.
  const usage = data?.usageMetadata ?? {};
  const promptTokens = typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : null;
  const completionTokens =
    typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : null;

  const declined = geminiDeclineReason(data);
  if (declined) {
    return {
      transcript: null,
      language: null,
      confidence: null,
      durationSeconds: null,
      provider: "gemini",
      model: GEMINI_STT_MODEL,
      promptTokens,
      completionTokens,
      error: `Gemini returned no transcript (${declined})`,
    };
  }

  const raw = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      transcript: String(parsed?.text || "").trim() || null,
      language: parsed?.language ? String(parsed.language) : null,
      confidence: typeof parsed?.confidence === "number" ? parsed.confidence : null,
      durationSeconds: null,
      provider: "gemini",
      model: GEMINI_STT_MODEL,
      promptTokens,
      completionTokens,
    };
  } catch {
    return {
      transcript: cleaned || null,
      language: null,
      confidence: null,
      durationSeconds: null,
      provider: "gemini",
      model: GEMINI_STT_MODEL,
      promptTokens,
      completionTokens,
    };
  }
}

export async function transcribeTelegramVoice(args: {
  fileId: string;
  mime?: string | null;
  telegramKey: string;
  fileSize?: number | null;
  durationSeconds?: number | null;
}): Promise<TelegramTranscriptionResult> {
  const mime = args.mime || "audio/ogg";
  try {
    const { bytes, fileSize } = await loadTelegramAudio({
      fileId: args.fileId,
      telegramKey: args.telegramKey,
      expectedFileSize: args.fileSize,
    });

    // Gemini first: it transcribes as well as Whisper on these clips, costs
    // roughly a thirtieth as much, and reports real token usage so the cost
    // footer can show a breakdown. Whisper stays as the fallback for anything
    // Gemini declines or garbles. Override with TELEGRAM_STT_PROVIDER_ORDER.
    const providers = Deno.env.get("TELEGRAM_STT_PROVIDER_ORDER") || "gemini,openai";
    const errors: string[] = [];
    for (const provider of providers
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean)) {
      const result =
        provider === "gemini"
          ? await transcribeWithGemini(bytes, mime)
          : await transcribeWithOpenAi(bytes, mime);
      if (result.transcript) {
        return {
          ...result,
          durationSeconds: result.durationSeconds ?? args.durationSeconds ?? null,
          fileSize,
        };
      }
      if (result.error) errors.push(`${provider}: ${result.error}`);
    }

    return {
      transcript: null,
      language: null,
      confidence: null,
      durationSeconds: args.durationSeconds ?? null,
      provider: null,
      fileSize,
      error: errors.join("; ") || "No transcription provider returned text.",
    };
  } catch (e) {
    return {
      transcript: null,
      language: null,
      confidence: null,
      durationSeconds: args.durationSeconds ?? null,
      provider: null,
      fileSize: args.fileSize ?? null,
      error: (e as Error).message,
    };
  }
}
