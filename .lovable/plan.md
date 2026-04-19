

## Sidebar reorganization plan

### Problems found
1. **Duplicate / confusing items**
   - `properties` ("Properties") **and** `assets` ("Properties & Vehicles") — both exist, overlap. Assets panel is the newer combined one.
   - `family` panel labeled "Cooking" with a fork icon — but Family Hub contains tasks, meals, shopping, health, school, budget, docs (cooking is just one tab). Family is hidden behind the wrong label.
   - `health` (Health Hub — Apple Health metrics) vs `personal-health` (medications, conditions) — both valid but unclear which is which in the sidebar.

2. **Missing from sidebar (but wired in StandardMode)**
   - `projects` — Project Manager
   - `activity` — Activity Feed
   - These are accessible nowhere from desktop nav today.

3. **Single-item groups waste space**
   - "Assistant" group with just one item.

4. **Buried actions**
   - Focus Mode / Weekly Review live as orphan items at the bottom of the nav, easy to miss.

### Proposed grouping (desktop sidebar)

```text
MY DAY
  • Dashboard
  • Tasks
  • Calendar
  • Today Focus       (already CTA at top — keep)

ASSISTANT & CAPTURE
  • Dori (Assistant)
  • Notes
  • Journal
  • Activity Feed     (newly surfaced)

FAMILY & HOME           (renamed from "Life")
  • Family Hub         (was "Cooking" — fix label + icon to Users)
  • Cooking            (NEW: deep-link to Family Hub → meals tab)
  • Health Hub         (Apple Health metrics)
  • Personal Health    (meds & conditions)
  • Habits
  • Relationships+
  • Islam

COMMUNICATION
  • Email  (badge)
  • Social / Chat
  • Contacts

WORK & MONEY            (merged Business + Money)
  • Projects           (newly surfaced)
  • Startups
  • Contracts
  • Finances
  • Properties & Vehicles   (keep ONE — remove standalone "Properties")
  • Travel
  • Tech News

LEARN
  • Learning

PRODUCTIVITY TOOLS       (promoted from buried)
  • Focus Mode
  • Weekly Review

—— footer ——
  • Settings
  • Admin (if admin)
  • Sign out
```

### Key changes
- **Remove duplicate**: drop standalone `properties` nav item, keep `assets` ("Properties & Vehicles") only. Old route still works.
- **Fix Family label**: `family` panel → label "Family Hub", icon `Users` (not Utensils).
- **Add Cooking shortcut**: opens Family Hub with cooking/meals tab pre-selected (small enhancement — pass a default tab prop).
- **Surface Projects + Activity Feed** as nav items.
- **Promote Focus Mode + Weekly Review** into their own visible "Productivity" group instead of orphan items.
- **Rename group "Life" → "Family & Home"**, merge Business + Money & Assets → "Work & Money" to reduce group count from 6 to 5 visible groups.
- **Mirror changes in MoreSheet** (mobile) so the same labels/icons/grouping apply there.

### Files to touch
- `src/components/layout/Sidebar.tsx` — reorder items, fix Family label/icon, remove `properties` duplicate, add Projects/Activity, regroup.
- `src/components/layout/MoreSheet.tsx` — same label/icon fixes; reorder sections to match.
- `src/components/family/FamilyPanel.tsx` — accept optional `defaultTab` prop so Cooking shortcut lands on meals.
- `src/components/layout/StandardMode.tsx` — pass `defaultTab="meals"` when navigated via the Cooking shortcut (introduce a tiny `panelHint` state).

### Out of scope
- Removing the underlying `properties` panel/route (kept for backward compatibility, just not linked).
- Translation keys for new labels — will reuse existing keys where possible, add German strings inline only where needed.
- No DB / backend changes.

