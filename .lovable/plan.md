

# Cooking Feature Overhaul

The current Cooking panel is a thin wrapper around `MealPlanningPanel` (from the family module). It has two tabs: a weekly planner grid and a recipe list. The feature works but the UX is desktop-oriented — the 7-column grid is cramped on mobile, the recipe list is bare-bones, there's no "today's meals" quick view, and the empty states don't guide users.

---

## Changes

### 1. Replace CookingPanel with a dedicated, richer panel
**File:** `src/components/cooking/CookingPanel.tsx`

Instead of wrapping `MealPlanningPanel`, build a proper cooking-first experience with 3 tabs:
- **Today** — shows today's planned meals (breakfast → dinner) with tap-to-view-recipe, a "What's for dinner?" AI suggestion button, and a quick "Add meal" action. Uses `GlassCard` for each meal slot.
- **Week** — the existing weekly planner, but optimized for mobile (horizontal scroll of day cards instead of a 7-column grid that squishes).
- **Recipes** — the recipe collection with search/filter, category chips, and tap-to-open detail.

### 2. Add a "Today's Meals" view component
**New file:** `src/components/cooking/TodayMealsView.tsx`

Shows today's 4 meal slots (breakfast, lunch, dinner, snack) as vertical cards. Each card:
- If a meal is planned: shows the meal name, prep+cook time, tap to open `RecipeDetailDialog`
- If empty: shows a subtle "+" button to add a meal
- At the bottom: "What should I cook?" AI button that calls the `recipe-assistant` edge function with `type: 'explore'` filtered to the next upcoming empty meal slot

### 3. Improve RecipesList with search, filters, and tap-to-view
**File:** `src/components/family/RecipesList.tsx`

- Add a search input at the top
- Add horizontal category filter chips (All, Breakfast, Main, Side, Dessert, etc.)
- Make each recipe card tappable → opens `RecipeDetailDialog`
- Use `EmptyState` component for zero-state instead of raw Card
- Add `GlassCard` styling for consistency with design system

### 4. Fix weekly planner for mobile
**File:** `src/components/family/MealPlanningPanel.tsx`

- On mobile, show a single-day view with left/right swipe/arrows instead of the 7-column grid
- Show the day name + date prominently, with the 4 meal slots vertically
- Keep the 7-column grid for `md:` and up
- Remove `PanelShell` wrapping from CookingPanel (it already has its own header via tabs)

### 5. Improve AddMealPlanDialog UX
**File:** `src/components/family/AddMealPlanDialog.tsx`

- Add an "AI Suggest" button that calls `recipe-assistant` with `type: 'suggest'` based on the selected meal type and shows quick-pick suggestions before requiring manual entry
- Pre-select the meal type based on time of day (morning → breakfast, afternoon → lunch, evening → dinner)

### 6. Polish RecipeDetailDialog
**File:** `src/components/family/RecipeDetailDialog.tsx`

- Add ingredient checkboxes (local state) so users can check off ingredients while cooking
- Add a "Generate Shopping List" button for single-recipe shopping
- Improve the cooking mode step display with better typography and swipe gesture support

---

## Technical Details

- **TodayMealsView** uses `useMealPlanning` with today's date range, reuses `mealTypeConfig` styling
- AI suggestion in TodayMealsView calls `supabase.functions.invoke('recipe-assistant', { body: { type: 'explore', mealCategory: nextEmptySlot } })` 
- Mobile day view in planner uses `useState` for `selectedDayIndex` with ChevronLeft/Right navigation, only rendered below `md:` breakpoint
- Recipe search is client-side filtering on the existing `recipes` array (name + category + description)
- All new components use `GlassCard`, `staggerItem` animations, and `EmptyState` from the design system
- No database changes needed — all data models already exist

