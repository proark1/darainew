
# Fix Sender Display in Email Overview and Detail View

## Problem
1. **Email overview list**: Each email shows only the sender's initials in a circle avatar, making it hard to identify senders at a glance. The full name appears next to it but the avatar dominates visually.
2. **Email detail view**: The sender section shows a large initials circle, then name and email below it -- the layout makes the initials too prominent and the name/email separation unclear.

## Changes

### 1. Email Overview List (`src/components/email/EmailCard.tsx`)

The initials avatar circle (lines 150-158) is currently a 9x9 circle showing just 1-2 letters. This is what the user sees as "just the first letter." The name does appear next to it (line 168-169) but the avatar circle is the dominant visual element.

**Fix**: Keep the avatar circle smaller (reduce from w-9 h-9 to w-7 h-7) and ensure the sender name text is more prominent. The sender name on line 168 already shows the full name -- but it may wrap or get cut. Ensure it displays clearly with enough space.

### 2. Email Detail View (`src/components/email/EmailDetailSheet.tsx`)

The sender info section (lines 288-301) currently shows:
- A large 10x10 initials circle
- Name on one line, email on the next (both truncated)

**Fix**:
- Reduce the avatar circle size (w-10 h-10 to w-8 h-8) so it doesn't dominate
- Make sender name clearly bold and larger (text-sm font-semibold)
- Show email on a separate line with distinct styling (text-xs text-muted-foreground)
- Remove truncation so both name and email are fully visible

### 3. Thread Messages (`src/components/email/EmailDetailSheet.tsx`, lines 71-80)

Same fix for the thread message sender display -- show name prominently, email below it separately.

## Files Modified
- `src/components/email/EmailCard.tsx` -- Reduce avatar size, ensure name is prominent
- `src/components/email/EmailDetailSheet.tsx` -- Restyle sender info: name on top (bold), email below (lighter), smaller avatar; same for thread messages
