# Telegram Voice Action and Replay Guard Design

## Context

Two Telegram group issues need a narrow backend fix:

- Voice notes are transcribed and echoed back, but the requested action is not always executed or queued.
- When a long text is posted, Dori can surface confirmations for old appointments/tasks from prior group history.

Relevant code paths:

- `supabase/functions/telegram-poll/index.ts` transcribes voice/audio, echoes `Heard`, injects `msg.text`, decides whether a group message should route, and calls `telegram-router`.
- `supabase/functions/telegram-router/index.ts` loads recent Telegram group history, prepends it to the current turn, calls `chat`, then sends executed results and queued confirmations.
- `supabase/functions/chat/index.ts` uses the full `messages` array for the model. It has prompt guidance to act only on the latest Telegram message, but older messages can still influence tool generation.

## Options Considered

1. Recommended: mark historical Telegram turns as inert context and add a deterministic post-filter.
   - Keep useful context for follow-ups.
   - Prevent queued/executed tools unless they are grounded in the latest user message.
   - Lowest behavioral blast radius.

2. Drop all group history before every `chat` call.
   - Strongest duplicate prevention.
   - Loses follow-up context like "yes, that one" or "what about tomorrow?".

3. Rely only on a stronger system prompt.
   - Smallest code change.
   - Not reliable enough, because the reported bug already happens with an existing latest-message prompt.

## Design

Use option 1.

In `telegram-router`, continue loading recent turns, but wrap old user messages so they are clearly non-instructional context. The final user message remains the only actionable instruction. This preserves conversational continuity while reducing the chance that the model replays old requests.

In `chat`, add a server-side Telegram replay guard for `tg_private`, `tg_family`, and `tg_workspace`: before any mutating tool XML is queued or executed, it must be grounded in the latest user turn. If a tool's parsed title/summary/time appears unrelated to the latest turn, strip that tool call and log a warning. This makes replay prevention deterministic instead of purely prompt-based and prevents stale confirmations from being inserted into `auto_actions_log`.

For voice notes, keep the transcript echo for user trust, but ensure the transcribed text is treated as the actual current user turn through the same router/chat path. If the model returns only queued confirmations, those should still be sent after the echo. If it returns executed results, they should be sent normally.

## Data Flow

1. Telegram update arrives in `telegram-poll`.
2. Voice/audio is transcribed and persisted.
3. The transcript is set as `msg.text`.
4. Group messages route to `telegram-router`.
5. `telegram-router` sends inert recent history plus one actionable final user turn to `chat`.
6. `chat` generates tool XML, filters stale tool calls against the latest turn, and only then executes or queues the remaining tools.
7. Telegram receives one natural reply plus any new confirmations that came from the latest message only.

## Error Handling

- If transcription fails, keep the existing "couldn't understand" response.
- If the replay guard drops a likely stale tool call, do not show a confirmation for it.
- If the latest message is long but not actionable, reply conversationally or "Got it" without surfacing old confirmations.

## Testing

Add focused tests where possible:

- Group actionable detector still treats voice-transcript-like German requests as actionable.
- Latest-turn replay guard allows a current event/task request.
- Latest-turn replay guard blocks an old event/task request when the latest message is unrelated long prose.

Manual verification:

- Send a group voice note: "In den Kalender eintragen, jeden Donnerstag ...".
- Confirm that Dori echoes the transcript and then queues/executes the intended current action.
- Paste a long non-actionable text after old pending calendar requests.
- Confirm no old confirmations are re-sent.
