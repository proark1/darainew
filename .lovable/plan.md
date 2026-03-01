

# Add "Save as Contract" Button to Email Detail View

## What Changes

Two additions to the email experience:

1. **"Save as Contract" button in the email detail view** -- When you open any email, there will be a contract icon button in the action bar (alongside Archive, Important, Snooze, Spam). Clicking it extracts data from the email (sender name as provider, any amounts detected in subject/snippet) and opens the Add Contract dialog pre-filled.

2. **The "Find Recurring Payments" button already exists** in the email header -- no changes needed there.

## How It Works

When you click the contract button on an individual email:
- The sender name/email becomes the **provider**
- The sender name becomes the **contract name**
- Any currency amount found in the subject or snippet is extracted as the **cost**
- The dialog opens pre-filled so you can review, adjust, and save

## Files to Modify

### 1. `src/components/email/EmailDetailSheet.tsx`
- Add `onSaveAsContract` callback prop to the component interface
- Add a `FileText` (or `Receipt`) icon button in the actions bar (line ~249-264), next to Archive/Important/Snooze/Spam
- When clicked, it calls `onSaveAsContract` with the current email data

### 2. `src/components/email/EmailPanel.tsx`
- Pass a new `onSaveAsContract` prop to `EmailDetailSheet`
- The handler extracts data from the email:
  - Parse `from_name` / `from_email` for provider name
  - Use a regex to find currency amounts (e.g., "15,99 EUR", "$49.99", "162,00 EUR") in subject + snippet
  - Set default frequency to "monthly"
  - Set category to "subscription" as default
- Opens the existing `AddEditContractDialog` with the prefill data (same flow as the recurring payment detector)

## Technical Details

### Amount extraction logic
```typescript
function extractAmount(text: string): number | undefined {
  // Match patterns like: 15,99 EUR, $49.99, 162,00 EUR, 51.62 EUR
  const match = text.match(/(\d+[.,]\d{2})\s*(?:EUR|USD|\$|€)/i) 
              || text.match(/[$€]\s*(\d+[.,]\d{2})/);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  return undefined;
}
```

### New prop on EmailDetailSheet
```typescript
onSaveAsContract?: (email: Email) => void;
```

### Button placement
Added to the existing actions bar in the email detail drawer, as a clearly labeled "Contract" button with a Receipt icon, matching the style of Archive/Important/Snooze/Spam buttons.

