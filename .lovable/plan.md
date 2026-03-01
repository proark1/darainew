

# Detect Recurring Payments in Emails and Auto-Create Contracts

## Summary

Add a feature that scans your emails for recurring payment patterns (invoices, receipts, subscription confirmations) and suggests creating contracts from them. Two entry points:

1. **Manual button** in the Email panel header: "Find Recurring Payments"
2. **Automatic notification** after email sync when new recurring payments are detected

## How It Works

1. User clicks "Find Recurring Payments" button (or it runs automatically after sync)
2. An edge function queries the user's emails, sends them to AI (Gemini Flash) to identify recurring payment patterns
3. AI extracts: company name, amount, frequency, category
4. Results appear in a dialog listing detected recurring payments
5. User clicks one to open the Add Contract dialog, pre-filled with the detected data
6. User reviews, adjusts, and saves

## Changes

### 1. New Edge Function: `detect-recurring-payments`

- Queries `user_emails` for the user (last 6 months, looking for payment-related keywords in subjects/snippets)
- Sends email data to Gemini Flash Lite with a prompt to identify recurring senders and payment patterns
- Returns a list of detected subscriptions/contracts with extracted details:
  - Company/provider name
  - Amount and currency
  - Payment frequency (monthly, quarterly, yearly)
  - Suggested category (subscription, insurance, utilities, etc.)
- Cross-references with existing contracts to avoid duplicates

### 2. New Component: `RecurringPaymentDetector` dialog

- Shows a list of detected recurring payments as cards
- Each card shows: company name, detected amount, frequency, number of matching emails
- "Add as Contract" button on each card opens `AddEditContractDialog` pre-filled
- "Dismiss" button to skip individual suggestions
- Loading state while AI analyzes

### 3. Update Email Panel (`src/components/email/EmailPanel.tsx`)

- Add a "Find Recurring Payments" button in the header actions area (next to sync button)
- Uses a receipt/file-text icon
- Opens the `RecurringPaymentDetector` dialog

### 4. Update Add Contract Dialog (`src/components/contracts/AddEditContractDialog.tsx`)

- Accept optional `prefill` prop with detected payment data
- When prefill is provided, auto-populate: name, provider, costAmount, costFrequency, category
- Show a subtle banner: "Pre-filled from email analysis. Please review and adjust."

## Technical Details

### Edge Function: `detect-recurring-payments`
```
Input: user's auth token
Process:
  1. Fetch emails from user_emails (last 6 months, non-archived)
  2. Fetch existing contracts to exclude known ones
  3. Send email subjects/senders/snippets to Gemini with prompt:
     "Identify recurring payments from these emails. Group by sender/service.
      Extract: company, amount, frequency, category."
  4. Return structured list of detected payments
Output: { payments: [{ name, provider, amount, frequency, category, emailCount }] }
```

### New Files
- `supabase/functions/detect-recurring-payments/index.ts` -- Edge function for AI analysis
- `src/components/email/RecurringPaymentDetector.tsx` -- Detection results dialog with "Add as Contract" action

### Modified Files
- `src/components/email/EmailPanel.tsx` -- Add "Find Recurring Payments" button
- `src/components/contracts/AddEditContractDialog.tsx` -- Accept and apply prefill data
- `src/hooks/useContracts.ts` -- Export addContract for use from the detector

