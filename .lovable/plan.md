

# Incremental Email Sync: Only Fetch New Emails

## Problem

Currently, every sync fetches the latest 30 messages from Gmail, downloads metadata for all of them, runs AI analysis on up to 20, and upserts everything -- even emails already stored in the database. This is wasteful and slow.

## Solution

Use Gmail's History API for incremental sync. Gmail assigns a `historyId` to every message. By storing the last `historyId`, subsequent syncs only fetch changes (new messages, label changes) since that point.

## Changes

### 1. Database Migration: Add `gmail_history_id` column

Add a `gmail_history_id` text column to `external_calendar_connections` to store the Gmail sync cursor per user's Google connection.

```sql
ALTER TABLE external_calendar_connections
ADD COLUMN gmail_history_id text;
```

### 2. `supabase/functions/gmail-sync/index.ts` -- Incremental sync logic

**Current flow** (every sync):
1. List 30 messages from INBOX
2. Fetch metadata for all 30
3. AI analyze up to 20
4. Upsert all 30

**New flow:**

1. Check if `gmail_history_id` exists on the connection
2. **If yes (incremental sync):**
   - Call `GET /gmail/v1/users/me/history?startHistoryId={id}&historyTypes=messageAdded&labelId=INBOX`
   - Extract only new message IDs from `messagesAdded`
   - If no new messages, return early with `{ synced: 0 }`
   - Fetch metadata only for new messages
   - AI analyze only new messages
   - Upsert only new messages
   - If history is expired (404/invalid), fall back to full sync
3. **If no (first sync / fallback):**
   - Do current full sync (fetch latest 30)
4. **After sync:** Get the latest `historyId` from Gmail profile and save it to the connection

**Getting the historyId:**
- Call `GET /gmail/v1/users/me/profile` which returns `{ historyId: "12345" }`
- Store it in `external_calendar_connections.gmail_history_id`

### 3. `src/hooks/useEmails.ts` -- Minor improvements

- The client already loads emails from the database first (line 61-79), which is correct -- cached emails show instantly
- Sync only fetches/processes new ones server-side
- Add the new email count from sync response to show "3 new emails" instead of "Synced 30 emails"
- Update toast message to reflect incremental behavior

### 4. `useEmails.ts` -- Increase fetch limit

Currently limited to 100 emails. Since all emails are now persisted in the cloud, increase to 200 or add pagination for older emails.

## Technical Flow

```text
First sync:
  Client -> gmail-sync -> Gmail API (list 30) -> AI analyze -> upsert -> save historyId

Subsequent syncs:
  Client -> gmail-sync -> Gmail History API (only changes) -> fetch new only -> AI analyze new only -> upsert new -> update historyId

History expired (rare):
  Client -> gmail-sync -> History API returns 404 -> fallback to full sync -> save new historyId
```

## Files to Modify

1. **Database migration** -- Add `gmail_history_id` column to `external_calendar_connections`
2. **`supabase/functions/gmail-sync/index.ts`** -- Add History API logic, save/read historyId, skip already-synced emails
3. **`src/hooks/useEmails.ts`** -- Update toast messages, increase fetch limit

## Benefits

- Syncs complete in under 1 second when no new emails (vs 5-10s currently)
- No redundant AI analysis calls (saves API credits)
- All historical emails stay in cloud database permanently
- Client loads instantly from database cache, sync only adds new ones

