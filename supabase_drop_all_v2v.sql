-- DROP SCRIPT (run carefully). This removes all V2V-related tables & policies.
-- Execute in Supabase SQL editor. Order chosen to satisfy FK dependencies.

-- 1. Drop policies (optional: CASCADE would also remove them with tables)
DO $$
DECLARE r RECORD; BEGIN
  FOR r IN (
    SELECT polname, schemaname, tablename FROM pg_policies
    WHERE schemaname='public' AND tablename IN (
      'location_history','messages','emergency_alerts','proximity_events','call_sessions','vehicles','v2v_users','v2v_user_settings'
    )
  ) LOOP
    EXECUTE format('drop policy if exists %I on public.%I;', r.polname, r.tablename);
  END LOOP; END $$;

-- 2. Drop tables (child -> parent order)
DROP TABLE IF EXISTS public.location_history CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.emergency_alerts CASCADE;
DROP TABLE IF EXISTS public.proximity_events CASCADE;
DROP TABLE IF EXISTS public.call_sessions CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;
DROP TABLE IF EXISTS public.v2v_user_settings CASCADE;
DROP TABLE IF EXISTS public.v2v_users CASCADE;

-- 3. (Optional) Drop helper trigger function
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

-- After this, run supabase_full_schema_v2v.sql to recreate everything.
