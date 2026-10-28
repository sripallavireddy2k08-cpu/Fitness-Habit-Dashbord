-- Fitness Habit Dashboard schema
-- Run in Supabase Dashboard > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name varchar(60) not null check (char_length(trim(name)) between 2 and 60),
  email varchar(254) not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  name varchar(70) not null check (char_length(trim(name)) between 2 and 70),
  category varchar(24) not null default 'Movement'
    check (category in ('Movement','Strength','Hydration','Mindfulness','Sleep','Nutrition','Other')),
  target varchar(80) not null default '',
  color varchar(12) not null default 'mint' check (color in ('mint','peach','lilac','blue')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists habits_user_created_idx on public.habits(user_id, created_at desc);
create index if not exists habits_user_archived_idx on public.habits(user_id, archived_at);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  log_date date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index if not exists habit_logs_user_date_idx on public.habit_logs(user_id, log_date desc);
create index if not exists habit_logs_habit_date_idx on public.habit_logs(habit_id, log_date desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at before update on public.habits
for each row execute function public.set_updated_at();

-- All database access goes through the Express backend, which verifies the user's
-- signed token and adds user_id filters. Browser/anon access is not permitted.
alter table public.app_users enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
revoke all on public.app_users, public.habits, public.habit_logs from anon, authenticated;
