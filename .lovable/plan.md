

# Top 10 UI/UX Improvements for DarAI

After reviewing the codebase, session replay, layout components, dashboard, assistant panel, and navigation structure, here are the 10 highest-impact UI/UX changes ranked by user value.

---

## 1. Dashboard is Overloaded — Reduce Cognitive Load
The dashboard renders 8-10 cards simultaneously (CheckinPrompt, Hero, DailyBriefing, WhatNow, FocusCard, Weather, StatPills, TodayTimeline, SmartInsight, ContractAlerts, ContactReminders, QuickActions). This creates decision paralysis.

**Fix:** Collapse the dashboard into 3 priority tiers:
- **Tier 1 (always visible):** Hero greeting + WhatNowCard (merged into one)
- **Tier 2 (scrollable):** TodayTimeline + FocusCard
- **Tier 3 (collapsed accordion):** Weather, Contracts, Contacts, Insights

Remove DailyBriefingCard as a separate card — fold its content into the Hero greeting text.

---

## 2. Bottom Navigation Has No Labels
The 5-tab bottom bar uses icon-only buttons (`LayoutDashboard`, `Calendar`, `Sparkles`, `Mail`, `Heart`). Without labels, users must memorize what each icon means. The Mail icon is ambiguous (could be chat). Heart could mean favorites.

**Fix:** Add small text labels below each icon (`Home`, `Calendar`, `Dori`, `Email`, `Health`). Reduce icon size from `w-5 h-5` to `w-4.5 h-4.5` and add `text-[10px]` labels.

---

## 3. The "More" Menu Buries Critical Features
Tasks, Notes, Contacts, Habits, and Contracts are all hidden behind a hamburger menu → MoreSheet drawer. These are core daily-use features that require 2 taps to reach.

**Fix:** Replace the static 5-tab bar with a customizable bottom bar. Let users pick their 5 tabs from all available panels. Default: Dashboard, Calendar, Dori, Tasks, More.

---

## 4. Dori Chat Empty State Lacks Personality
The empty chat shows a generic gradient icon + "How can I help you?" with 3 basic suggestions. For a personal AI named Dori (a fish character), this is a missed branding opportunity.

**Fix:** Show the Dori fish image (`src/assets/dori-fish.png`) prominently. Use personalized suggestions based on time of day and user context (e.g., "Plan my morning", "What's on my calendar?", "Remind me in 30 min"). Add a subtle wave animation.

---

## 5. No Visual Hierarchy Between Card Types
All dashboard cards use the same `GlassCard` component with similar padding, borders, and text sizes. The "What Now" card (most actionable) looks identical to the Weather card (least actionable).

**Fix:** Use distinct visual treatments:
- **Actionable cards** (WhatNow, Focus): Larger, gradient border, prominent CTA button
- **Informational cards** (Weather, Stats): Compact, muted background, no CTA
- **Alert cards** (Contracts, Contacts): Left border accent in warning/danger color

---

## 6. No Onboarding for What Dori Can Do
New users see "Ask me to manage tasks, schedule events, brainstorm ideas, or search the web" — but Dori can do 15+ things (habits, contracts, shopping, reminders, web search, memory). Users never discover most capabilities.

**Fix:** Add a "Dori can..." expandable section in the empty state showing categorized capabilities with tap-to-try examples. Categories: Productivity, Life Management, Knowledge, Reminders.

---

## 7. Header Wastes Space on Mobile
The `ContextualHeader` takes a fixed 56px (h-14) showing just the section title + notification icons. On a 667px iPhone screen, that is 8.4% of viewport used for a title that is already obvious from context.

**Fix:** Make the header collapse on scroll (shrink to 40px with smaller text). Or remove it entirely on the Dashboard (the Hero card already says "Good morning, Name").

---

## 8. StatPills Are Not Tappable
The streak, today count, weekly count, and life score pills are display-only. Users see "3 Today" but can't tap to see which 3 tasks they completed, or tap the streak to see their streak calendar.

**Fix:** Make each pill tappable — navigate to the relevant detail view (tasks completed today, streak history, life score breakdown).

---

## 9. Pull-to-Refresh Is a Hacky Re-render
The current pull-to-refresh toggles `activeTab` away and back, causing a full unmount/remount of the panel. This is visually jarring and loses scroll position.

**Fix:** Replace with a proper data refetch pattern — call the fetch functions again without unmounting the component. Use `React.useCallback` with a refresh key or invalidate the relevant queries.

---

## 10. Chat Messages Have No Markdown/Rich Formatting
AI responses are rendered as plain `<p className="text-sm whitespace-pre-wrap">`. When Dori returns lists, code, bold text, or links, they all appear as flat text. Web search citations show as `[1]` spans with no actual links.

**Fix:** Add a lightweight markdown renderer (or simple regex-based formatter) for assistant messages. Support: **bold**, *italic*, bullet lists, numbered lists, clickable links, and citation links that open in a new tab.

---

## Implementation Priority

| Priority | Item | Effort |
|----------|------|--------|
| 1 | Bottom nav labels (#2) | Small |
| 2 | Chat markdown rendering (#10) | Medium |
| 3 | Dashboard card hierarchy (#5) | Medium |
| 4 | Dori empty state personality (#4) | Small |
| 5 | Collapsible header (#7) | Small |
| 6 | Dashboard cognitive load (#1) | Large |
| 7 | Tappable stat pills (#8) | Medium |
| 8 | Dori capabilities onboarding (#6) | Medium |
| 9 | Customizable bottom bar (#3) | Large |
| 10 | Proper pull-to-refresh (#9) | Medium |

