

# Islam Feature Overhaul — Top 10 UI/UX Improvements

The `IslamEnhancedPanel` is a 1922-line monolith with 7 tabs crammed into a single file. The feature is functional but has major UX problems: tabs are unreadable on mobile (7 icon-only columns), the panel doesn't use the design system (`GlassCard`, `PanelShell`, `EmptyState`), there's no "at a glance" dashboard, and the Duas/Calendar tabs are visually flat.

---

## 1. Add an "Overview" Dashboard Tab as Default
The panel opens to Prayer Times, but users need a quick glance at everything: next prayer countdown, today's Quran progress, Hijri date, daily hadith, and dhikr counter. Create a new `IslamOverviewTab.tsx` that shows all of this in a compact, scrollable card layout using `GlassCard`.

**New file:** `src/components/islam/IslamOverviewTab.tsx`  
**Modify:** `IslamEnhancedPanel.tsx` — add "Home" as the first tab, reduce to 5 tabs by merging Hifz into Quran.

---

## 2. Fix Tab Bar — 7 Tabs Are Unreadable on Mobile
The `grid-cols-7` TabsList shows only icons on mobile with `hidden sm:inline` labels. 7 tiny tap targets is unusable. Reduce to 5 tabs: **Home**, **Prayer**, **Quran** (absorb Hifz as a sub-tab), **Duas**, **More** (Qibla + Hadith + Calendar).

**File:** `IslamEnhancedPanel.tsx` — restructure tabs, create a "More" tab that contains Qibla, Hadith, and Calendar as sub-sections.

---

## 3. Use Design System Components Throughout
The panel uses raw `Card` from `@/components/ui/card` while other panels use `GlassCard`, `PanelShell`, `EmptyState`, and `staggerItem` animations. This makes Islam feel like a different app.

**Files:** All Islam sub-components — replace `Card` with `GlassCard`, wrap main panel in `PanelShell`, add `motion` stagger animations, use `EmptyState` for zero states.

---

## 4. Add Dhikr Counter to Overview/Home
The `useIslamicFeatures` hook has full dhikr tracking (SubhanAllah, Alhamdulillah, Allahu Akbar, etc.) with database persistence, but it's not surfaced in any UI. Add an interactive dhikr counter with haptic feedback, circular progress rings, and daily targets.

**New file:** `src/components/islam/DhikrCounter.tsx`  
**Uses:** `useIslamicFeatures().dhikrLogs`, `incrementDhikr`, `DHIKR_TYPES`

---

## 5. Improve Duas Tab — Add Search and Better Layout
The Duas tab has 50+ duas organized by category, but the category pills are hard to scan, there's no search, and the expanded state uses a flat layout. Add search, improve the expansion animation, and show the Arabic text prominently even when collapsed.

**File:** `IslamEnhancedPanel.tsx` — Duas tab section. Add search input, improve card layout to show Arabic preview when collapsed, add copy/share buttons on each dua.

---

## 6. Improve Prayer Times with "Prayer Tracker" 
Prayer times display well but there's no way to mark prayers as completed. Add a simple tap-to-check feature (local state + database) so users can track their daily salah completion with a visual progress indicator.

**File:** `PrayerTimesTab.tsx` — add a check icon next to each prayer that persists via `useIslamicFeatures` or local storage, show completion count (e.g., "3/5 prayers").

---

## 7. Quran Reader — Add Translation Toggle
The Quran reader shows Arabic text only. Many users need English translation alongside. Add a toggle to show/hide English translation (fetched from `en.asad` or `en.sahih` edition via the same API).

**File:** `IslamEnhancedPanel.tsx` — Quran reading section. Add a translation toggle button, fetch translation edition in parallel, render below each ayah.

---

## 8. Better Mobile Qibla UX
The Qibla compass works but the location name shows raw coordinates ("21.42°, 39.83°") instead of a city name. The compass also lacks instructions for first-time users.

**File:** `IslamEnhancedPanel.tsx` — Qibla section. Use reverse geocoding for the location name (already done in `PrayerTimesTab`), add a brief instruction text for first-time users.

---

## 9. Calendar Tab — Add Countdown to Next Event
The Islamic Calendar shows a flat list of upcoming events but doesn't highlight the nearest one or show a countdown. Add a prominent "Next Islamic Event" card at the top with days remaining.

**File:** `IslamEnhancedPanel.tsx` — Calendar tab. Add a hero card for the next upcoming event with `differenceInDays` countdown.

---

## 10. Wrap in PanelShell and Add Proper Header
The panel uses a custom header with a Moon icon and Hijri badge. It should use `PanelShell` for consistency with every other panel in the app, including the standardized padding, stagger animations, and header format.

**File:** `IslamEnhancedPanel.tsx` — wrap the entire panel content in `PanelShell` with the Moon icon, move Hijri badge into the subtitle area.

---

## Implementation Priority

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Overview/Home dashboard tab | Medium | High |
| 2 | Fix tab bar (7→5 tabs) | Medium | High |
| 3 | Design system adoption | Medium | High |
| 4 | Dhikr counter | Medium | High |
| 5 | Duas search + layout | Small | Medium |
| 6 | Prayer tracker | Small | Medium |
| 7 | Quran translation toggle | Medium | High |
| 8 | Qibla location name fix | Small | Small |
| 9 | Calendar next event countdown | Small | Medium |
| 10 | PanelShell wrapper | Small | Medium |

