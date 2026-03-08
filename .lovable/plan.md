

# Wave 7: AI as the Single Control Center

## Analysis

The AI assistant already has impressive breadth: 13+ tools (tasks, events, contacts, contracts, projects, habits, notes, shopping, email), full context injection (profile, family, health, emails, notes), memory persistence via `save_memory`, and both text + voice modes.

**What's missing to make Dori truly "handle everything":**

1. **Conversation history is not sent to the AI** — `useAssistantConversations` stores messages in the DB, but the `streamChat` call only sends the current session's messages. The AI has no memory of past conversations beyond what's in `ai_memory`. If the user said something 2 days ago, the AI can only recall it if it happened to `save_memory` it.

2. **No financial intelligence** — The user can't ask "How much am I spending per month?" and get a computed answer. The `get_summary` tool exists in the prompt but the client doesn't actually handle the `contract_costs` type to compute totals.

3. **No web search / general knowledge augmentation** — When the user asks "What's the best school in my area?" or "How do I fix a leaking faucet?", Dori can only use its training data. Adding a web search tool would make it truly useful for "all questions."

4. **No reminder/alarm tool** — The user can't say "Remind me in 30 minutes to take the laundry out" and get a push notification. Tasks with due dates exist but not quick timed reminders.

5. **No image understanding** — The user can't send a photo of a receipt, document, or whiteboard and have Dori process it.

## Plan: 3 High-Impact Improvements

### 1. Conversation Context Window (Last N messages from DB)
Load the last 10 messages from the most recent conversation and prepend them to the messages array sent to the AI. This gives Dori short-term cross-session memory without massive token costs.

**File:** `src/pages/Index.tsx` (or wherever `streamChat` is called)
- Before calling `streamChat`, fetch last 10 messages from `assistant_messages` via the existing `useAssistantConversations` hook
- Prepend them as `{ role, content }` to the messages array
- Add a `[Previous conversation context]` separator so the AI knows these are from earlier

### 2. Quick Reminder Tool (Timed Notifications)
Add a `set_reminder` tool so the user can say "Remind me in 20 minutes" or "Remind me at 3pm to call the dentist."

**File:** `supabase/functions/chat/index.ts` — add tool definition
```
TOOL: set_reminder
Format: <tool>set_reminder</tool><reminder>{"message": "...", "triggerAt": "ISO_DATE"}</reminder>
```

**File:** `src/hooks/useAIChat.ts` — parse `set_reminder` tool calls
**File:** `src/pages/Index.tsx` — handle the tool call by scheduling a local notification via `useAppNotifications` or inserting into `user_notifications` table with a scheduled time

### 3. Smart Financial Summary Tool
Make `get_summary` → `contract_costs` actually work by computing totals from contracts data client-side when the AI requests it.

**File:** `src/pages/Index.tsx` — in the tool call handler for `get_summary`, compute monthly/yearly totals from contracts and feed back into the conversation as a system message so the AI can present the data.

## Files Summary
- `src/pages/Index.tsx` — conversation context loading + reminder handler + financial summary handler
- `supabase/functions/chat/index.ts` — `set_reminder` tool definition in system prompt
- `src/hooks/useAIChat.ts` — parse `set_reminder` tool calls

