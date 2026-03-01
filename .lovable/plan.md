

# Desktop UI/UX Optimization

## Current Issues

1. **No desktop header/toolbar** -- search and notifications are crammed into the sidebar header, invisible when collapsed
2. **Wasted screen width** -- dashboard renders the same single-column mobile layout on a 1920px screen; no use of the extra horizontal space
3. **No contextual awareness** -- no section title visible in the main content area; you have to look at the sidebar to know where you are
4. **Single-column dashboard** -- all cards stack vertically even on wide screens, requiring unnecessary scrolling
5. **Panel content has no top bar** -- every panel is a raw full-height rectangle with no header actions (search, fullscreen, view toggles)
6. **QuickActionsBar not integrated** -- the contextual quick actions exist but aren't shown on desktop dashboard
7. **Sidebar notifications/search disappear when collapsed** -- critical actions become inaccessible

## Solution

### 1. Add Desktop Content Header

Create a persistent top bar inside the main content area (not the sidebar) that shows:
- Current section title (dynamic based on active panel)
- Global search button with Cmd+K shortcut hint
- Notification center
- Dori AI quick-access button

This mirrors the mobile `ContextualHeader` but adapted for desktop, ensuring search and notifications are always visible regardless of sidebar state.

### 2. Two-Column Dashboard Layout on Desktop

Refactor `DashboardPanel` to use a responsive grid on larger screens:

```text
Desktop (md+):
+----------------------------+---------------------+
| DashboardHero (full width)                        |
+----------------------------+---------------------+
| FocusCard                  | StatPills            |
|                            | SmartInsightCard     |
+----------------------------+---------------------+
| TodayTimeline              | QuickActionsBar      |
+----------------------------+---------------------+
```

- Use CSS grid: `grid-cols-1 md:grid-cols-3` with span rules
- Hero stays full-width
- FocusCard takes 2 columns, stat/insight take 1 column
- Timeline takes 2 columns, quick actions take 1 column

### 3. Integrate QuickActionsBar into Dashboard

Import and render the existing `QuickActionsBar` component in the dashboard layout on desktop, giving proactive contextual actions prominence.

### 4. Move Search/Notifications out of Sidebar

- Remove `DoriNotificationIcon` and `notificationButton` from the sidebar header
- Pass them into the new desktop content header instead
- Keep the sidebar purely for navigation

### 5. Desktop Content Header Component

Reuse the existing `ContextualHeader` component (already created for mobile) in the desktop layout, or create a `DesktopContentHeader` that includes:
- Section title derived from `activePanel`
- Search icon triggering `onOpenGlobalSearch`
- Notification center (moved from sidebar)
- Dori quick-access bubble

### 6. Polish Sidebar Collapsed State

When sidebar is collapsed, keep the DarAI logo icon visible (currently hidden). Show icon-only tooltips for all items (already working). Remove the search/notification buttons from sidebar entirely since they'll live in the content header.

## Technical Details

### Files to Modify

**`src/components/layout/StandardMode.tsx`**
- Add a desktop content header above the main panel area
- Import `ContextualHeader` or create inline header
- Move notification center from sidebar props to the content header
- Pass `onOpenGlobalSearch` to the header

**`src/components/layout/Sidebar.tsx`**
- Remove `DoriNotificationIcon` and `notificationButton` from the sidebar header
- Keep the collapse toggle button
- Show a small DarAI icon when collapsed (currently shows nothing)
- Remove `onOpenGlobalSearch` button (moved to content header)
- Remove `BrainDumpFAB` from sidebar (move to content header or FAB overlay)

**`src/components/dashboard/DashboardPanel.tsx`**
- Change the layout from single-column `space-y` to a responsive CSS grid
- Add `QuickActionsBar` as a grid item
- Use `md:grid-cols-3` with appropriate span classes
- Hero: `col-span-full`
- FocusCard: `md:col-span-2`
- StatPills: `md:col-span-1`
- TodayTimeline: `md:col-span-2`
- SmartInsightCard + QuickActions: `md:col-span-1`

**`src/components/layout/ContextualHeader.tsx`**
- Add optional `onOpenSearch` prop handler (already exists but not wired on desktop)
- Ensure it works well at desktop widths (wider padding, larger title)

### Files Unchanged
- All panel components remain untouched
- Mobile layout remains untouched
- Dashboard sub-components (FocusCard, StatPills, etc.) stay the same

