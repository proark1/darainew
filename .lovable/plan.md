

# Enhance Email-to-Contract Data Extraction and Sender Display

## Changes

### 1. Make sender name more visible in email list (`EmailCard.tsx`)

The sender name already appears, but it can be truncated. Changes:
- Remove `truncate` from the sender name so the full name is always visible
- Slightly increase font weight for better readability in the overview

### 2. Extract more data when saving an email as a contract (`EmailPanel.tsx`)

Currently `handleSaveEmailAsContract` only fills: name, provider, cost amount, frequency, category. Enhance it to also extract and pre-fill:

- **Renewal date**: Set to the email's `received_at` date (the date of the payment email)
- **Start date**: Also set to the email's `received_at` date as the earliest known date
- **Contract number**: Use a regex to search the email subject/snippet for patterns like invoice numbers, contract numbers, order IDs (e.g., "INV-12345", "Contract #98765", "Order 456789", "Ref: ABC123")
- **Notes**: Auto-generate a note like "Created from email: [subject] (received [date])" so the user has context
- **Category**: Improve detection -- check for keywords like "insurance", "internet", "phone", "streaming" in the sender/subject to pick a better category than the generic "subscription"

### 3. Update prefill handling in `AddEditContractDialog.tsx`

The prefill section already handles most fields. Add support for the new fields being passed:
- `startDate`
- `renewalDate`
- `contractNumber`
- `notes`

These fields exist in `ContractInput` but were not being set from the prefill. Update the prefill block (lines 89-105) to also populate: `setStartDate`, `setRenewalDate`, `setContractNumber`, `setNotes`.

## Technical Details

### Contract number extraction regex
```typescript
function extractContractNumber(text: string): string | undefined {
  const patterns = [
    /(?:contract|vertrag|invoice|rechnung|order|bestellung|ref|reference|nr|number)[#:\s-]*([A-Z0-9-]{4,20})/i,
    /(?:INV|ORD|REF|CTR|VTR|RG|RE|AB)[- ]?(\d{4,15})/i,
    /#(\d{5,15})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return undefined;
}
```

### Category detection from email content
```typescript
function detectCategory(text: string): ContractCategory {
  const lower = text.toLowerCase();
  if (/insurance|versicherung/.test(lower)) return 'insurance';
  if (/internet|broadband|fiber/.test(lower)) return 'internet';
  if (/phone|mobile|telefon/.test(lower)) return 'phone';
  if (/netflix|spotify|disney|streaming|hulu/.test(lower)) return 'streaming';
  if (/electricity|gas|water|energy|strom/.test(lower)) return 'utilities';
  return 'subscription';
}
```

### Files modified
- `src/components/email/EmailCard.tsx` -- Remove truncation on sender name
- `src/components/email/EmailPanel.tsx` -- Enhance `handleSaveEmailAsContract` with more extraction logic
- `src/components/contracts/AddEditContractDialog.tsx` -- Apply prefill to all fields (dates, contract number, notes)
