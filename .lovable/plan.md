
User asks what family/life data is missing so Dori can be more proactive. Read-only — propose a plan.

Current family model (from `useFamilyMembers.ts`): name, relationship, school/kindergarten, teacher, allergies, medical notes, clothing sizes, activities, milestones, address. Good base, but missing many practical daily-life signals.

I'll propose categorized additions, grouped by impact, then a build batch plan.

---

# Family Data Expansion — What's Missing

## Category 1 — Health & Medical (highest forget-cost)
- **Vaccination records** per child (dates, next-due dates → auto-reminder)
- **Pediatrician / dentist / specialists** (name, phone, last visit, next checkup)
- **Medications** (name, dose, schedule, refill date)
- **Insurance info** (provider, policy #, card photo)
- **Growth log** (height/weight over time → pediatric chart)
- **Sick-day log** (date, symptoms → spot patterns)
- **Emergency contacts** (separate from regular contacts, with priority order)
- **Blood type, conditions, surgery history**

## Category 2 — School & Education
- **School calendar** (term dates, holidays, parent-teacher days, exams)
- **Homework subjects + weekly schedule** (Mon=Math, Tue=German…)
- **Report cards / grades log**
- **Required school supplies + uniforms**
- **Pickup/dropoff routine** (who, what time, by which day)
- **Classmates & friends** (names, parent contacts → playdates)
- **Tuition / fees** (link to contracts module)

## Category 3 — Activities & Logistics
- **Activity providers** (coach name, contact, fees, gear required)
- **Recurring transport rota** (who drives whom when)
- **Equipment inventory** (football boots size 32, ballet shoes…) → reorder when outgrown
- **Permission slips / forms due**

## Category 4 — Daily Life Patterns
- **Meal preferences & dislikes** per child (cooking suite already exists — extend)
- **Sleep schedule** (bedtime, wake time, naps)
- **Screen time rules**
- **Chore assignments + rotation**
- **Pocket money / allowance log**

## Category 5 — Important Documents
- **Passport** (number, expiry → auto-renewal alert 6 months out)
- **ID / birth certificate / residence permit**
- **Travel docs** (visa expiry)
- Store in existing `family-documents` bucket with metadata + expiry tracking

## Category 6 — Social & Emotional
- **Friend network** (names, parents, contact)
- **Birthday parties attended/upcoming** (with gift ideas + budget)
- **Behavior/mood notes** (light journaling per child)
- **Favorite things** (toys, books, characters → gift suggestions)

## Category 7 — Pets & Household
- **Pet profiles** (vet, vaccinations, food brand, weight)
- **Plant care schedule**
- **House maintenance** (boiler service, smoke alarm test, filter changes)
- **Vehicle service** (next inspection, insurance, tire change dates)

## Category 8 — Family Memory & Traditions
- **Family rituals** (Friday pizza night, Sunday call grandma)
- **Annual events** (anniversaries, death remembrances, religious dates)
- **Photo memory tagger** (people in photos auto-linked to family members)

---

# Proposed Build Plan — 4 Batches

**Batch A — Health & Safety Core (highest value, most forgotten)**
- Tables: `family_health_records`, `family_medications`, `family_vaccinations`, `family_emergency_contacts`, `family_documents_meta` (with expiry)
- Auto-alerts: vaccination due, passport expiring, prescription refill, checkup overdue
- Cron: daily expiry scanner → morning thread

**Batch B — School & Activity Logistics**
- Tables: `family_school_calendar`, `family_pickup_rota`, `family_classmates`, `family_equipment`
- Integration: feeds Conflict Detective + Spouse Handoff (knows who does pickup)
- Auto-alerts: homework day reminder, parent-teacher meeting prep, gear-outgrown nudge

**Batch C — Daily Life & Routines**
- Tables: `family_chores`, `family_allowance`, `family_meal_prefs`, `family_sleep_schedule`
- Integration: chore rotation auto-assigns via Spouse Handoff logic; meal prefs feed cooking suite
- Gamification hook: kid-friendly chore XP

**Batch D — Memory, Pets, Household Maintenance**
- Tables: `family_traditions`, `pets`, `household_maintenance`, `vehicle_records`
- Auto-alerts: boiler service due, anniversary tomorrow, pet vaccination
- Episodic-memory hook: traditions become annual recall ("It's pizza night")

---

## Tech Building Blocks
- Reuse: `family_members.id` as FK across all new tables
- Reuse: existing morning-thread aggregator (add new sources)
- Reuse: existing conflict-detector + spouse-handoff (add new task types)
- New cron: `family-expiry-scanner` (daily, scans docs/vaccinations/maintenance)
- UI: extend FamilyMember profile drawer with tabbed sections (Health | School | Activities | Documents | Memory)

## Recommendation
Start with **Batch A (Health & Safety)** — these are the highest-stakes "don't forget" items where a missed reminder has real consequences (expired passport before travel, missed vaccination, lapsed insurance).

**Reply with: "go A" / "go B" / "go all" / pick specific items.**
