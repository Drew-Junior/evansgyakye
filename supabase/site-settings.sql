-- =====================================================================
-- Site settings  (run ONCE in Supabase -> SQL Editor -> New query -> Run)
-- Used by: Dashboard -> Site Settings (social links, hero video/poster)
-- Safe to re-run: every statement is idempotent.
-- =====================================================================

create table if not exists public.site_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

-- If the table already existed from an earlier setup, make sure it has the
-- column the dashboard writes to.
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();

alter table public.site_settings enable row level security;

-- Visitors may read ONLY settings meant to be public: keys that start with
-- social_, hero_ or public_. Anything else you add later stays private.
drop policy if exists "public read public settings" on public.site_settings;
create policy "public read public settings" on public.site_settings
  for select using (key ~ '^(social|hero|public)_');

-- The signed-in admin can read and change everything.
drop policy if exists "admin full access settings" on public.site_settings;
create policy "admin full access settings" on public.site_settings
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
