
# Enhanced AI Contract Extraction from Email

## Goal
When a user creates a contract from an email, use AI (Gemini) to extract all relevant contract details from the email content, and attach the full email body/content to the contract notes.

## Changes

### 1. Create Edge Function: `extract-contract-from-email` (`supabase/functions/extract-contract-from-email/index.ts`)

A new backend function that:
- Accepts the email's `from_name`, `from_email`, `subject`, `snippet`, `body_preview`, and `received_at`
- Calls Gemini AI to extract structured contract data:
  - **Provider name** (cleaned up from sender)
  - **Cost amount** and **currency**
  - **Cost frequency** (monthly, quarterly, yearly, one-time)
  - **Category** (insurance, utilities, subscription, phone, internet, streaming, other)
  - **Contract/reference number**
  - **Start date**, **renewal date**, **end date** (if mentioned)
  - **Auto-renews** (true/false)
  - **Cancellation notice period** (days)
- Returns the structured data as JSON

### 2. Update `handleSaveEmailAsContract` in `EmailPanel.tsx`

- Before opening the contract dialog, call the new edge function to get AI-extracted data
- Show a loading state while AI processes the email
- Use AI-extracted fields to prefill the contract form (replacing the current regex-based extraction)
- Build rich notes that include:
  - The email subject
  - The email date
  - The sender info
  - The full email snippet/body content
- Fall back to current regex extraction if the AI call fails

### 3. Update `EmailDetailSheet.tsx`

- Pass the full email body (fetched via `onFetchBody`) to the contract creation flow so AI has maximum context
- Add a loading indicator on the "Save as Contract" button while extraction runs

## Technical Details

### Edge Function Schema (AI prompt)
The AI will be instructed to return JSON with these fields:
```text
{
  provider: string,
  costAmount: number | null,
  costFrequency: "monthly" | "quarterly" | "yearly" | "one_time",
  category: string,
  contractNumber: string | null,
  startDate: string | null,
  renewalDate: string | null,
  endDate: string | null,
  autoRenews: boolean,
  cancellationNoticeDays: number
}
```

### Notes Field Content
The notes will contain:
```text
--- Created from Email ---
From: [Sender Name] <sender@email.com>
Date: [Formatted Date]
Subject: [Email Subject]

--- Email Content ---
[Full snippet/body preview content]
```

### Files Modified
- `supabase/functions/extract-contract-from-email/index.ts` (new)
- `src/components/email/EmailPanel.tsx` -- replace regex extraction with AI call, enrich notes with email content
- `src/components/email/EmailDetailSheet.tsx` -- pass body content when triggering contract save
