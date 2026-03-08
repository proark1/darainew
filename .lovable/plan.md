

# Wave 6: AI Memory & "Handle Everything" Intelligence Upgrade

## Analysis

The platform already has massive breadth (tasks, calendar, contacts, contracts, family, health, habits, email, notes, shopping). The AI assistant (Dori) can manage most of these via tools in both text and voice modes. However, three critical gaps prevent the "handle your whole life" vision:

1. **AI Memory is dead code** — `useAIMemory` hook exists, `ai_memory` table exists, but memories are never read, written, or injected into AI prompts. The assistant forgets everything between sessions. If the user says "I prefer morning meetings" or "my wife picks up the kids on Tuesdays", that knowledge is lost.

2. **No automatic memory extraction** — The AI never learns from conversations. It should detect preferences, facts, and patterns from chat and save them automatically.

3. **No memory recall in prompts** — Even if memories existed, neither the `chat` nor `gemini-live` edge functions receive or use them.

## Plan

### 1. Wire AI Memory into the Chat Flow (Client Side)
**Files:** `src/components/layout/StandardMode.tsx` or wherever DoriPanel receives its props, plus the component that calls the chat function.

- Import `useAIMemory` and call `getMemoriesForContext()`
- Pass memories as a new field in the chat request body alongside existing context

### 2. Inject Memories into Chat System Prompt (Edge Function)
**File:** `supabase/functions/chat/index.ts`

- Accept new `memories` field in `ChatRequest` interface
- Add a `## LONG-TERM MEMORY` section to the system prompt containing the user's stored memories (preferences, facts, patterns, goals, milestones)
- Instruct the AI to reference these memories naturally and to extract new ones

### 3. Auto-Extract Memories from Conversations (Edge Function)
**File:** `supabase/functions/chat/index.ts`

- Add a new tool `save_memory` to the system prompt so the AI can proactively store facts
- Tool format: `<tool>save_memory</tool><memory>{"type": "preference|fact|pattern|goal", "key": "short_key", "value": "what to remember"}</memory>`
- Instruct the AI: "When the user shares personal preferences, routines, facts about their life, or recurring patterns, use save_memory to remember them for future conversations"

### 4. Parse & Persist Memory Tool Calls (Edge Function + Client)
**File:** `supabase/functions/chat/index.ts` — parse `save_memory` tool calls from AI response and write to `ai_memory` table server-side (using service role client, since we already have it)
**File:** Client-side — no changes needed if we save server-side

### 5. Inject Memories into Voice Mode Too
**File:** `supabase/functions/gemini-live/index.ts`

- Accept `memories` field in request
- Add memory context to the system prompt, same pattern as chat

### 6. Pass Memories from Voice Mode Client
**File:** `src/hooks/useGeminiLive.ts` (and/or the OpenAI realtime hook if that's the primary voice path)

- Accept memories in options, pass to edge function

## Technical Details

### Memory Injection Format (added to system prompt)
```
## LONG-TERM MEMORY (Things you've learned about this user)
- [preference] morning_meetings: "User prefers meetings before 11am"
- [fact] wife_schedule: "Wife teaches evenings on Tue/Thu"
- [pattern] energy_dip: "User reports low energy after 2pm"
- [goal] health: "Wants to reach 10k steps daily"
```

### New Tool Definition (added to chat system prompt)
```
TOOL: save_memory
Use to remember important facts, preferences, or patterns about the user.
Format: <tool>save_memory</tool><memory>JSON_OBJECT</memory>
Fields:
- "type": "preference" | "fact" | "pattern" | "goal" | "milestone"
- "key": short unique key (snake_case)
- "value": what to remember
- "category": optional grouping (e.g. "health", "family", "work")

Use this when:
- User states a preference ("I like...", "I prefer...", "I always...")
- User shares a personal fact ("My wife's name is...", "I work from...")
- You notice a behavioral pattern
- User sets or achieves a goal
```

### Server-Side Memory Persistence
In the response parsing section of `chat/index.ts`, detect `<tool>save_memory</tool>` blocks and upsert into `ai_memory` table using the service role client. This avoids any client-side complexity.

## Files Modified Summary
- `supabase/functions/chat/index.ts` — memory injection in prompt, save_memory tool, server-side persistence
- `supabase/functions/gemini-live/index.ts` — memory injection in prompt
- `src/hooks/useGeminiLive.ts` — pass memories to edge function
- `src/components/layout/StandardMode.tsx` (or relevant parent) — wire useAIMemory, pass to chat
- `src/lib/smartPayloadBuilder.ts` — add memories to smart payload

