

# Properties Feature — UI/UX Overhaul

The property feature is a single 233-line file with basic functionality but significant gaps in both design system usage and feature completeness.

---

## Issues Found

1. **Property list cards missing `pressable` and `haptic`** — GlassCard used but no tactile feedback or stagger animations.
2. **Empty states are plain text** — "No properties yet", "No maintenance tasks", "No checklists" are inline `<p>` tags instead of `EmptyState`.
3. **No stagger animations** — Property list and detail cards render without motion.
4. **Documents tab is a placeholder** — Just says "Document storage coming soon" with no functionality.
5. **No way to edit or delete properties** — Only add is supported. No edit dialog, no delete confirmation.
6. **No way to add maintenance tasks or checklists from the UI** — The hook supports `addMaintenance` and `addChecklist` but the panel doesn't expose these.
7. **Overview tab is sparse** — Missing purchase_price, current_value, address fields. No value change indicator.
8. **Add property dialog is minimal** — Missing address, size, purchase date, purchase price, notes, current value fields.
9. **Sidebar doesn't work well on mobile** — Fixed 256px sidebar with no responsive collapse.
10. **Select property empty state** — Uses raw div instead of `EmptyState`.

---

## Plan

### 1. Property list cards — pressable + haptic + stagger
Add `pressable haptic="light"` to property GlassCards. Wrap each in `motion.div variants={staggerItem}` and the list in `staggerContainer`.

### 2. All empty states → EmptyState component
Replace all 4 inline empty texts (no properties, no maintenance, no checklists, select property) with `EmptyState` component with appropriate icons and CTAs.

### 3. Add property dialog — complete form
Add fields: address, size_sqm, purchase_date, purchase_price, current_value, notes. Group into logical sections.

### 4. Edit and delete property
Add edit button (opens same dialog pre-filled) and delete button with confirmation on the overview tab. Wire to existing `updateProperty` and `deleteProperty` from the hook.

### 5. Add maintenance task UI
Add a button + dialog on the maintenance tab to create tasks with title, description, category, cost, scheduled_date, is_recurring fields. Wire to existing `addMaintenance`.

### 6. Add checklist UI
Add a button + dialog on the checklists tab to create checklists with name, type, and dynamic item list. Wire to existing `addChecklist`.

### 7. Overview tab — richer detail card
Show all available fields (address, purchase_price, current_value with gain/loss indicator, size). Add edit/delete actions.

### 8. Mobile responsive sidebar
On small screens, show property list as a horizontal scrollable strip or a select dropdown instead of the 256px sidebar.

### 9. Maintenance task status toggle
Add ability to mark maintenance tasks as completed (click to toggle status). Wire to existing `updateMaintenance`.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/property/PropertyPanel.tsx` | Full rewrite: stagger, haptic, EmptyState, responsive sidebar, edit/delete, add maintenance/checklist dialogs, richer overview |

## Summary

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Pressable + haptic + stagger | Tiny | Medium |
| 2 | EmptyState components | Tiny | Medium |
| 3 | Complete add property form | Small | High |
| 4 | Edit and delete property | Small | High |
| 5 | Add maintenance UI | Small | High |
| 6 | Add checklist UI | Small | High |
| 7 | Richer overview | Small | Medium |
| 8 | Mobile responsive | Small | High |
| 9 | Maintenance status toggle | Tiny | Medium |

