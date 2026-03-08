

# Performance & Cost Optimization Audit

## Critical Issues Found

### 1. `useAuth()` has no shared state — 10+ duplicate profile fetches per page load
`useAuth()` is a plain hook (no Context/Provider). It's called in **91 files**. Each call independently sets up an auth listener AND fetches the profile from the database. On the dashboard alone, this causes **10+ identical `GET /profiles`** requests (visible in network logs).

**Fix:** Convert `useAuth` to a Context + Provider pattern. One auth listener, one profile fetch, shared across all consumers.

### 2. `useEmails()` called in 5 places — each independently fetches 200 emails
Sidebar, Index, GhostMode, EmailPanel all call `useEmails()` independently, each fetching 200 rows. The Sidebar only needs `unreadCount`.

**Fix:** Create an `EmailsContext` provider, or at minimum a lightweight `useUnreadEmailCount()` hook for Sidebar that only fetches `count`.

### 3. Dashboard fetches ALL tasks with `select('*')` — no date filter
`DashboardPanel.fetchAll` does `supabase.from('tasks').select('*').eq('user_id', userId)` — returns every task the user has ever created, including completed and old ones. Only today's tasks and overdue are needed.

**Fix:** Add `.eq('completed', false)` or date range filter. Select only needed columns instead of `select('*')`.

### 4. Prayer API called twice — DashboardPrayerCard + TodayTimeline
Both components independently call the Aladhan API via `fetchPrayerTimesForTimeline`. The prayer card also calls it on its own.

**Fix:** Fetch once in DashboardPanel and pass prayer times as props to both components.

### 5. QueryClient has no `staleTime` — refetches on every mount
The default `new QueryClient()` has `staleTime: 0`, meaning every component mount triggers a refetch even if data was just fetched.

**Fix:** Set sensible defaults: `staleTime: 5 * 60 * 1000` (5 min), `gcTime: 10 * 60 * 1000`.

### 6. `select('*')` used broadly — fetches unnecessary columns
Contracts, tasks, emails all use `select('*')` returning large payloads including fields never displayed. Email `gmail_labels` arrays, `body_preview`, etc. are transferred but unused in dashboard context.

**Fix:** Use column-specific selects everywhere (already done for contacts/emails in DashboardPanel — extend to tasks/contracts).

---

## Plan

### 1. Create AuthContext Provider
Convert `useAuth` from independent hook to Context + Provider. Single auth listener, single profile fetch, all 91 consumers share state.

**Files:** `src/contexts/AuthContext.tsx` (new), `src/hooks/useAuth.ts` (rewrite to consume context), `src/App.tsx` (wrap with provider)

### 2. Configure QueryClient defaults
Add `staleTime: 5 * 60 * 1000` and `gcTime: 10 * 60 * 1000` to prevent redundant refetches.

**File:** `src/App.tsx`

### 3. Optimize DashboardPanel queries
- Tasks: add `.eq('completed', false)` and select only needed columns
- Contracts: select only `id, name, renewal_date, cancellation_notice_days, auto_renews`
- Remove duplicate prayer API call — fetch once, pass as props

**File:** `src/components/dashboard/DashboardPanel.tsx`, `src/components/dashboard/TodayTimeline.tsx`

### 4. Create lightweight `useUnreadEmailCount` hook
For Sidebar and other places that only need the count, not 200 email rows. Uses `.select('id', { count: 'exact', head: true })`.

**File:** `src/hooks/useUnreadEmailCount.ts` (new), `src/components/layout/Sidebar.tsx`

### 5. Deduplicate prayer time fetches
Have DashboardPanel fetch prayer times once and pass to both DashboardPrayerCard and TodayTimeline as props instead of each fetching independently.

**Files:** `src/components/dashboard/DashboardPanel.tsx`, `src/components/dashboard/DashboardPrayerCard.tsx`, `src/components/dashboard/TodayTimeline.tsx`

---

## Impact Summary

| # | Fix | Requests Saved | Data Saved |
|---|-----|---------------|------------|
| 1 | AuthContext | ~10 profile fetches/page | High |
| 2 | QueryClient staleTime | Varies, prevents refetch spam | Medium |
| 3 | Dashboard query optimization | Same count, smaller payloads | Medium |
| 4 | Unread count hook | 3-4 full email fetches → 1 count query | High |
| 5 | Prayer dedup | 1 API call saved per dashboard load | Low |

Total estimated reduction: **~60-70% fewer database requests** on dashboard load, **~50% less data transferred**.

