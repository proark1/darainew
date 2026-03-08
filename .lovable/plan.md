

# Contacts Feature — UI/UX Overhaul

The contacts feature is functionally rich (tiered relationships, AI insights, interaction history, network health, timeline, import/export, email templates) but has significant design system inconsistencies and UX gaps.

---

## Issues Found

1. **No PanelShell in ContactsPanel** — Custom header instead of standardized `PanelShell`. No stagger animations.
2. **ContactProfileCard uses raw `Card`** — All internal cards (Details, Tags, Notes, Stats, History, AI Insights, Quick Actions) use `Card` instead of `GlassCard`.
3. **ContactNetworkHealth uses raw `Card`** — 225 lines, all `Card` imports.
4. **ContactTimeline uses raw `Card`** — 242 lines, all `Card` imports.
5. **ContactsPage uses raw `Card`** — The full-page view (1060 lines) uses `Card` everywhere, no `GlassCard`, no motion animations.
6. **Empty states are plain text** — "No contacts found" / "No contacts yet" are inline text instead of the `EmptyState` component.
7. **ContactsPage table row click opens edit form** — Should open profile card (like the sidebar does), consistent with the design principle that clicking opens profile first.
8. **No haptic feedback** — ContactsPanel uses `GlassCard` but without `pressable` or `haptic` props.

---

## Plan

### 1. ContactsPanel → PanelShell wrapper
Replace custom header with `PanelShell` (icon: `Users`, title: "Contacts", subtitle: count + due). Move Add button and Import/Export into `actions`. Move search + view toggle into `headerExtra`.

**File:** `src/components/contacts/ContactsPanel.tsx`

### 2. ContactsPanel cards → pressable + haptic
Add `pressable haptic="light"` to the existing `GlassCard` usage in `ContactCard`. Add `staggerItem` motion wrapper.

**File:** `src/components/contacts/ContactsPanel.tsx`

### 3. Empty states → EmptyState component
Replace inline "No contacts" text with `EmptyState` (icon: `Users`/`Bell`, proper title/description). Apply in both panel and page views.

**Files:** `src/components/contacts/ContactsPanel.tsx`, `src/pages/ContactsPage.tsx`

### 4. ContactProfileCard → GlassCard
Replace all `Card`/`CardContent`/`CardHeader` with `GlassCard`/`GlassCardContent`. This covers: Contact Details, Tags, Notes, Stats, Log Interaction, History, AI Insights, Quick Actions.

**File:** `src/components/contacts/ContactProfileCard.tsx`

### 5. ContactNetworkHealth → GlassCard
Replace `Card` imports with `GlassCard`. Add motion animations.

**File:** `src/components/contacts/ContactNetworkHealth.tsx`

### 6. ContactTimeline → GlassCard
Replace `Card` imports with `GlassCard`. Add motion animations.

**File:** `src/components/contacts/ContactTimeline.tsx`

### 7. ContactsPage → GlassCard + design polish
Replace all `Card` usage with `GlassCard` in the full-page contact cards and table view. Fix table row click to open profile card instead of edit form. Add `pressable haptic="light"` to card items.

**File:** `src/pages/ContactsPage.tsx`

---

## Summary

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | PanelShell wrapper | Small | High |
| 2 | Pressable + haptic cards | Tiny | Medium |
| 3 | EmptyState components | Tiny | Medium |
| 4 | ProfileCard → GlassCard | Small | High |
| 5 | NetworkHealth → GlassCard | Tiny | Medium |
| 6 | Timeline → GlassCard | Tiny | Medium |
| 7 | ContactsPage → GlassCard | Medium | High |

