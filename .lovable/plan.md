
# Fix Health Hub Showing "No Health Data"

## Problem

Your health data IS saved in the cloud -- 3,008 records covering steps, heart rate, sleep, HRV, blood oxygen, and more (Dec 2024 through Jan 29, 2026). The Health Hub appears empty because of two issues:

1. **Query limit too low**: The database query fetches only 1,000 records max. With ~10 metrics per day, that only covers ~100 days of history -- and misses older data entirely.
2. **Default date = today**: The UI always opens on "today" (March 1), but the latest synced data is from January 29. So the view is empty.

## Solution

### 1. Smarter data fetching (`src/hooks/useAppleHealth.ts`)

Instead of loading all records at once (which doesn't scale), fetch health metrics **by date range** around the selected date. Load a rolling window (e.g., 60 days from selected date backwards) so navigation is fast and data is always available.

Also add a quick query to find the **latest available date** so the UI can default to it when today has no data.

### 2. Default to latest data date (`src/components/health/HealthHubPanel.tsx`)

When the panel loads:
- Check if today has any data
- If not, automatically set the selected date to the most recent date that has health data (January 29 in your case)
- Show a subtle note like "Showing latest available data from Jan 29"

### 3. Remove the hard 1,000 limit (`src/hooks/useAppleHealth.ts`)

Replace the single `.limit(1000)` query with a date-bounded query:
```
.gte('recorded_at', startOfRange)
.lte('recorded_at', endOfRange)
```
This ensures all data for the visible date range loads correctly regardless of total record count.

## Files to Modify

1. **`src/hooks/useAppleHealth.ts`**
   - Change `fetchHealthMetrics()` to accept a date range parameter
   - Add `fetchLatestDate()` function that queries `SELECT MAX(recorded_at) FROM health_metrics`
   - Remove the `.limit(1000)` and use date-range filtering instead

2. **`src/components/health/HealthHubPanel.tsx`**
   - On mount, call `fetchLatestDate()` and set `selectedDate` to that date if today has no data
   - Re-fetch metrics when `selectedDate` changes (load ~60 day window around it)
   - Add a small indicator when viewing historical data ("Latest data: Jan 29")

## Result

- Health Hub opens and immediately shows your latest health data (Jan 29)
- Date navigation works across all historical data without hitting query limits
- You can still navigate to today (it will just show empty if no sync has happened)
