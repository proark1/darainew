

# Reorganize Mobile Bottom Navigation + Burger Menu

## Summary

Restructure the mobile bottom tab bar to: **Dashboard | Calendar | Dori AI | Email | Health**, and move the "More" menu to the top header as a hamburger/burger menu icon.

## Changes

### 1. Bottom Tab Bar (`src/components/layout/MobileLayout.tsx`)

Update `primaryTabs` array from:
```text
[Dashboard] [Calendar] [Dori] [Tasks] [More]
```
to:
```text
[Dashboard] [Calendar] [Dori] [Email] [Health]
```

- Replace `tasks` (CheckSquare) with `email` (Mail icon)
- Replace `more` (MoreHorizontal) with `health` (Heart icon)
- Remove the special `tab === 'more'` logic that opens the drawer from the bottom bar
- Add "Tasks" to the MoreSheet sections so it remains accessible

### 2. Burger Menu in Header (`src/components/layout/ContextualHeader.tsx`)

- Add a hamburger menu icon (Menu icon from lucide) on the left side of the header, before the title
- Clicking it opens the existing `MoreSheet` drawer (same content, just triggered from the header now)
- Pass `onOpenMenu` callback prop from MobileLayout into ContextualHeader

### 3. Update MoreSheet Sections (`src/components/layout/MoreSheet.tsx`)

- Add "Tasks" as an item in the MoreSheet (under a "Productivity" or "Tools" section) since it's no longer in the bottom bar
- Use CheckSquare icon with `nav.tasks` label key

### 4. Wire It Up (`src/components/layout/MobileLayout.tsx`)

- Pass `onOpenMenu={() => setMoreOpen(true)}` to ContextualHeader
- Remove the `if (tab === 'more')` branch from `handleTabChange` since "more" is no longer a bottom tab
- Email and Health tabs already have their panels rendered in the main content area, so no new panel wiring is needed

## Files to Modify

1. **`src/components/layout/MobileLayout.tsx`** -- Update tab array, remove more-tab logic, pass menu handler to header
2. **`src/components/layout/ContextualHeader.tsx`** -- Add hamburger menu button on left side
3. **`src/components/layout/MoreSheet.tsx`** -- Add Tasks item to the sections grid

