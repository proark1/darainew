

# Fix Sender Names: Database Cleanup + Frontend Robustness

## Root Cause
The corrupted records are still in the database (e.g., `from_name: "P"`, `from_email: "aypal <service@paypal.de"`). The `reconstructSender` frontend utility should fix these at display time, but to be absolutely sure, we'll:

1. **Run a database migration** to permanently fix all corrupted records in `user_emails`
2. **Strengthen the frontend display** to guarantee full names always show

## Changes

### 1. Database Migration: Fix corrupted `from_name` and `from_email` records

Run a SQL migration that finds all records where `from_email` contains `<` (indicating corrupted data), extracts the real name and email, and updates them in place:

```sql
UPDATE user_emails
SET
  from_name = TRIM(BOTH '"' FROM TRIM(
    COALESCE(from_name, '') || SUBSTRING(from_email FROM '^(.*?)\s*<')
  )),
  from_email = LOWER(TRIM(SUBSTRING(from_email FROM '<([^>]+)>$')))
WHERE from_email LIKE '%<%';
```

This permanently fixes ~20+ corrupted records so the frontend reconstruction is no longer needed for existing data.

### 2. Frontend: Ensure `reconstructSender` is applied everywhere

The `reconstructSender` utility is already used in `EmailCard.tsx` and `EmailDetailSheet.tsx`. Also update `EmailPanel.tsx` line 182 where `email.from_name` is used directly (for contract creation) to use `reconstructSender` instead.

### 3. Keep the backend parser fix

The `gmail-sync` edge function was already fixed in the previous iteration, so future emails will be stored correctly.

## Files Modified
- Database migration (SQL) -- fix existing corrupted records
- `src/components/email/EmailPanel.tsx` -- use `reconstructSender` for contract prefill (line 182)

## Technical Notes
- The migration handles edge cases like `from_name` being `"s"` with `from_email` being `'ervice@paypal.de" <service@paypal.de'` -- it concatenates and strips quotes
- After migration, all records will have clean `from_name` (full name) and `from_email` (just the email address)
- The frontend `reconstructSender` utility remains as a safety net for any future edge cases
