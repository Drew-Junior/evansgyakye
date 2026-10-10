-- =====================================================================
-- Evans Gyakye website — Supabase schema (SAFE TO RE-RUN)
-- Drops and recreates policies so this can be run multiple times
-- without "already exists" errors. Tables use IF NOT EXISTS already.
-- =====================================================================

create extension if not exists "pgcrypto";

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default 'Evans Gyakye',
  description text not null,
  cover_url text,
  site_purchase_url text,
  amazon_url text,
  selar_url text,
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null check (category in ('build','become','lead','think','believe')),
  excerpt text not null,
  body_html text not null,
  cover_url text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  organisation text,
  quote text not null,
  photo_url text,
  page_context text not null default 'home' check (page_context in ('home','speak')),
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.media_mentions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  media_type text not null check (media_type in ('video','podcast','radio','media','interview')),
  outlet text,
  url text,
  published_date date,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  image_url text,
  status text,
  link_url text,
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null unique,
  subscribed_at timestamptz not null default now()
);

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  enquiry_type text not null check (enquiry_type in ('speaking','advisory','books','media','partnership','general')),
  name text not null,
  email text not null,
  organisation text,
  message text not null,
  status text not null default 'new' check (status in ('new','read','archived')),
  submitted_at timestamptz not null default now()
);

alter table public.books enable row level security;
alter table public.articles enable row level security;
alter table public.testimonials enable row level security;
alter table public.media_mentions enable row level security;
alter table public.projects enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_submissions enable row level security;

drop policy if exists "public read published books" on public.books;
create policy "public read published books" on public.books
  for select using (published = true);

drop policy if exists "public read published articles" on public.articles;
create policy "public read published articles" on public.articles
  for select using (published = true);

drop policy if exists "public read published testimonials" on public.testimonials;
create policy "public read published testimonials" on public.testimonials
  for select using (published = true);

drop policy if exists "public read published media" on public.media_mentions;
create policy "public read published media" on public.media_mentions
  for select using (published = true);

drop policy if exists "public read published projects" on public.projects;
create policy "public read published projects" on public.projects
  for select using (published = true);

drop policy if exists "public can subscribe" on public.newsletter_subscribers;
create policy "public can subscribe" on public.newsletter_subscribers
  for insert with check (true);

drop policy if exists "public can submit contact form" on public.contact_submissions;
create policy "public can submit contact form" on public.contact_submissions
  for insert with check (true);

drop policy if exists "admin full access books" on public.books;
create policy "admin full access books" on public.books
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin full access articles" on public.articles;
create policy "admin full access articles" on public.articles
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin full access testimonials" on public.testimonials;
create policy "admin full access testimonials" on public.testimonials
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin full access media" on public.media_mentions;
create policy "admin full access media" on public.media_mentions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin full access projects" on public.projects;
create policy "admin full access projects" on public.projects
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin read newsletter" on public.newsletter_subscribers;
create policy "admin read newsletter" on public.newsletter_subscribers
  for select using (auth.role() = 'authenticated');

drop policy if exists "admin delete newsletter" on public.newsletter_subscribers;
create policy "admin delete newsletter" on public.newsletter_subscribers
  for delete using (auth.role() = 'authenticated');

drop policy if exists "admin read contact" on public.contact_submissions;
create policy "admin read contact" on public.contact_submissions
  for select using (auth.role() = 'authenticated');

drop policy if exists "admin update contact" on public.contact_submissions;
create policy "admin update contact" on public.contact_submissions
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin delete contact" on public.contact_submissions;
create policy "admin delete contact" on public.contact_submissions
  for delete using (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media bucket" on storage.objects;
create policy "public read media bucket" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "admin upload media bucket" on storage.objects;
create policy "admin upload media bucket" on storage.objects
  for insert with check (bucket_id = 'media' and auth.role() = 'authenticated');

drop policy if exists "admin update media bucket" on storage.objects;
create policy "admin update media bucket" on storage.objects
  for update using (bucket_id = 'media' and auth.role() = 'authenticated');

drop policy if exists "admin delete media bucket" on storage.objects;
create policy "admin delete media bucket" on storage.objects
  for delete using (bucket_id = 'media' and auth.role() = 'authenticated');
