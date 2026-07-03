import { describe, expect, it } from "vitest";
import {
  buildTelegramMainReply,
  splitTelegramToolResults,
} from "../../supabase/functions/_shared/telegram-reply";

describe("Telegram confirmation reply ordering", () => {
  it("suppresses model success prose while an action is waiting for confirmation", () => {
    const { queued, executed } = splitTelegramToolResults([
      {
        queued: true,
        actionId: "pending-1",
        message: "Schedule event: Schulfest bei Tuba at Fri, 03 Jul, 19:00",
      },
    ]);

    expect(queued).toHaveLength(1);
    expect(
      buildTelegramMainReply(
        "OK. Ich habe das Schulfest bei Tuba um 19:00 Uhr in deinen Kalender eingetragen.",
        executed,
        queued.length > 0,
      ),
    ).toBe("");
  });

  it("keeps real executed tool messages available after confirmation prompts", () => {
    const { queued, executed } = splitTelegramToolResults([
      {
        queued: true,
        actionId: "pending-1",
        message: "Schedule event: Schulfest bei Tuba at Fri, 03 Jul, 19:00",
      },
      {
        queued: false,
        message: "Saved note: Bring documents to school.",
      },
    ]);

    expect(buildTelegramMainReply("Done already.", executed, queued.length > 0)).toBe(
      "Saved note: Bring documents to school.",
    );
  });

  it("uses normal model replies when nothing is queued", () => {
    const { queued, executed } = splitTelegramToolResults([
      {
        queued: false,
        message: "Added task: Buy milk.",
      },
    ]);

    expect(buildTelegramMainReply("Done.", executed, queued.length > 0)).toBe(
      "Done.\n\nAdded task: Buy milk.",
    );
  });
});
