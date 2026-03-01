

# Email Hub -- Full Reading Experience & Smart Categorization

## What Changes

Two core upgrades plus several quality-of-life improvements that make the email tool feel like a complete, intelligent email client.

---

## 1. Full Email Body Visible on Open (No Toggle)

Right now the email body loads but is hidden behind a "Show full email" button with a 200px max-height. We'll change this so the full email is immediately visible when you open an email -- no extra taps.

**Changes:**
- Remove the `showFullBody` toggle and `max-h-[200px]` constraint
- Show the full HTML body directly in a clean, styled container
- Add a proper loading skeleton while the body fetches
- Sanitize HTML properly to prevent style bleed from email content (scope styles to the email container)

---

## 2. Manual Priority Categorization (Trains the AI)

When you open an email, you'll see priority buttons to manually categorize it. Your choices get saved as sender rules so the system learns over time.

**How it works:**
- Add a row of priority buttons in the detail sheet: **High**, **Medium**, **Low**, **Spam**
- Tapping one updates the email's `priority_score` and `category` immediately
- Also creates/updates a sender rule for that sender's domain (or exact email) so future emails from them are auto-categorized the same way
- Visual feedback: the selected priority lights up with color coding (red = high, amber = medium, gray = low, destructive = spam)

**Priority mapping:**
- High Priority -> priority_score: 1, category: action_required
- Medium Priority -> priority_score: 3, category: fyi
- Low Priority -> priority_score: 5, category: newsletter
- Spam -> is_spam: true, user_archived: true (removes from inbox)

---

## 3. Additional Improvements

### Compose New Email
- Add a "Compose" floating button on the email panel
- Opens a simple compose sheet with To, Subject, Body fields
- AI can suggest subject lines based on body content
- Sends via the existing Gmail API integration

### Quick Category Chips on Email Cards
- Show the current priority as a small colored dot on each card in the list
- Users can see at a glance what they've already categorized

### Undo Archive Toast
- When archiving, show an undo toast (5 seconds) that lets you bring the email back

### Thread View in Detail Sheet
- When opening a threaded email (thread count > 1), show all messages in the conversation stacked vertically
- Each message shows sender, timestamp, and body
- Most recent message at top

---

## Technical Plan

### Files to Modify

**`src/components/email/EmailDetailSheet.tsx`**
- Remove `showFullBody` state and the toggle button
- Remove `max-h-[200px]` constraint on body container
- Add scoped CSS wrapper for HTML email content (prevent style bleed)
- Add loading skeleton while body fetches
- Add priority categorization row: 4 buttons (High / Medium / Low / Spam)
- Each button calls a new `onCategorize` callback
- Show thread messages when thread has multiple emails
- Add compose reply at bottom always visible (not hidden behind button)

**`src/hooks/useEmails.ts`**
- Add `categorizeEmail(emailId, priority)` function that:
  - Updates the email's priority_score and category
  - Creates a sender rule for the domain
- Add `composeEmail(to, subject, body)` function
- Add `undoArchive` with temporary state tracking
- Pass thread's `allEmails` to detail sheet

**`src/components/email/EmailPanel.tsx`**
- Pass thread object (not just latest email) to detail sheet
- Add compose FAB button
- Show undo toast on archive with restore action

**`src/components/email/EmailCard.tsx`**
- Add small priority indicator dot based on priority_score

**`supabase/functions/gmail-send-reply/index.ts`**
- Extend to support composing new emails (not just replies) by making threadId optional

### Database
- No schema changes needed -- uses existing `email_sender_rules` table and `user_emails` columns

### New Component
**`src/components/email/ComposeEmailSheet.tsx`**
- Drawer/sheet with To, Subject, Body fields
- "AI Suggest Subject" button
- Send button using gmail-send-reply function
- Clean, minimal design matching the rest of the email UI

