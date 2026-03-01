

# Gmail Integration: Smart Email Management

## Overview
Connect your Gmail account to DarAI so emails are automatically fetched, prioritized based on your existing contacts, and intelligently categorized over time. You'll get proactive notifications for important emails without having to check your inbox constantly.

## How It Works

1. **Connect Gmail** -- Uses the same Google OAuth system already in place for Calendar, extended with Gmail read permissions
2. **Auto-Prioritize** -- Emails from people in your contacts are flagged as priority. Known contacts with "family" or "close_friend" tier get highest priority
3. **Smart Categories** -- AI analyzes email subjects and senders to categorize (Action Required, FYI, Newsletters, Promotions, etc.)
4. **Learn Over Time** -- When you mark emails as important/dismiss them, the system learns your preferences
5. **Notifications** -- Priority emails trigger in-app notifications immediately

## Architecture

```text
Gmail API  -->  [gmail-sync edge function]  -->  emails table
                                                    |
                                            [contact matching]
                                                    |
                                            [AI categorization]
                                                    |
                                            [notifications]
```

## Implementation Plan

### 1. Database: Create emails table and preferences
- `user_emails` table: stores synced emails (sender, subject, snippet, date, labels, is_read, priority_score, category, contact_id if matched)
- `email_preferences` table: stores learned rules (sender patterns, category overrides, priority overrides)
- RLS policies so each user only sees their own emails

### 2. Extend Google OAuth for Gmail scope
- Modify `calendar-oauth-start` to include `gmail.readonly` scope alongside calendar scopes
- Store the same tokens (they already support multiple scopes)
- Create a new `gmail-oauth-start` edge function for Gmail-only connections if calendar isn't connected

### 3. Create `gmail-sync` edge function
- Fetches recent emails from Gmail API using stored OAuth tokens
- Matches sender email against `user_contacts` table to find known contacts
- Assigns priority score: contacts get high priority, unknown senders get lower
- Uses AI (Gemini Flash) to categorize emails into: Action Required, Waiting, FYI, Newsletter, Promotion
- Stores results in `user_emails` table
- Creates notifications for high-priority emails

### 4. Create `EmailPanel` component
- New panel accessible from the "More" sheet and sidebar
- Shows emails grouped by priority: Priority (from contacts), Action Required, Other
- Each email shows: sender name/avatar (linked to contact if matched), subject, snippet, time
- Tap to expand full email preview
- Swipe actions: Archive, Snooze, Mark Important
- Filter tabs: All, Priority, Action Required, FYI

### 5. Contact-Based Priority System
- When emails sync, sender email is matched against `user_contacts.email`
- If matched: priority is based on contact tier (family/close_friend = P1, friend = P2, business = P3)
- If not matched but from same domain as a known contact: medium priority
- Unknown senders: low priority, AI categorizes

### 6. AI Learning System
- Track user actions (mark important, archive, snooze) in `email_preferences`
- Over time, build sender-level and pattern-level rules
- Example: "Emails from *@company.com are always Action Required"
- Example: "Emails with 'invoice' in subject are always Priority"
- AI uses these learned preferences when categorizing new emails

### 7. Proactive Notifications
- High-priority emails (from contacts) trigger immediate in-app notification
- Morning briefing includes email summary ("You have 3 priority emails")
- Dashboard shows email count pill in StatPills

## Technical Details

### Files to Create
- `src/components/email/EmailPanel.tsx` -- Main email management UI
- `src/components/email/EmailCard.tsx` -- Individual email display component
- `src/components/email/EmailDetailSheet.tsx` -- Full email view in bottom sheet
- `src/hooks/useEmails.ts` -- Hook for fetching/managing emails
- `src/hooks/useGmailConnection.ts` -- Hook for Gmail OAuth connection
- `supabase/functions/gmail-sync/index.ts` -- Edge function to sync emails from Gmail API
- `supabase/functions/gmail-oauth-start/index.ts` -- OAuth flow for Gmail scopes

### Files to Modify
- `src/components/layout/MoreSheet.tsx` -- Add Email icon to the navigation grid
- `src/components/layout/Sidebar.tsx` -- Add Email to Business group with unread badge
- `src/components/layout/MobileLayout.tsx` -- Register email panel
- `src/components/layout/StandardMode.tsx` -- Register email panel for desktop
- `src/components/dashboard/StatPills.tsx` -- Add email count pill
- `src/components/dashboard/DashboardHero.tsx` -- Include email summary in greeting
- `src/contexts/LanguageContext.tsx` -- Add translation keys for email features

### Database Tables (via migration)

**`user_emails`**
- id, user_id, gmail_message_id (unique), thread_id
- from_email, from_name, to_email, subject, snippet, body_preview
- received_at, is_read, is_starred, gmail_labels (text array)
- matched_contact_id (FK to user_contacts, nullable)
- priority_score (1-5), category (action_required, waiting, fyi, newsletter, promotion, other)
- user_archived, user_snoozed_until, is_important (user override)
- created_at, updated_at

**`email_sender_rules`**
- id, user_id, sender_pattern (e.g. "*@company.com" or "person@email.com")
- default_category, default_priority, auto_archive
- learned_from_count (how many actions informed this rule)
- created_at, updated_at

### Key Design Decisions
- Gmail API is read-only (gmail.readonly scope) -- no sending/deleting from DarAI
- Emails sync on demand + periodic background sync via the existing notification system
- AI categorization uses Gemini Flash (fast, cheap) for subject/sender analysis
- Contact matching is done server-side during sync for efficiency
- Tokens are reused from the existing Google OAuth infrastructure (same client ID/secret)

