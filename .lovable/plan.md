
# Fix Sender Name Parsing and Display

## Root Cause
The Gmail sync edge function has a buggy regex for parsing the "From" header. The regex on line 276 of `gmail-sync/index.ts` uses a lazy quantifier (`.+?`) that causes it to capture only the first character of the sender's name in certain email header formats.

**Evidence from database:**
- `from_name: "L"`, `from_email: "inkedin job alerts <jobalerts-noreply@linkedin.com"`
- `from_name: "A"`, `from_email: "nthropic, pbc" <invoice+statements@mail.anthropic.com"`

The first character goes into `from_name` and the rest (including the actual email) goes into `from_email`.

## Changes

### 1. Fix the From header parser (`supabase/functions/gmail-sync/index.ts`, line 276)

Replace the broken regex with a more robust parser:

```typescript
const fromRaw = getHeader('From');
let fromName = '';
let fromEmail = '';
const angleMatch = fromRaw.match(/^(.*?)\s*<([^>]+)>$/);
if (angleMatch) {
  fromName = angleMatch[1].replace(/^"|"$/g, '').trim();
  fromEmail = angleMatch[2].toLowerCase().trim();
} else {
  // Plain email address, no angle brackets
  fromEmail = fromRaw.toLowerCase().trim();
  fromName = '';
}
```

This handles the standard formats:
- `"Name" <email@example.com>` -- quoted name
- `Name <email@example.com>` -- unquoted name
- `email@example.com` -- bare email

### 2. Add frontend fallback for existing corrupted data (`src/components/email/EmailCard.tsx` and `src/components/email/EmailDetailSheet.tsx`)

Since the database already has corrupted records, add a utility function to reconstruct names from the broken data:

```typescript
function reconstructSender(fromName: string | null, fromEmail: string): { name: string; email: string } {
  // Detect corrupted data: if fromEmail contains '<', it likely has the name baked in
  if (fromEmail.includes('<')) {
    const match = fromEmail.match(/^(.*?)\s*<([^>]+)>$/);
    if (match) {
      const fullName = ((fromName || '') + match[1]).replace(/^"|"$/g, '').trim();
      return { name: fullName, email: match[2].toLowerCase().trim() };
    }
  }
  return { 
    name: fromName || fromEmail.split('@')[0], 
    email: fromEmail 
  };
}
```

This will:
- Detect when `from_email` contains `<` (sign of corrupted data)
- Concatenate the single-char `from_name` with the rest to reconstruct the full name
- Extract the real email from inside the angle brackets

Apply this in both `EmailCard.tsx` (overview) and `EmailDetailSheet.tsx` (detail view) so sender names display correctly for both existing and future data.

### 3. Fix existing data with a one-time cleanup

Run a database migration or use the edge function's next sync to fix existing records. The simplest approach: the frontend fallback handles display immediately, and next time emails sync, they'll be stored correctly.

## Files Modified
- `supabase/functions/gmail-sync/index.ts` -- Fix From header regex (lines 275-278)
- `src/components/email/EmailCard.tsx` -- Add `reconstructSender` utility and use it for display
- `src/components/email/EmailDetailSheet.tsx` -- Same utility for detail view and thread messages
