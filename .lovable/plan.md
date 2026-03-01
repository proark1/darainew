
# Email Hub -- Next-Level Upgrades

## Overview

Here are the most impactful improvements we can make across personalization, automation, and UI/UX, building on the solid AI-powered foundation already in place.

---

## 1. Sender Rules & Auto-Learning

**What it does:** Let you teach the email system your preferences. Swipe to archive a newsletter once, and it auto-archives future emails from that sender. Set per-sender rules like "always mark as FYI" or "always priority."

**How it works:**
- New `email_sender_rules` table storing sender patterns (exact email or `*@domain.com`), default category, default priority, and auto-archive flag
- When you archive or report spam, the system offers "Always do this for emails from [sender]?"
- Gmail sync checks sender rules before AI analysis, saving AI calls for truly unknown senders
- A simple Sender Rules management screen in Settings

---

## 2. Swipe Gestures on Email Cards

**What it does:** Quick actions without opening the email -- swipe right to archive, swipe left to mark important. Feels native and fast.

**How it works:**
- Add touch gesture handling to `EmailCard` using `framer-motion` (already installed)
- Swipe right: archive with undo toast
- Swipe left: toggle important
- Smooth spring animations with color-coded reveal backgrounds (green for archive, gold for important)

---

## 3. Email Snooze

**What it does:** "Not now, remind me later." Snooze an email to reappear at a specific time -- tomorrow morning, next Monday, or custom.

**How it works:**
- Add `user_snoozed_until` column (already exists in the Email interface but not used in UI)
- Snooze button in email detail sheet with preset options (Later Today, Tomorrow 9am, Next Monday, Custom)
- Snoozed emails hidden from inbox, reappear when snooze expires
- Snoozed section in Smart Inbox showing upcoming snoozes

---

## 4. Auto-Sync on a Schedule

**What it does:** Stop manually syncing. Emails auto-sync every time you open the Email panel if it has been more than 5 minutes since the last sync.

**How it works:**
- Store `lastSyncTime` in localStorage
- On panel mount, check if > 5 min elapsed, auto-trigger sync
- Show subtle "Last synced 3 min ago" text instead of requiring manual tap
- Pull-to-refresh gesture as secondary sync trigger

---

## 5. Email Digest in Morning Briefing

**What it does:** Your existing Morning Briefing already covers weather, tasks, and events. Add a quick email summary: "You have 3 priority emails and 12 newsletters. One urgent from [contact name]."

**How it works:**
- Fetch email counts (priority, unread, flagged) in the morning briefing edge function
- Add an email section to the briefing output
- One-liner AI summary of the most important unread email

---

## 6. Quick Reply Drafts (AI-Generated)

**What it does:** For "Reply needed" emails, show an AI-generated draft reply button. One tap to see a suggested response you can copy and send in Gmail.

**How it works:**
- New "Draft Reply" button in EmailDetailSheet for action_required emails
- Calls an edge function that sends the email context + your profile to AI
- Returns a short, professional draft matching your communication style
- Copy-to-clipboard button + "Open in Gmail" to paste and send

---

## 7. Unread Badge on Navigation

**What it does:** Show unread/priority email count as a badge on the Email nav item so you know at a glance without opening the panel.

**How it works:**
- Expose email counts from `useEmails` to the navigation/sidebar
- Small red dot or number badge on the Email icon in the bottom nav or sidebar

---

## 8. Thread Grouping

**What it does:** Group emails by `thread_id` so you see conversations together instead of individual messages. Shows "3 messages" with the latest snippet.

**How it works:**
- Group emails with the same `thread_id` in the hook's grouping logic
- Show the most recent email in the thread as the card, with a "thread count" badge
- Expanding a thread in the detail sheet shows all messages in order

---

## Recommended Priority

For maximum impact with the least effort, I'd recommend this order:

1. **Swipe gestures** -- instant UX upgrade, uses existing framer-motion
2. **Auto-sync** -- removes friction, simple localStorage check
3. **Sender rules with auto-learn** -- makes the system smarter over time
4. **Snooze** -- column already exists, just needs UI
5. **Unread badge on nav** -- small but high-visibility improvement
6. **Quick reply drafts** -- leverages existing AI infrastructure
7. **Thread grouping** -- moderate complexity, great UX payoff
8. **Morning briefing integration** -- connects email to your daily routine

## Technical Details

### New Database Table (for Sender Rules)
```text
email_sender_rules
  id              UUID PRIMARY KEY
  user_id         UUID NOT NULL (references auth.users)
  sender_pattern  TEXT NOT NULL (e.g. "newsletter@company.com" or "*@company.com")
  default_category TEXT
  default_priority INTEGER
  auto_archive    BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ DEFAULT now()
  UNIQUE(user_id, sender_pattern)
  RLS: user_id = auth.uid()
```

### Files to Create/Modify
- `src/components/email/EmailCard.tsx` -- add swipe gesture layer
- `src/components/email/EmailPanel.tsx` -- auto-sync logic, snooze section, pull-to-refresh
- `src/components/email/EmailDetailSheet.tsx` -- snooze picker, draft reply button, sender rule prompt
- `src/hooks/useEmails.ts` -- snooze filtering, thread grouping, sender rule creation
- `supabase/functions/gmail-sync/index.ts` -- apply sender rules before AI analysis
- `supabase/functions/email-draft-reply/index.ts` -- new edge function for AI reply drafts
- Navigation components -- unread badge integration
- Database migration -- `email_sender_rules` table

Would you like me to implement all of these, or would you prefer to pick specific ones to start with?
