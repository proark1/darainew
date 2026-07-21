import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { pickTelegramAudio } from "./telegram-voice.ts";

Deno.test("pickTelegramAudio: nothing to transcribe", () => {
  assertEquals(pickTelegramAudio(null), null);
  assertEquals(pickTelegramAudio(undefined), null);
  assertEquals(pickTelegramAudio({}), null);
});

Deno.test("pickTelegramAudio: a recorded voice note", () => {
  const got = pickTelegramAudio({
    voice: { file_id: "v1", mime_type: "audio/ogg", file_size: 1234, duration: 36 },
  });
  assertEquals(got, { fileId: "v1", mime: "audio/ogg", fileSize: 1234, durationSeconds: 36 });
});

Deno.test("pickTelegramAudio: voice wins over other attachments", () => {
  const got = pickTelegramAudio({
    voice: { file_id: "v1" },
    audio: { file_id: "a1" },
    document: { file_id: "d1", file_name: "note.ogg" },
  });
  assertEquals(got?.fileId, "v1");
});

Deno.test("pickTelegramAudio: falls back to a default mime when Telegram omits one", () => {
  assertEquals(pickTelegramAudio({ voice: { file_id: "v1" } })?.mime, "audio/ogg");
  assertEquals(pickTelegramAudio({ audio: { file_id: "a1" } })?.mime, "audio/mpeg");
  assertEquals(pickTelegramAudio({ video_note: { file_id: "n1" } })?.mime, "video/mp4");
});

Deno.test("pickTelegramAudio: a document with an audio mime", () => {
  const got = pickTelegramAudio({
    document: { file_id: "d1", mime_type: "audio/mpeg", file_name: "recording.mp3" },
  });
  assertEquals(got?.fileId, "d1");
  assertEquals(got?.mime, "audio/mpeg");
});

// The case from the field: a WhatsApp voice note forwarded into Telegram is a
// document, and its mime is frequently application/octet-stream. Rejecting it
// would refuse exactly the file the user is asking about.
Deno.test("pickTelegramAudio: a WhatsApp .ogg sent as an octet-stream document", () => {
  const got = pickTelegramAudio({
    document: {
      file_id: "d2",
      mime_type: "application/octet-stream",
      file_name: "WhatsApp Ptt 2026-07-20 at 10.08.20 PM.ogg",
      file_size: 5678,
    },
  });
  // The octet-stream mime must NOT be passed through: the STT layer builds the
  // Whisper upload filename from it, and "application/octet-stream" produces
  // "telegram-voice.audio", which Whisper rejects.
  assertEquals(got, {
    fileId: "d2",
    mime: "audio/ogg",
    fileSize: 5678,
    durationSeconds: null,
  });
});

Deno.test("pickTelegramAudio: extension decides the mime when the document's is useless", () => {
  const cases: Array<[string, string]> = [
    ["a.ogg", "audio/ogg"],
    ["a.oga", "audio/ogg"],
    ["a.opus", "audio/ogg"],
    ["a.mp3", "audio/mpeg"],
    ["a.m4a", "audio/mp4"],
    ["a.aac", "audio/aac"],
    ["a.wav", "audio/wav"],
    ["a.flac", "audio/flac"],
  ];
  for (const [name, mime] of cases) {
    const got = pickTelegramAudio({
      document: { file_id: "x", mime_type: "application/octet-stream", file_name: name },
    });
    assertEquals(got?.fileId, "x", `expected ${name} to be treated as audio`);
    assertEquals(got?.mime, mime, `wrong mime for ${name}`);
  }
});

Deno.test("pickTelegramAudio: a real audio mime on a document is kept", () => {
  const got = pickTelegramAudio({
    document: { file_id: "x", mime_type: "audio/flac", file_name: "take.flac" },
  });
  assertEquals(got?.mime, "audio/flac");
});

Deno.test("pickTelegramAudio: extension match is case-insensitive", () => {
  assertEquals(pickTelegramAudio({ document: { file_id: "x", file_name: "A.OGG" } })?.fileId, "x");
});

// A PDF or image must keep going to the document-intake path, which extracts
// text from it — sending it to Whisper instead would silently lose the content.
Deno.test("pickTelegramAudio: non-audio documents are left alone", () => {
  for (const doc of [
    { file_id: "p", mime_type: "application/pdf", file_name: "contract.pdf" },
    { file_id: "i", mime_type: "image/png", file_name: "screenshot.png" },
    { file_id: "v", mime_type: "video/mp4", file_name: "clip.mp4" },
    { file_id: "o", mime_type: "application/octet-stream", file_name: "archive.zip" },
    { file_id: "n", mime_type: "application/octet-stream" },
  ]) {
    assertEquals(
      pickTelegramAudio({ document: doc }),
      null,
      `expected ${doc.file_id} to be skipped`,
    );
  }
});

Deno.test("pickTelegramAudio: a document without a file_id is not a candidate", () => {
  assertEquals(pickTelegramAudio({ document: { file_name: "note.ogg" } }), null);
});
