-- FULL V2V SCHEMA (create all objects). Run AFTER drop script if resetting.
-- Idempotent where possible (IF NOT EXISTS / add column if not exists). RLS dev-permissive.

-- 1. Core users table
CREATE TABLE IF NOT EXISTS public.v2v_users (
  email TEXT PRIMARY KEY,
  full_name TEXT,
  password_hash TEXT,
  vehicle JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

-- trigger
DROP TRIGGER IF EXISTS trg_v2v_users_updated ON public.v2v_users;
CREATE TRIGGER trg_v2v_users_updated
BEFORE UPDATE ON public.v2v_users
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_v2v_users_vehicle_gin ON public.v2v_users USING gin (vehicle);
CREATE INDEX IF NOT EXISTS idx_v2v_users_vehicle_vehicleid ON public.v2v_users ((vehicle->>'vehicleId'));

-- 2. Vehicles table (dynamic presence + latest snapshot)
CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  name TEXT,
  driver_name TEXT,
  license_plate TEXT,
  model TEXT,
  color TEXT,
  last_lat DOUBLE PRECISION,
  last_lon DOUBLE PRECISION,
  last_heading DOUBLE PRECISION,
  last_speed DOUBLE PRECISION,
  online BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vehicles_online ON public.vehicles(online);

-- 3. Location history (append-only)
CREATE TABLE IF NOT EXISTS public.location_history (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_location_history_vehicle_time ON public.location_history(vehicle_id, created_at DESC);

-- 4. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY,
  sender_id TEXT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  recipient_id TEXT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_participants_time ON public.messages(sender_id, recipient_id, created_at DESC);

-- 5. Emergency alerts
CREATE TABLE IF NOT EXISTS public.emergency_alerts (
  id UUID PRIMARY KEY,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  alert_type TEXT,
  severity INT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. Proximity events
CREATE TABLE IF NOT EXISTS public.proximity_events (
  id UUID PRIMARY KEY,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  peer_vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  distance_m DOUBLE PRECISION,
  occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proximity_events_vehicle_time ON public.proximity_events(vehicle_id, occurred_at DESC);

-- 7. Call sessions
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id UUID PRIMARY KEY,
  caller_id TEXT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  callee_id TEXT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  state TEXT,
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  last_signal_at TIMESTAMPTZ,
  end_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_call_sessions_started ON public.call_sessions(started_at DESC);

-- 8. (Optional future) User settings table
CREATE TABLE IF NOT EXISTS public.v2v_user_settings (
  email TEXT REFERENCES public.v2v_users(email) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY(email, key)
);

-- Ensure updated_at column exists (for idempotent reruns)
ALTER TABLE public.v2v_user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 9. Enable RLS
ALTER TABLE public.v2v_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proximity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2v_user_settings ENABLE ROW LEVEL SECURITY;

-- 10. Dev-permissive policies (replace later with real auth rules)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='v2v_users' AND policyname='v2v_users_full_access') THEN
    CREATE POLICY v2v_users_full_access ON public.v2v_users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' AND policyname='vehicles_full_access') THEN
    CREATE POLICY vehicles_full_access ON public.vehicles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='location_history' AND policyname='location_history_full_access') THEN
    CREATE POLICY location_history_full_access ON public.location_history FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_full_access') THEN
    CREATE POLICY messages_full_access ON public.messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='emergency_alerts' AND policyname='emergency_full_access') THEN
    CREATE POLICY emergency_full_access ON public.emergency_alerts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proximity_events' AND policyname='proximity_full_access') THEN
    CREATE POLICY proximity_full_access ON public.proximity_events FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='call_sessions' AND policyname='call_sessions_full_access') THEN
    CREATE POLICY call_sessions_full_access ON public.call_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='v2v_user_settings' AND policyname='v2v_user_settings_full_access') THEN
    CREATE POLICY v2v_user_settings_full_access ON public.v2v_user_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- 11. Minimal test queries (comment out after running)
-- select * from public.v2v_users limit 1;
-- select * from public.vehicles limit 1;
-- select * from public.location_history limit 1;

-- Done.
