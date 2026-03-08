

# Islam Feature — Final Polish

After the major overhaul, here are the remaining issues I found:

---

## 1. HifzTrackerTab Still Uses Raw `Card` (880 lines, no GlassCard)
The Hifz tracker is the last component not using the design system. It imports `Card` from `@/components/ui/card` and has no `GlassCard`, `staggerItem`, or `motion` animations. This makes it visually inconsistent when accessed from the Quran tab.

**File:** `src/components/islam/HifzTrackerTab.tsx` — replace `Card` imports with `GlassCard`, add motion animations.

---

## 2. Quran Reader Still Uses Raw `Card` in Several Places
Lines 485, 520, 542, 555, 598, 620, 669, 716, 756, 781 in `IslamEnhancedPanel.tsx` use `Card` (which is aliased to `GlassCard` at import but the surah list items at line 598 and ayah cards at line 716 don't use `pressable` or `haptic` props). The floating audio indicator at line 781 also uses `Card` without the glass styling.

**File:** `src/components/islam/IslamEnhancedPanel.tsx` — add `pressable` to surah list cards, style the floating audio bar better.

---

## 3. Quran "Resume Reading" Feature Missing
When users return to the Quran tab, they always see the surah list. There's no "Continue where you left off" card showing their last-read surah and ayah. The reading progress data is already tracked via `useQuranReadingProgress`.

**File:** `src/components/islam/IslamEnhancedPanel.tsx` — add a "Continue Reading" card above the surah search, showing the last-read surah + ayah with a tap-to-resume action. Store last position in localStorage.

---

## 4. Overview Tab Missing Daily Hadith
The Home/Overview tab shows prayer, Quran, dhikr, and calendar — but no daily hadith preview. The `HadithTab` component exists in the "More" section but a short hadith snippet on the home tab would be valuable.

**File:** `src/components/islam/IslamOverviewTab.tsx` — add a compact hadith card that shows one random hadith from the API, tappable to navigate to the "More" tab.

---

## 5. Prayer Completion Not Shown on Overview
The PrayerTimesTab now has a completion tracker (X/5 prayed), but this data isn't surfaced on the Home tab's next-prayer card. Users should see their daily prayer progress at a glance.

**File:** `src/components/islam/IslamOverviewTab.tsx` — read the same localStorage key used by PrayerTimesTab (`completed-prayers-YYYY-MM-DD`) and show a small "3/5 prayed" badge on the prayer card.

---

## Summary

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | HifzTrackerTab design system | Medium | High |
| 2 | Quran reader card polish | Small | Medium |
| 3 | Resume reading feature | Small | High |
| 4 | Daily hadith on overview | Small | Medium |
| 5 | Prayer completion on overview | Tiny | Medium |

