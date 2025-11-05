-- Additional V2V tables (run in Supabase SQL editor)

create table if not exists public.vehicles (
  id text primary key,
  name text,
  driver_name text,
  license_plate text,
  model text,
  color text,
  last_lat double precision,
  last_lon double precision,
  last_heading double precision,
  last_speed double precision,
  online boolean default true,
  updated_at timestamptz default now() not null
);

create table if not exists public.location_history (
  id bigserial primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  heading double precision,
  speed double precision,
  accuracy double precision,
  created_at timestamptz default now() not null
);
create index if not exists idx_location_history_vehicle_time on public.location_history(vehicle_id, created_at desc);

create table if not exists public.messages (
  id uuid primary key,
  sender_id text references public.vehicles(id) on delete set null,
  recipient_id text references public.vehicles(id) on delete set null,
  content text,
  message_type text default 'text',
  created_at timestamptz default now() not null
);
create index if not exists idx_messages_participants_time on public.messages(created_at desc);

create table if not exists public.emergency_alerts (
  id uuid primary key,
  vehicle_id text references public.vehicles(id) on delete set null,
  alert_type text,
  severity int,
  details text,
  created_at timestamptz default now() not null
);

create table if not exists public.proximity_events (
  id uuid primary key,
  vehicle_id text references public.vehicles(id) on delete cascade,
  peer_vehicle_id text references public.vehicles(id) on delete cascade,
  event_type text not null,
  distance_m double precision,
  occurred_at timestamptz default now() not null
);
create index if not exists idx_proximity_events_vehicle_time on public.proximity_events(vehicle_id, occurred_at desc);

create table if not exists public.call_sessions (
  id uuid primary key,
  caller_id text references public.vehicles(id) on delete set null,
  callee_id text references public.vehicles(id) on delete set null,
  state text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  last_signal_at timestamptz,
  end_reason text
);

-- Basic RLS (optional; adjust as needed). Disable RLS during initial dev if desired.
alter table public.vehicles enable row level security;
alter table public.location_history enable row level security;
alter table public.messages enable row level security;
alter table public.emergency_alerts enable row level security;
alter table public.proximity_events enable row level security;
alter table public.call_sessions enable row level security;

-- Simple permissive policies for dev (DO NOT USE IN PROD AS-IS)
create policy if not exists vehicles_full_access on public.vehicles for all using (true) with check (true);
create policy if not exists location_history_full_access on public.location_history for all using (true) with check (true);
create policy if not exists messages_full_access on public.messages for all using (true) with check (true);
create policy if not exists emergency_full_access on public.emergency_alerts for all using (true) with check (true);
create policy if not exists proximity_full_access on public.proximity_events for all using (true) with check (true);
create policy if not exists call_sessions_full_access on public.call_sessions for all using (true) with check (true);

-- Done.
