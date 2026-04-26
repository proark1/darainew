-- Travel concierge: multi-leg itinerary + weather cache.
--
-- The trips / trip_bookings / packing_lists / country_essentials
-- schema already exists. This migration fills the gaps:
--
--   1. trip_segments     — ordered legs of a trip (depart → arrive,
--                          mode, duration). trip_bookings is for
--                          confirmation numbers; segments is for the
--                          itinerary the user actually walks through.
--   2. weather_snapshots — cached forecast lookups keyed by
--                          (lat, lon rounded, date). 6h TTL via
--                          updated_at; the weather-forecast edge fn
--                          serves from cache when fresh.
--   3. ALTER trips: lat/lon, timezone, weather_summary, packing_status.
--                   Lets the dashboard render a trip card without
--                   joining anything.
--   4. ALTER packing_lists: status field + computed counts via view.
--   5. trip_overview view: one query for the dashboard — trip + days
--                          until + packing progress + segment count.

-- ============================================================
-- 1. trip_segments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trip_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  -- 0-based ordinal within the trip. UNIQUE (trip_id, idx) keeps the
  -- itinerary sane.
  idx INTEGER NOT NULL,
  -- 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'hotel' | 'activity' | 'free'
  -- Hotels and activities slot into the same ordered list as transit
  -- so the UI can render "Day 2: train to Berlin → check in to hotel"
  -- without two queries.
  segment_type TEXT NOT NULL DEFAULT 'flight'
    CHECK (segment_type IN (
      'flight', 'train', 'bus', 'car', 'ferry',
      'hotel', 'activity', 'free'
    )),
  title TEXT NOT NULL,
  -- Locations. For transit, origin → destination. For hotel/activity,
  -- origin = destination.
  origin TEXT,
  origin_lat NUMERIC,
  origin_lon NUMERIC,
  destination TEXT,
  destination_lat NUMERIC,
  destination_lon NUMERIC,
  -- Times in the LOCAL timezone of the origin (for transit) or
  -- the destination (for hotel/activity). The UI converts as needed
  -- from `timezone`.
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  timezone TEXT,
  provider TEXT,
  reference TEXT,                -- e.g. flight number, PNR, hotel name
  cost NUMERIC,
  currency TEXT,
  notes TEXT,
  -- Back-ref to trip_bookings if this segment is the same as a
  -- confirmation row. Lets the UI link "Segment 2: BA flight 123"
  -- to the boarding-pass document.
  booking_id UUID REFERENCES public.trip_bookings(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, idx)
);

CREATE INDEX IF NOT EXISTS trip_segments_user_idx
  ON public.trip_segments (user_id, start_time);
CREATE INDEX IF NOT EXISTS trip_segments_trip_idx
  ON public.trip_segments (trip_id, idx);

ALTER TABLE public.trip_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trip segments"
  ON public.trip_segments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own trip segments"
  ON public.trip_segments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own trip segments"
  ON public.trip_segments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own trip segments"
  ON public.trip_segments FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_trip_segments_updated_at
  BEFORE UPDATE ON public.trip_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. weather_snapshots
-- ============================================================
-- Cache of Open-Meteo forecast lookups. Key = (lat rounded to 0.1°,
-- lon rounded to 0.1°, date). 0.1° ≈ 11km — plenty for "should I
-- pack a coat" precision and gives us a high cache hit rate.
CREATE TABLE IF NOT EXISTS public.weather_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Rounded lat/lon — see comment above.
  lat_grid NUMERIC NOT NULL,
  lon_grid NUMERIC NOT NULL,
  date DATE NOT NULL,
  temp_min_c NUMERIC,
  temp_max_c NUMERIC,
  precipitation_mm NUMERIC,
  precipitation_probability NUMERIC,  -- 0..100
  wind_speed_max_kmh NUMERIC,
  weather_code INTEGER,                -- WMO code from Open-Meteo
  summary TEXT,                        -- human-readable single line
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lat_grid, lon_grid, date)
);

CREATE INDEX IF NOT EXISTS weather_snapshots_freshness_idx
  ON public.weather_snapshots (fetched_at DESC);

-- Public read — forecasts aren't user-specific; multi-tenant cache
-- hit benefits everyone. Writes are service-role only via the edge fn.
ALTER TABLE public.weather_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read weather"
  ON public.weather_snapshots FOR SELECT
  USING (true);

-- ============================================================
-- 3. ALTER trips: cached metadata so the dashboard avoids joins
-- ============================================================
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS destination_lat NUMERIC;
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS destination_lon NUMERIC;
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS weather_summary TEXT;
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS weather_refreshed_at TIMESTAMPTZ;

-- ============================================================
-- 4. ALTER packing_lists: per-list status
-- ============================================================
-- The items JSONB array can hold { name, packed: bool, category? }.
-- We add a top-level status for "we generated this AI-first" vs
-- "user added manually" so the UI can show the right badge.
ALTER TABLE public.packing_lists
  ADD COLUMN IF NOT EXISTS source TEXT
    DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai_generated', 'imported'));
ALTER TABLE public.packing_lists
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;
ALTER TABLE public.packing_lists
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================
-- 5. trip_overview view
-- ============================================================
-- Single-row-per-trip read for the /travel page and chat context:
-- packing progress, segment count, days until departure, etc.
CREATE OR REPLACE VIEW public.trip_overview AS
SELECT
  t.id AS trip_id,
  t.user_id,
  t.title,
  t.destination,
  t.destination_country,
  t.destination_lat,
  t.destination_lon,
  t.timezone,
  t.start_date,
  t.end_date,
  t.purpose,
  t.status,
  t.weather_summary,
  t.weather_refreshed_at,
  -- Days until departure. Negative if already started.
  (t.start_date - CURRENT_DATE) AS days_until_departure,
  (t.end_date - t.start_date) AS trip_length_days,
  -- Segment + booking + packing rollups.
  COALESCE(seg.segment_count, 0) AS segment_count,
  COALESCE(book.booking_count, 0) AS booking_count,
  COALESCE(pack.list_count, 0) AS packing_list_count,
  COALESCE(pack.total_items, 0) AS packing_total_items,
  COALESCE(pack.packed_items, 0) AS packing_packed_items,
  CASE
    WHEN COALESCE(pack.total_items, 0) = 0 THEN NULL
    ELSE ROUND((pack.packed_items::numeric / pack.total_items) * 100)
  END AS packing_pct
FROM public.trips t
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS segment_count
    FROM public.trip_segments s
   WHERE s.trip_id = t.id
) seg ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS booking_count
    FROM public.trip_bookings b
   WHERE b.trip_id = t.id
) book ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS list_count,
    COALESCE(SUM(jsonb_array_length(items)), 0) AS total_items,
    COALESCE(SUM((
      SELECT COUNT(*) FROM jsonb_array_elements(items) AS itm
       WHERE COALESCE((itm->>'packed')::boolean, false) = true
    )), 0) AS packed_items
    FROM public.packing_lists pl
   WHERE pl.trip_id = t.id
     AND jsonb_typeof(items) = 'array'
) pack ON true;

GRANT SELECT ON public.trip_overview TO authenticated, service_role;

COMMENT ON VIEW public.trip_overview IS
  'One row per trip with cached counters (segments, bookings, packing progress) and days_until_departure. Drives the /travel dashboard and chat context for "when is my next trip" queries.';
