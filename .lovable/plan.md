

# Round 6: Top 10 UI/UX Improvements

---

## 1. Dori Chat Still Has Large Dead Space Below Input
The input form sits at the natural bottom, but below it there is a large empty white/dark area extending to the bottom nav. The `safe-area-bottom` on the form adds padding, but the space between the last suggestion chip and the input is still large. The empty state content is pushed to the bottom via `justify-end`, but the gap between suggestions and input remains visually jarring.

**Fix:** Remove extra spacing below the form. Add `pb-0` or minimal padding to the form container. Ensure the empty state suggestions sit directly above the input with only `gap-2` between them, not a large flex gap.

**Files:** `src/components/assistant/DoriPanel.tsx` — tighten the gap between empty state content and input form.

---

## 2. Hero Card Is Too Tall — Pushes Everything Below the Fold
The Hero card contains: greeting + summary + XP row + divider + "Next up" header + AI suggestion title + reason text + badges + tip box + "Start Now" button + "Something else?" collapsible + encouragement text. This takes ~70% of the viewport on mobile, pushing QuickActions, StatPills, and the Timeline entirely below the fold. Users must scroll past a single card to see their actual schedule.

**Fix:** Collapse the AI suggestion section by default — show only the task title and "Start Now" button. Move the reason, badges, tip, and alternatives behind a "Details" expander. This cuts the Hero card height by ~40%.

**Files:** `src/components/dashboard/DashboardHero.tsx` — make suggestion details collapsible, default closed.

---

## 3. Timeline Shows Overdue Tasks From Months Ago
The OVERDUE section in TodayTimeline lists tasks from December (e.g., "Was due Dec 31", "Was due Jan 3"). These are stale, not actionable today, and clutter the timeline with 10+ items. The timeline should focus on today, not a backlog dump.

**Fix:** Limit overdue items to the top 3 most recent, with a "See all X overdue" link that navigates to the tasks panel. Or filter to overdue items from the last 7 days only.

**Files:** `src/components/dashboard/TodayTimeline.tsx` — cap overdue list at 3 items with a "See more" link.

---

## 4. Weather Card Is Missing / Not Rendering
The `WeatherCard` returns `null` when loading, error, or no data. On the live dashboard, the Weather card is invisible — only the StatPills appear in the weather+stats row. The `useWeather` hook likely fails silently (geolocation denied or API error).

**Fix:** Show a minimal fallback when weather fails to load — e.g., a small "Weather unavailable" or a location-request prompt. Don't leave a gap in the layout.

**Files:** `src/components/dashboard/WeatherCard.tsx` — add error/fallback state instead of returning null.

---

## 5. "Start first task!" Pill Is Confusingly Worded
The StatPill shows a green checkmark icon + "Start first task!" text. Users may think it's a button to create a task, not a motivational zero-state for "0 tasks completed today." The wording is ambiguous.

**Fix:** Change to "0 done today" with a small progress indicator or "No tasks done yet." Keep it informational, not action-like.

**Files:** `src/components/dashboard/StatPills.tsx` — change zero-state text.

---

## 6. "1 new email synced" Toast Overlaps Bottom Nav
A persistent toast "1 new email synced" appears at the very bottom of the screen, partially overlapping with the bottom navigation bar and the Dori button. The toast z-index and positioning conflict with the nav.

**Fix:** Move toast positioning to appear above the bottom nav (add `bottom-20` or equivalent offset). Or use a top-positioned toast.

**Files:** Check sonner/toast configuration — likely in `App.tsx` or wherever `<Toaster>` is rendered. Add `offset` or `position="top-center"`.

---

## 7. Notification Dot Is Always Red Even When Empty
The red notification dot appears on every non-dashboard page header (Calendar, Email, Health) regardless of whether there are actual notifications. It creates constant false urgency.

**Fix:** Only show the notification dot when `notifications.length > 0` in the `DoriNotificationIcon` component.

**Files:** `src/components/assistant/DoriNotificationIcon.tsx` — conditional render.

---

## 8. Calendar Panel Has Double "Planner" + Tab Bar That Wastes Space
The Calendar page shows: ContextualHeader ("Calendar") + "Planner" title + Focus/Tasks/Calendar tab bar + "Today's Focus" section. The ContextualHeader title "Calendar" and the "Planner" subtitle are redundant. The tab bar adds yet another navigation layer.

**Fix:** Remove the "Calendar" ContextualHeader title (it's redundant with the bottom nav label). Or merge "Planner" into the header and remove the separate subtitle.

**Files:** `src/components/layout/MobileLayout.tsx` and calendar panel component — simplify header hierarchy.

---

## 9. Overdue Task Times Are Misleading in Timeline
Overdue tasks show times like "02:12", "07:15", "05:25" in the timeline. These are the original due times from days/weeks ago, not today's times. Displaying them alongside today's timeline creates confusion — users think these are scheduled for those times today.

**Fix:** For overdue items, show "Overdue" or the overdue date ("Dec 31") instead of the original time. The time is irrelevant for overdue tasks.

**Files:** `src/components/dashboard/TodayTimeline.tsx` — change time display for overdue section items.

---

## 10. QuickActions + StatPills Compete for Horizontal Space
QuickActions (Priority Emails, Quick Wins, Reach Out) scroll horizontally. Below them, StatPills also scroll horizontally. Two horizontally-scrolling strips stacked on top of each other is disorienting — the user doesn't know which to swipe.

**Fix:** Merge QuickActions into a 2-column grid instead of horizontal scroll, or move them inside the Hero card as part of the "Next up" action area. Limit to 3 visible actions max.

**Files:** `src/components/dashboard/QuickActionsBar.tsx` — switch from horizontal scroll to a compact grid.

---

## Implementation Priority

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Collapse Hero suggestion details (#2) | Medium | High |
| 2 | Cap overdue items at 3 (#3) | Small | High |
| 3 | Fix overdue time display (#9) | Small | High |
| 4 | Fix toast overlapping nav (#6) | Small | High |
| 5 | Conditional notification dot (#7) | Small | Medium |
| 6 | Dori chat dead space (#1) | Small | Medium |
| 7 | Weather fallback state (#4) | Small | Medium |
| 8 | StatPills zero-state wording (#5) | Small | Small |
| 9 | Simplify Calendar header (#8) | Small | Medium |
| 10 | QuickActions layout (#10) | Medium | Medium |

