

# Round 5: Top 10 UI/UX Improvements

After reviewing the live app and code post-Rounds 1-4.

---

## 1. Hero Summary Text Breaks Into 6 Lines on Mobile
The summary text "18 overdue · 21 total to do" renders as separate words stacked vertically: "18", "overdue", "·", "21", "total", "to", "do" — taking 7 lines instead of 1. This is because the XP display (`Level 1` badge + streak + progress bar) on the same row pushes the text container too narrow.

**Fix:** Move the XP display below the greeting line or onto its own row. Give the summary text `whitespace-nowrap` or increase its minimum width. The greeting + summary should never wrap beyond 2 lines.

**Files:** `src/components/dashboard/DashboardHero.tsx` — restructure the top section layout.

---

## 2. "G." Instead of User Name
The greeting shows "G." (a single initial with period) instead of the full name. The `profile?.display_name` is likely just an initial. This looks like a data display bug — the greeting should either show the full name or no initial at all.

**Fix:** If `display_name` is 2 characters or less, treat it as missing and skip the name portion. Show just "Good evening" instead of "Good evening, G.".

**Files:** `src/components/dashboard/DashboardHero.tsx` — adjust the greeting logic.

---

## 3. XP Display Takes Too Much Horizontal Space in Hero
The `XPDisplay compact` variant renders `Level 1` badge + `🔥 1` streak + progress bar + "15 XP" all on one row. Combined with the settings icon, this leaves almost no room for the greeting text, causing the word-wrapping issue in #1.

**Fix:** Simplify the compact XP display to just show the level badge and XP count. Move streak to StatPills (which already shows streak). Remove the progress bar from the compact variant — it's too small to be meaningful at 16px wide.

**Files:** `src/components/gamification/XPDisplay.tsx` — simplify compact variant.

---

## 4. "Start first task!" Stat Pill Has No Progress Bar Context
The "Start first task!" zero-state pill shows text + an empty progress bar, but the text doesn't tell the user what the goal is. It should say something like "0/5 today" or just show the encouraging message without the progress bar.

**Fix:** Hide the `MiniProgress` bar when the zero-label is shown. The empty bar adds visual noise without information.

**Files:** `src/components/dashboard/StatPills.tsx` — conditionally hide progress bar on zero-state.

---

## 5. Weather Card and StatPills Layout Is Awkward
On mobile, the Weather card and StatPills are wrapped in a `md:col-span-1` container, but on mobile it's `col-span-full` (default). The Weather card appears full-width, then StatPills appear full-width below it, then the Timeline appears below that. The Weather card takes significant vertical space for minimal information.

**Fix:** Make Weather + StatPills share a single horizontal row. Weather on the left (compact: icon + temp), StatPills scrolling on the right. Or move Weather into the Hero card as a small weather chip next to the greeting.

**Files:** `src/components/dashboard/DashboardPanel.tsx`, `src/components/dashboard/WeatherCard.tsx`

---

## 6. Timeline Tasks All Show "16:00" or "All day" — No Time Grouping
All tasks display with individual time labels but there's no visual grouping. The timeline shows "16:00 Write to 10 investors", "All day Paper Trash", "All day House trash", "All day Plastic trash" — the "All day" items should be grouped separately from timed items.

**Fix:** Add section headers: "Overdue", "Timed", "All Day". Or at minimum, sort timed items first, then all-day items last, with a subtle divider.

**Files:** `src/components/dashboard/TodayTimeline.tsx` — add grouping logic.

---

## 7. Contract Alert in Timeline Has No Context
The timeline shows "⚠ Contract: YouTu..." truncated with a red dot. Users can't tell what the alert is about. The warning icon + truncation makes it feel alarming but uninformative.

**Fix:** Show the full contract name (or at least more characters). Add a subtitle like "Renews Mar 15" so users know why it's flagged. Increase the title's max width or allow 2-line wrapping for important alerts.

**Files:** `src/components/dashboard/TodayTimeline.tsx` — increase truncation threshold or add subtitle for contract-type items.

---

## 8. "Thinking..." Text Has No Timeout Fallback
The "Next up" section shows "Thinking…" indefinitely when the AI suggestion hook fails or times out. In Round 4 we changed skeletons to text, but there's still no timeout to show a fallback.

**Fix:** Add a 5-second timeout in `useSmartTaskSuggestions`. After timeout, return the highest-priority overdue task as the suggestion instead of leaving "Thinking..." forever.

**Files:** `src/hooks/useSmartTaskSuggestions.ts` — add timeout with local fallback.

---

## 9. Bottom Nav Dori Button Active State Is Missing
When the Dori/chat tab is active, the center Dori button looks identical to its inactive state. All other tabs get a blue highlight + underline indicator, but the Dori button has no visual "selected" state.

**Fix:** Add a ring or glow effect to the Dori button when `activeTab === 'chat'`. E.g., `ring-2 ring-primary` or increase the shadow intensity.

**Files:** `src/components/layout/MobileLayout.tsx` — add active state to center button.

---

## 10. Pull-to-Refresh Only Increments a Key — Doesn't Re-fetch
The `PullToRefresh` handler does `setRefreshKey(k => k + 1)` which re-mounts the `DashboardPanel`. But the panel's `fetchAll` runs on mount, so it does technically re-fetch. However, on other tabs (Calendar, Email, Health), pull-to-refresh does nothing meaningful since those panels don't use the refresh key.

**Fix:** Pass a refresh callback to each panel or at minimum show a brief "Refreshed" toast after pull-to-refresh completes. Currently there's no feedback that the refresh actually happened.

**Files:** `src/components/layout/MobileLayout.tsx` — add toast feedback after refresh.

---

## Implementation Priority

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Fix Hero text wrapping (#1, #3) | Medium | High |
| 2 | Fix "G." display name (#2) | Small | High |
| 3 | Add suggestion timeout fallback (#8) | Medium | High |
| 4 | Timeline grouping (#6) | Medium | Medium |
| 5 | Weather + StatPills layout (#5) | Medium | Medium |
| 6 | Hide progress bar on zero-state (#4) | Small | Small |
| 7 | Dori button active state (#9) | Small | Medium |
| 8 | Contract alert context (#7) | Small | Medium |
| 9 | Pull-to-refresh feedback (#10) | Small | Low |

