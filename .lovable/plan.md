

# Move Everything Important to the Dashboard (Remove Popup)

## What Changes

The Morning Briefing popup that appears when you open the app will be removed. Instead, all the important daily information it contained will be added directly to the dashboard so you see everything at a glance without dismissing anything.

## What the Dashboard Will Gain

Currently the dashboard shows: greeting, focus task, stats, today's timeline (tasks only), and quick actions. After this change it will also include:

- **Weather widget** -- compact card showing current temperature, condition, and location
- **Today's events** -- the timeline will show both tasks AND calendar events merged chronologically
- **Contract alerts** -- upcoming renewal deadlines and cancellation notices shown as alert cards
- **Contact follow-ups** -- contacts overdue for a check-in shown as a compact reminder

## Files to Change

### 1. Remove the Morning Briefing popup (`src/pages/Index.tsx`)
- Remove the `showMorningDigest` state and the `MorningBriefing` component render
- The briefing component files stay in the codebase (no deletion needed) but are no longer mounted on load

### 2. Enhance Dashboard Panel (`src/components/dashboard/DashboardPanel.tsx`)
- Fetch today's **events** from the `events` table in addition to tasks
- Fetch **contract alerts** (contracts with renewals in the next 14 days)
- Fetch **contacts due for follow-up** (contacts not contacted in 30+ days)
- Fetch **weather data** using the existing `useWeather` hook
- Pass events to the `TodayTimeline` component
- Add new inline cards for weather, contract alerts, and contact reminders

### 3. New compact widget: Weather Card (`src/components/dashboard/WeatherCard.tsx`)
- Small card showing temperature, weather icon, condition, and location
- Uses the existing `useWeather` hook (already built)
- Fits into the dashboard grid (1 column on desktop)

### 4. New compact widget: Contract Alerts Card (`src/components/dashboard/ContractAlertsCard.tsx`)
- Shows contracts with upcoming cancellation deadlines or renewals (next 14 days)
- Each alert shows: contract name, days left, type (renewal/cancellation)
- "View all" link navigates to the contracts panel
- Only renders if there are active alerts

### 5. New compact widget: Contact Reminders Card (`src/components/dashboard/ContactRemindersCard.tsx`)
- Shows up to 3 contacts overdue for follow-up
- Each shows: name, days since last contact
- "Reach out" link navigates to contacts panel
- Only renders if there are overdue contacts

## Dashboard Layout (Updated)

```text
+-----------------------------------------------+
|  Check-in Prompt (if needed)                   |
+-----------------------------------------------+
|  Hero Greeting                                 |
+------------------------------+----------------+
|  Focus Card (2 cols)         | Weather +       |
|                              | Stat Pills     |
+------------------------------+----------------+
|  Today Timeline (2 cols)     | Smart Insight   |
|  (tasks + events merged)     |                |
+------------------------------+----------------+
|  Contract Alerts (if any)    | Contact         |
|  (2 cols)                    | Reminders       |
+------------------------------+----------------+
|  Quick Actions                                 |
+-----------------------------------------------+
```

## Technical Details

### Event fetching in DashboardPanel
```typescript
// Fetch today's events
const { data: eventData } = await supabase
  .from('events')
  .select('*')
  .eq('user_id', userId)
  .gte('start_time', startOfDay(new Date()).toISOString())
  .lte('start_time', endOfDay(new Date()).toISOString());
```

### Contract alerts query
```typescript
const { data: contractData } = await supabase
  .from('contracts')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true)
  .not('renewal_date', 'is', null);
// Then filter client-side for renewals within 14 days
```

### Contact reminders query
```typescript
const { data: contactData } = await supabase
  .from('user_contacts')
  .select('id, name, last_contacted_at')
  .eq('user_id', userId)
  .lt('last_contacted_at', subDays(new Date(), 30).toISOString())
  .order('last_contacted_at', { ascending: true })
  .limit(3);
```

All new cards follow the existing GlassCard design pattern used throughout the dashboard.
