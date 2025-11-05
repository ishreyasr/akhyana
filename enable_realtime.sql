-- Enable Supabase Realtime for V2V tables
-- Run these commands in your Supabase SQL editor

-- 1. Enable realtime for vehicles table (most important for nearby detection)
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;

-- 2. Enable realtime for location_history (for live location tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_history;

-- 3. Enable realtime for proximity_events (for enter/exit events)
ALTER PUBLICATION supabase_realtime ADD TABLE public.proximity_events;

-- 4. Enable realtime for messages (for live messaging)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 5. Enable realtime for emergency_alerts (for live emergency notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;

-- Optional: Check which tables are currently enabled for realtime
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Note: You can also enable realtime via Supabase Dashboard:
-- 1. Go to Database > Replication
-- 2. Click on each table and toggle "Enable Realtime"
-- 3. Make sure these tables are enabled:
--    - vehicles (CRITICAL - this is where nearby vehicle data is stored)
--    - location_history (for live location updates)
--    - proximity_events (for enter/exit notifications)
--    - messages (for live messaging)
--    - emergency_alerts (for emergency notifications)
