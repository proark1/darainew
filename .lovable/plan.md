

# Prayer on Dashboard + Notifications

## Current State
- Prayer times exist in the Islam panel (`PrayerTimesTab.tsx`) with full notification scheduling, Adhan support, and completion tracking
- Dashboard has NO prayer widget — the `prayer_times` widget type exists in `useWidgetLayout.ts` but is **disabled by default** and has **no component implementation**
- Prayer notifications already work (browser + native) but are opt-in and buried in the Islam panel settings

## Plan

### 1. Create `DashboardPrayerCard` component
A compact dashboard card showing:
- Next prayer name, time, and live countdown (e.g. "Maghrib in 1h 23m")
- Progress ring or bar showing 5/5 prayers completed today
- Row of 5 prayer icons (Fajr→Isha) with checkmarks for completed ones — tappable to toggle
- "View All" link navigates to Islam panel

Fetches prayer times using the same Aladhan API logic already in `PrayerTimesTab`. Reads/writes completion state from the same `completed-prayers-YYYY-MM-DD` localStorage key for consistency.

**File:** `src/components/dashboard/DashboardPrayerCard.tsx`

### 2. Add prayer card to `DashboardPanel`
Insert the `DashboardPrayerCard` as a permanent Tier 2 element (between StatPills and TodayTimeline), always visible — not hidden behind the widget system since the user explicitly wants this front and center.

**File:** `src/components/dashboard/DashboardPanel.tsx`

### 3. Auto-enable prayer notifications on first load
In the `DashboardPrayerCard`, if notification settings are not yet enabled, show a subtle prompt: "Enable prayer reminders?" with a single tap to request permission and turn on notifications for all 5 prayers. This removes the friction of navigating to the Islam panel to enable them.

Uses the existing `prayer-notifications` localStorage key and notification scheduling logic.

### 4. Include prayer times in TodayTimeline
Inject upcoming prayer times as timeline items (type: `'prayer'`) into the `TodayTimeline` so prayers appear alongside tasks and events in chronological order. Each prayer row shows the mosque icon, prayer name, and time — tapping navigates to Islam panel.

**File:** `src/components/dashboard/TodayTimeline.tsx`

---

## Summary

| # | Change | File |
|---|--------|------|
| 1 | New `DashboardPrayerCard` | `src/components/dashboard/DashboardPrayerCard.tsx` |
| 2 | Add card to dashboard Tier 2 | `src/components/dashboard/DashboardPanel.tsx` |
| 3 | Notification enable prompt in card | Inside `DashboardPrayerCard.tsx` |
| 4 | Prayer items in TodayTimeline | `src/components/dashboard/TodayTimeline.tsx` |

