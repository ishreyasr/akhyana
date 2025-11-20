-- Supabase schema for V2V users (single run script)
-- Safe to re-run: guarded with IF NOT EXISTS / DROP IF EXISTS where needed.

-- 1. Table
create table if not exists public.v2v_users (
  email text primary key,
  full_name text,
  password_hash text, -- bcrypt hash (NEVER store plain password)
  vehicle jsonb, -- e.g. {"make":"Tesla","model":"3","plate":"AB12CD"}
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3. Trigger
drop trigger if exists trg_v2v_users_updated on public.v2v_users;
create trigger trg_v2v_users_updated
before update on public.v2v_users
for each row execute procedure public.set_updated_at();

-- 4. (Optional) GIN index on vehicle if querying inside JSON frequently
create index if not exists idx_v2v_users_vehicle_gin on public.v2v_users using gin (vehicle);
-- Functional index to speed lookups by nested vehicleId (JSONB -> text)
create index if not exists idx_v2v_users_vehicle_vehicleid on public.v2v_users ((vehicle->>'vehicleId'));

-- 5. Enable Row Level Security (RLS)
alter table public.v2v_users enable row level security;

-- 6. Policies (email as PK, user must be authenticated; adjust if you store uid instead)
-- Assumes auth.email() returns the authenticated user's email (Supabase Email Auth / OAuth). If using auth.uid(), store uid instead.
create policy if not exists select_own_user on public.v2v_users
  for select using (auth.email() = email);

create policy if not exists insert_own_user on public.v2v_users
  for insert with check (auth.email() = email);

create policy if not exists update_own_user on public.v2v_users
  for update using (auth.email() = email) with check (auth.email() = email);

-- 7. Upsert example (server-side) - parameterized form
-- insert into public.v2v_users (email, full_name, password_hash, vehicle)
-- values ('user@example.com','Jane Driver', '{"make":"Ford","model":"F-150"}'::jsonb)
-- on conflict (email) do update
--   set full_name = excluded.full_name,
--       password_hash = coalesce(excluded.password_hash, public.v2v_users.password_hash),
--       vehicle = coalesce(excluded.vehicle, public.v2v_users.vehicle),
--       updated_at = now();

-- 8. Select example
-- select email, full_name, vehicle, created_at, updated_at
-- from public.v2v_users where email = 'user@example.com' limit 1;

-- 9. (Optional) Settings table if needed later
-- create table if not exists public.v2v_user_settings (
--   email text references public.v2v_users(email) on delete cascade,
--   key text not null,
--   value jsonb,
--   created_at timestamptz default now() not null,
--   primary key (email, key)
-- );

-- 10. Helper to purge a user (admin/service role only)
-- delete from public.v2v_users where email = 'user@example.com';

-- Done.
