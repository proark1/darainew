

# Wave 5: High-Impact Value & Delight

After 4 waves of visual polish, the design system is solid. The next leap comes from **experience-level improvements** — things users feel rather than see.

## 1. Public Landing Page
Unauthenticated users currently hit a bare login form. A marketing-quality landing page is the single biggest conversion unlock.

- Glassmorphism hero with animated headline, Dori mascot, and "Get Started Free" CTA
- 6-pillar feature grid (Tasks, Calendar, Family, Health, AI Assistant, Contracts)
- "Built for ADHD minds" value proposition section
- Final CTA with inline signup link
- Fully responsive, matches existing design language

**New file:** `src/pages/Landing.tsx`
**Modified:** `src/App.tsx` — show Landing at `/` for unauthenticated users instead of redirecting to `/auth`

## 2. Personalized Dashboard from Onboarding
Onboarding already saves `useCases` preferences to the profile but the dashboard ignores them. Conditionally show/hide Family, Health, Contracts cards based on what the user selected.

**File:** `src/components/dashboard/DashboardPanel.tsx`

## 3. Streak Milestone Celebrations
When completing a task extends the streak to 3, 7, 14, or 30 days, fire `canvas-confetti` (already installed) with a congratulatory toast.

**File:** `src/components/dashboard/DashboardPanel.tsx`

## 4. Pull-to-Refresh on Mobile
`PullToRefresh` component exists but isn't wired into MobileLayout. Add it to the main content scroll area so users can pull down to refresh their current panel data.

**Files:** `src/components/layout/MobileLayout.tsx`

## 5. Page Loading Progress Bar
Add a thin animated progress bar at the top of the viewport during route transitions and data fetches, similar to YouTube/GitHub's loading indicator.

**New file:** `src/components/ui/top-loader.tsx`
**Modified:** `src/App.tsx`

## Files Summary
- `src/pages/Landing.tsx` — new public landing page
- `src/components/ui/top-loader.tsx` — new loading progress bar
- `src/App.tsx` — landing route + top loader
- `src/components/dashboard/DashboardPanel.tsx` — personalization + streak celebrations
- `src/components/layout/MobileLayout.tsx` — pull-to-refresh

