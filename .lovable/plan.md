

# Email Send Confirmation Gate

## Problem
Voice mode and text mode AI can send emails **immediately** without any user confirmation. This is dangerous -- an AI misunderstanding could send an embarrassing or wrong email. You want a mandatory "click Send to approve" step before any email leaves your account.

## Solution
Instead of sending emails directly, both voice mode and text mode will **draft the email** and open the Compose Sheet pre-filled with the recipient, subject, and body. You then review and click Send (or discard it).

## Changes

### 1. Voice mode: Draft instead of send (`src/hooks/useOpenAIRealtime.ts`)

**Current behavior:** `reply_to_email` and `compose_new_email` tool calls invoke `gmail-send-reply` directly.

**New behavior:** Both tools will dispatch a `compose-email` custom event with the draft data (to, subject, body, threadId, gmailMessageId) instead of calling the edge function. The AI will respond with "I've prepared the draft -- please review and hit Send."

- `reply_to_email`: Still fuzzy-matches the email, but instead of sending, dispatches the draft event
- `compose_new_email`: Same -- dispatches draft event instead of sending

### 2. Text mode: Already dispatches event (minor cleanup) (`src/pages/Index.tsx`)

Text mode already dispatches `compose-email` events -- this path is correct. No major changes needed, just ensure consistency.

### 3. Email Panel: Listen for compose-email events (`src/components/email/EmailPanel.tsx`)

**Current behavior:** The `compose-email` custom event is dispatched but never listened to by EmailPanel.

**New behavior:** Add a `useEffect` in EmailPanel that listens for the `compose-email` event, pre-fills the ComposeEmailSheet fields, and opens it automatically.

### 4. ComposeEmailSheet: Support pre-filled values and reply metadata (`src/components/email/ComposeEmailSheet.tsx`)

**Current behavior:** Only supports new emails (to, subject, body).

**New behavior:** Accept optional `initialTo`, `initialSubject`, `initialBody`, `threadId`, and `gmailMessageId` props. When the sheet opens with pre-filled data, those fields are populated. The `onSend` callback passes threadId/gmailMessageId through so replies thread correctly.

## Result
- No email is ever sent without you clicking "Send"
- Voice assistant says "I've drafted the reply, please review and send it"
- Text assistant opens the compose sheet with the draft
- You can edit, delete, or send the draft

## Files to Modify
1. `src/hooks/useOpenAIRealtime.ts` -- Replace direct sends with `compose-email` event dispatch
2. `src/components/email/EmailPanel.tsx` -- Add event listener to open ComposeEmailSheet on `compose-email` events  
3. `src/components/email/ComposeEmailSheet.tsx` -- Support initial values and reply threading metadata
4. `src/pages/Index.tsx` -- Minor: ensure compose-email event detail includes threadId/gmailMessageId for text mode replies
