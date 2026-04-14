

# Dori AI Assistant — Next-Level Improvements

## What's Already Strong
Dori has 15+ tools, streaming, web search, long-term memory, family/health/contact/contract awareness, and multi-tool chaining. The model was recently upgraded to `gemini-3-flash-preview`.

## Gaps Identified

### 1. No image understanding
Users can't send photos (receipts, screenshots, documents) to Dori. For a "real personal assistant," visual input is essential — snap a receipt, get it categorized; share a screenshot, get action items.

### 2. No file/document attachment in chat
The chat input only accepts text. There's no way to attach PDFs, images, or files for Dori to analyze.

### 3. Conversation persistence is fragile
Messages live in React state (`useState<ChatMessage[]>`). If the user navigates away or refreshes, the entire conversation is lost. Only the last 10 messages from a previous session are injected as context — the current session isn't saved until it's already gone.

### 4. No inline confirmation cards for tool actions
When Dori creates a task or event, it just shows a toast + text. A proper assistant would show an interactive confirmation card inline (e.g., a mini task card with "Edit" / "Undo" buttons).

### 5. Family context is incomplete when passed via smartPayload
In `Index.tsx` lines 580-599, family context from `smartPayload` strips out critical fields: `grade`, `teacherName`, `teacherContact`, `kindergarten`, `kindergartenTeacher`, `allergies`, `medicalNotes` are all set to `null/[]`. The full family data exists in `familyMembers` but isn't properly mapped.

### 6. No "thinking" transparency
When Dori reasons or searches the web, the user only sees bouncing dots. There's no indication of *what* Dori is doing ("Searching the web...", "Checking your calendar...", "Creating task...").

---

## Plan

### 1. Fix family context data loss
Map the full `familyMembers` data (school, grade, teachers, allergies, activities with schedules) into the `familyContext` payload instead of the current stripped-down version from `smartPayload`.

**File:** `src/pages/Index.tsx` (~lines 580-599)

### 2. Save conversations in real-time
Auto-save each message to the `assistant_conversations` / `assistant_messages` tables as it's sent/received, so conversations persist across refreshes and navigation. Load the current conversation on mount.

**Files:** `src/pages/Index.tsx`, `src/hooks/useAssistantConversations.ts`

### 3. Add inline action cards for tool results
After Dori executes a tool (task created, event scheduled, note saved), render an interactive card in the chat showing what was created with Edit/Undo actions — instead of just a toast notification.

**Files:** `src/components/assistant/DoriPanel.tsx`, `src/components/assistant/ActionCard.tsx` (new)

### 4. Add thinking status messages
Show contextual status text during processing: "Searching the web...", "Checking your tasks...", "Creating event..." based on detected intent and tool execution. Replace the generic bouncing dots with specific status.

**Files:** `src/components/assistant/DoriPanel.tsx`, `src/hooks/useAIChat.ts` (add `onStatus` callback)

### 5. Image attachment support
Add a camera/image button to the chat input. When the user attaches an image, upload it to storage and send it to the AI via the Gemini vision model (already supported by `gemini-3-flash-preview`). Enable receipt scanning, document reading, and screenshot analysis.

**Files:** `src/components/assistant/DoriPanel.tsx`, `supabase/functions/chat/index.ts`, `src/hooks/useAIChat.ts`

### 6. Smarter empty state with live data
Pass actual counts (overdue tasks, unread emails, habit streaks at risk) into `DoriPanel` so suggestions are data-driven: "You have 3 overdue tasks — want to reschedule?" instead of generic time-based prompts.

**Files:** `src/components/assistant/DoriPanel.tsx`, `src/components/layout/StandardMode.tsx` or `src/pages/Index.tsx`

---

## Summary

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| 1 | Fix family context data loss | High — Dori currently forgets kid details | Small |
| 2 | Real-time conversation persistence | High — no more lost chats | Medium |
| 3 | Inline action cards | High — visual feedback | Medium |
| 4 | Thinking status messages | Medium — better UX | Small |
| 5 | Image attachment + vision | High — new capability | Medium |
| 6 | Data-driven empty state | Medium — better first impression | Small |

