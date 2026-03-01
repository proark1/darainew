
# DarAI Assistant -- Intelligent Context Injection (Token-Efficient)

## Problem

The assistant currently receives tasks, events, and health data every message -- but has zero access to user profile, contacts, contracts, family, emails, notes, or habits. Sending all of this every time would be wasteful. We need a smart pre-filter that only injects what's relevant to the current message.

## Solution: Two-Tier Context Architecture

### Tier 1: Always Send (Tiny, ~200 tokens)
These are small and always useful:
- **User profile** (name, role, businesses, location, goals) -- ~80 tokens
- **Stats summary** (counts only: "62 contacts, 14 contracts, 5 unread emails, 3 active habits") -- ~30 tokens
- Already-sent data: tasks, events, health (unchanged)

### Tier 2: Smart-Filtered (Only When Relevant)
Use keyword detection on the user's message to decide what extra context to inject:

| Trigger Keywords | Data Injected |
|---|---|
| contact names, "who do I know", city names, "investor", "developer" | Filtered contacts (max 10) via existing `useSmartContext` |
| "contract", "subscription", "cost", "renewal", "how much" | Filtered contracts (max 10) |
| "email", "inbox", "unread", "mail", sender names | Top 5 unread emails (subject + sender + snippet only) |
| "note", "notes", "what did I write", "remember" | Top 5 recent notes (title + first 80 chars) |
| "habit", "streak", "routine", "consistency" | Active habits with streaks (max 10) |
| "family", "kids", child names, "school", "shopping list" | Full family context (members, events, lists) |
| "recipe", "meal", "cook", "dinner" | This week's meal plan |

This means a simple "add a task" message sends ~200 extra tokens. A "who do I know in Dubai?" message sends ~400 extra tokens with the 10 relevant contacts. Only "tell me everything" type questions get the full payload.

## How It Works

### New utility: `buildSmartPayload` in Index.tsx

A single function that:
1. Takes the user's message + all available data sources
2. Runs keyword matching (reuses `INTENT_KEYWORDS` and `LOCATIONS` from `useSmartContext`)
3. Returns only the relevant slices as a compact context object
4. Passes it to `streamChat`

### Keyword Detection Categories (new)

Extend the existing `useSmartContext` keyword system with:
- **email**: "email", "inbox", "unread", "mail", "message from", "reply to"
- **notes**: "note", "notes", "wrote", "saved", "remember"
- **habits**: "habit", "streak", "routine", "consistency", "daily"
- **family**: "family", "kids", "children", "school", "kindergarten", "wife", "husband", child names (dynamic)
- **shopping**: "shopping", "groceries", "buy", "shopping list"

## Technical Plan

### Files to Modify

**`src/pages/Index.tsx`**
- Import `useUserProfile`, `useFamilyMembers`, `useShoppingLists`, `useHabits`, `useEmails`
- In `handleSendMessage`, call a new `buildSmartPayload(userText, ...)` function that:
  - Always includes: userProfile, stats counts
  - Keyword-scans `userText` to decide which optional data to include
  - Filters contacts/contracts via `useSmartContext` logic (already exists)
  - Conditionally includes: emails (top 5 unread), notes (top 5 recent titles), habits (active with streaks), family context
- Pass the resulting payload fields to `streamChat`

**`src/hooks/useAIChat.ts`**
- Extend `streamChat` params to accept: `emailSummary`, `notesSummary`, `habitsSummary` (all optional lightweight arrays)
- Pass them through to the edge function

**`supabase/functions/chat/index.ts`**
- Extend `ChatRequest` interface with `emailSummary`, `notesSummary`, `habitsSummary`
- Add context sections when these are present:
  - Emails: "You have X unread emails. Top priorities: [subject from sender]..."
  - Notes: "Recent notes: [title snippets]..."
  - Habits: "Active habits: [name - X day streak]..."
- Add instructions in system prompt so the AI knows it can reference these

### Smart Payload Builder Logic (pseudocode)

```text
function buildSmartPayload(message, allData):
  payload = { userProfile, stats: { counts only } }
  
  lowerMsg = message.toLowerCase()
  
  // Always-on: profile + stats (tiny)
  // Conditional:
  if matches(email_keywords):   payload.emails = top5Unread
  if matches(note_keywords):    payload.notes = top5Recent  
  if matches(habit_keywords):   payload.habits = activeWithStreaks
  if matches(family_keywords):  payload.family = fullFamilyContext
  if matches(contact_keywords): payload.contacts = filteredContacts
  if matches(contract_keywords): payload.contracts = filteredContracts
  
  return payload
```

### Token Budget Estimates

| Scenario | Extra Tokens |
|---|---|
| Simple task command ("add a task") | ~200 (profile + stats only) |
| Contact query ("who in Dubai?") | ~400 (+ 10 contacts) |
| Email question ("any important emails?") | ~350 (+ 5 email summaries) |
| Family question ("what's the kids' schedule?") | ~500 (+ family context) |
| Everything question ("what's going on?") | ~1200 (all categories) |

### No database changes needed
All data sources already exist. This is purely about wiring existing hooks with smart filtering into the chat pipeline.
