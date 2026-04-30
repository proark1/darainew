## Goal

Make sure Dori on Telegram handles the 30 most common things a user would actually type or say. I brainstormed the scenarios first, *then* mapped each one against the current code in `telegram-router/index.ts`, `telegram-poll/index.ts`, `chat/index.ts` and the AI tools in `_shared/dori-tools.ts`.

## The 30 scenarios — current status

Legend: ✅ works · ⚠️ works but has a gap · ❌ missing

### Tasks & reminders
1. ✅ "Add task: pick up dry cleaning Friday" → `manage_task` tool
2. ✅ "/add buy birthday card" → forced-route shortcut
3. ✅ "Remind me to call mom at 7pm" → `set_reminder` tool
4. ✅ "What do I have today?" / "/today" → tappable agenda
5. ✅ "Mark dentist task as done" → `manage_task` complete
6. ✅ "Delete the gym task" → `manage_task` delete
7. ⚠️ "Move the dentist appointment to Friday 3pm" — `manage_event` exists, but the recent fix for the "old title" bug only covers title; **date/time updates still echo stale fields back from the search match**. Needs verification.
8. ❌ "What are my overdue tasks?" — no dedicated handler; `/me` shows a count but not the list. Falls to AI which may or may not query correctly.

### Calendar & meetings
9. ✅ "/tomorrow" / "What's tomorrow?" → tappable agenda (regex shortcut)
10. ✅ "Show me the calendar" / "next meetings" → handled by recent regex shortcut
11. ✅ "Schedule meeting with @alice @bob for 30m" → `/schedule` slot finder
12. ❌ "When am I free Thursday afternoon?" — no free-time query in private/family chat (only `/schedule` in workspace groups)
13. ⚠️ "Create a recurring weekly event for Monday standup" — `recurrenceRule` field exists, but no test scenario verifies RRULE parsing for natural-language input

### Shopping & household
14. ✅ "Add milk to shopping" / "/buy bread" → `add_shopping_item`
15. ✅ "/shopping" → tappable list
16. ❌ "Remove eggs from shopping" — no shopping-remove tool listed; only ☑️ keyboard. Plain-text "remove eggs" falls to AI with no matching tool.
17. ❌ "Clear the shopping list" — no bulk-clear path

### Notes & memory
18. ✅ "/note Idea: pitch deck for X" → `manage_note`
19. ✅ "Remember that I prefer morning meetings" → `learn_preference`
20. ⚠️ "What did I note about the Berlin trip?" — relies on AI semantic search; no `/notes <query>` shortcut

### Contacts & contracts & assets
21. ✅ "/contacts Sarah" → contact search
22. ✅ "/birthdays" → upcoming
23. ✅ "/contracts" / "/expiring" → tappable rows
24. ✅ "/properties" / "/vehicles" → list

### Email
25. ✅ "/inbox" / "/actions" → priority categories
26. ⚠️ "Draft a reply to John's email about the invoice" — `compose_email` / `send_email` tools exist but not exposed via `/email` and not discoverable; relies entirely on AI choosing the right action

### Health, mood, Islam, settings
27. ✅ "/health" / "/checkin" → today's metrics
28. ✅ "/prayers" → prayer times
29. ✅ "/quiet on" / "/voice on" → settings toggle
30. ✅ "/undo" → recent action reversal

### Cross-cutting interaction patterns
- ✅ Bare "yes" / "ja" / "no" confirmation of queued actions
- ✅ Inline keyboard ✅/❌ on queued actions, ↩️ undo button
- ✅ Voice notes (mentioned in HELP_TEXT, handled via poll)
- ✅ Photo intake (receipts, business cards)
- ⚠️ Multi-turn context: only last 30 minutes of `telegram_messages` + `telegram_assistant_replies` is fed back. **Long pauses lose context** and the AI may re-ask things.

## Gaps to fix (priority order)

1. **Event update echoing stale time/location** (#7) — extend the `manage_event` update merge so date/time/location updates use the new value (same pattern as the `updatedTitle` fix), not the matched row's old value, in `chat/index.ts`.
2. **`/overdue` handler** (#8) — quick DB-driven list of overdue tasks across the household, with the same tappable card pattern as `/today`.
3. **Shopping remove via natural language** (#16) — add a `remove`/`clear` action to `add_shopping_item` (rename to `manage_shopping`) so "remove eggs" / "clear shopping list" works.
4. **Free-time query** (#12) — extend the regex shortcut block to recognize "when am I free <day>" and call `findTimeSlots` for the single user.
5. **Notes search** (#20) — add `/notes <query>` shortcut that ILIKE-searches `notes.title` and `notes.body`.
6. **Email reply discovery** (#26) — extend HELP_TEXT and add a `/draft <subject-fragment>` shortcut that runs `email-draft-reply` against the most recent matching email.
7. **Recurring event sanity** (#13) — add a smoke-test RRULE example in the system prompt so the model emits valid RRULE for "every Monday", "weekdays at 9".
8. **Conversation memory window** — bump the lookback in `telegram-router` from 30 min to 6 hours and cap turns at 12 (already capped).

## Technical notes

- All fixes live in `supabase/functions/telegram-router/index.ts`, `supabase/functions/chat/index.ts`, and `supabase/functions/_shared/dori-tools.ts`. No DB migration needed — existing `tasks`, `notes`, `shopping_list_items`, `events` tables already cover these cases.
- The new tappable handlers reuse `buildTaskRowKeyboard` / `tgSendWithKeyboard`.
- For the event-update fix, the merge happens where `manage_event` writes back the row in `chat/index.ts` — same area as the recent `updatedTitle` change.
- After the fixes I'll deploy `telegram-router` and `chat`, then call each new shortcut via `supabase--curl_edge_functions` against the staging chat to confirm responses.

## Out of scope

- Voice/STT changes (already working via existing `telegram-voice.ts`)
- Group/workspace permission changes
- Any new database tables
