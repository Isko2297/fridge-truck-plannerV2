-- LoadPilot Supabase setup
-- Run this whole file in Supabase SQL Editor.

create table if not exists public.fridge_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  length_m numeric not null,
  width_m numeric not null,
  height_m numeric not null,
  created_at timestamptz default now()
);

create table if not exists public.planner_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  truck_length numeric not null default 13.6,
  truck_width numeric not null default 2.45,
  truck_height numeric not null default 2.7,
  pallet_length numeric not null default 1.2,
  pallet_width numeric not null default 0.8,
  updated_at timestamptz default now()
);

create table if not exists public.load_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  truck_length numeric,
  truck_width numeric,
  result_json jsonb,
  created_at timestamptz default now()
);

alter table public.fridge_models enable row level security;
alter table public.planner_settings enable row level security;
alter table public.load_plans enable row level security;

drop policy if exists "Users manage own fridge models" on public.fridge_models;
drop policy if exists "Users manage own planner settings" on public.planner_settings;
drop policy if exists "Users manage own load plans" on public.load_plans;

create policy "Users manage own fridge models"
on public.fridge_models for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage own planner settings"
on public.planner_settings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage own load plans"
on public.load_plans for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Optional: require email confirmation according to your Supabase Auth settings.
