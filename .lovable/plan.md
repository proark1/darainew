

# Round 7: Top 10 UI/UX Improvements

---

## 1. Dori Chat — Dead Space Below Input Persists
The Dori chat still has a large empty area below the input form extending to the bottom nav. The form has `pb-1` but the entire area below it (between the form bottom and the nav bar) is blank white/dark space. This is because the `<form>` ends but the parent `div.flex.flex-col.h-full` doesn't account for the bottom nav height.

**Fix:** Add `pb-safe` or `pb-16` to the Dori panel container to account for the bottom nav. Or set the form to have `pb-safe-area-bottom` to sit flush above the nav. The empty state suggestions + input should fill the available space without a visible gap.

**Files:** `src/components/assistant/DoriPanel.tsx` — add bottom padding to account for nav bar, tighten the form container.

---

## 2. Notification Dot Still Appears When No Notifications Exist
The red dot on the Sparkles icon in the header (Calendar, Email, Health pages) appears even when there are likely 0 unread reminders. The `useProactiveReminders` hook returns data from the database, but the dot renders whenever `unreadCount > 0`. If the hook returns stale or cached data, the dot persists incorrectly.

**Fix:** Verify the `useProactiveReminders` hook correctly filters dismissed/completed reminders from the count. Add a loading state check — don't show the dot while loading. If `reminders.length === 0`, ensure `unreadCount` is truly 0.

**Files:** `src/hooks/useProactiveReminders.ts` — audit the unreadCount calculation.

---

## 3. Calendar Page Has Redundant Header + Internal Title
The Calendar page shows "Calendar" in the ContextualHeader, then below it has an empty calendar icon, then "Focus / Tasks / Calendar" tab bar. The ContextualHeader title is redundant with the bottom nav label. The empty calendar icon between the header and tabs is unexplained.

**Fix:** Remove the ContextualHeader for the Calendar tab (like Dashboard already does). Let the internal CalendarHubPanel handle its own header with the tab bar integrated. Or hide the header title and use the space for the tab bar directly.

**Files:** `src/components/layout/MobileLayout.tsx` — add 'calendar' to the list of tabs that hide the header. `src/components/calendar/CalendarHubPanel.tsx` — add a compact header with the panel title.

---

## 4. Email "120" Badge Is Overwhelming
The Email page header shows "Email 120" with a large cyan badge, then repeats "Unread 120 | Priority 13 | Handled 0" below it. The "120" badge is visually heavy and redundant with the stat bar below. It creates anxiety rather than helping the user.

**Fix:** Remove the "120" badge from the title. Keep only the stat bar below ("Unread 120 | Priority 13 | Handled 0") which is more informative. Or show only the priority count in the header ("13 priority").

**Files:** `src/components/email/EmailPanel.tsx` — simplify the header, remove redundant unread count badge.

---

## 5. Health Page "Try Again" Button Suggests Failure
The Health page shows "No Health Data Yet" with a "Try Again" button. "Try Again" implies an error occurred, when actually the user simply hasn't added data. The CTA should be inviting, not error-recovery language.

**Fix:** Change "Try Again" to "Get Started" or "Connect Health Data". The empty state message is fine but the button label needs to be welcoming.

**Files:** `src/components/health/HealthHubPanel.tsx` — change the empty state CTA text.

---

## 6. Overdue Task Titles Are Truncated Too Aggressively
In the dashboard timeline, task titles show "Reach out to Zeyne..." and "Reach out to Tugba..." — truncated at ~20 characters. On a 390px viewport, there's room for more text. The truncation cuts off the most important part (the person's full name).

**Fix:** Remove or increase the `truncate` constraint on timeline row titles. Allow them to wrap to 2 lines for important context, or truncate at a higher character threshold.

**Files:** `src/components/dashboard/TodayTimeline.tsx` — change `truncate` to `line-clamp-2` on the title span, or remove the `w-12` fixed width on the date column to give more space to titles.

---

## 7. QuickActions Labels Are Still Truncated ("Priority E...")
The QuickActions grid shows "Priority E..." for "Priority Emails" — the 3-column grid with small buttons truncates the labels. At 390px width with 3 columns, each button gets ~110px, but icon + text still overflow.

**Fix:** Use shorter labels: "Emails" instead of "Priority Emails", "Quick Wins" is fine, "Reach Out" is fine. Or reduce to 2 columns with full labels. Or use icon-only buttons with tooltips.

**Files:** `src/hooks/useContextualActions.ts` — shorten the action labels. Or `src/components/dashboard/QuickActionsBar.tsx` — allow text wrapping or use 2 columns.

---

## 8. "Weather unavailable" Takes Same Visual Weight as Data
The "Weather unavailable" card has the same GlassCard treatment as a real weather card. It draws attention to a failure state. It should be minimal — just a small muted text, not a full card.

**Fix:** Replace the GlassCard wrapper with a simple inline element: just the CloudOff icon + "Weather unavailable" text without a card border. Make it visually subordinate to StatPills.

**Files:** `src/components/dashboard/WeatherCard.tsx` — remove GlassCard wrapper from error state, use inline styling.

---

## 9. "See all 18 overdue" Link Doesn't Stand Out
The "See all 18 overdue →" link at the bottom of the overdue section is small, uses primary color, but blends with the task items. Users may miss it. The arrow is a text arrow (→) rather than an icon.

**Fix:** Add a subtle background (e.g., `bg-destructive/10 rounded-lg px-3 py-2`) to make it look like a tappable element. Use a proper ChevronRight icon instead of the text arrow.

**Files:** `src/components/dashboard/TodayTimeline.tsx` — style the "See all" link as a mini-button.

---

## 10. Dori Header Shows Duplicate Fish Icons
The Dori chat page shows the fish icon in the header bar AND the same fish icon in the bottom nav's center button, both visible simultaneously. Two identical fish icons on screen at once is redundant.

**Fix:** Since the bottom nav already prominently shows the Dori fish, simplify the Dori panel header. Replace the large fish image with just the "Dori" text label, or make the header fish smaller/different from the nav fish.

**Files:** `src/components/assistant/DoriPanel.tsx` — simplify the header, reduce or remove the duplicate fish icon.

---

## Implementation Priority

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Fix Dori chat dead space (#1) | Small | High |
| 2 | Hide Calendar redundant header (#3) | Small | High |
| 3 | Simplify Email header badge (#4) | Small | High |
| 4 | Fix overdue title truncation (#6) | Small | High |
| 5 | Shorten QuickAction labels (#7) | Small | Medium |
| 6 | Fix Health "Try Again" CTA (#5) | Small | Medium |
| 7 | Downplay weather error state (#8) | Small | Medium |
| 8 | Style "See all overdue" link (#9) | Small | Medium |
| 9 | Remove duplicate Dori fish (#10) | Small | Low |
| 10 | Audit notification dot (#2) | Medium | Medium |

