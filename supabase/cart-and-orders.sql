-- =====================================================================
-- Cart & Orders — additive migration (safe to run alongside the
-- existing schema). Adds a price to books and a full orders table.
-- =====================================================================

-- Books need a real price to be purchasable
alter table public.books add column if not exists price_ghs numeric(10,2) not null default 0;

-- ---------------------------------------------------------------------
-- ORDERS
-- One row per checkout attempt. Created as 'pending' by the public site
-- right before Paystack opens; flipped to 'paid' only by the
-- verify-payment Edge Function after confirming with Paystack directly
-- (never trust the browser's "success" callback alone for this).
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  items jsonb not null,            -- [{ book_id, title, unit_price, qty }]
  total_amount numeric(10,2) not null,
  currency text not null default 'GHS',
  paystack_reference text not null unique,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.orders enable row level security;

-- Public can create a pending order (needed before opening the Paystack
-- popup) but can never read orders back, and can never set status
-- themselves to anything other than 'pending'.
drop policy if exists "public can create pending orders" on public.orders;
create policy "public can create pending orders" on public.orders
  for insert with check (status = 'pending');

-- Admin (dashboard login) can see and manage all orders.
drop policy if exists "admin full access orders" on public.orders;
create policy "admin full access orders" on public.orders
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Note: there is intentionally NO public select/update policy on orders.
-- Only the verify-payment Edge Function (using the service role key,
-- which bypasses RLS) is allowed to flip a pending order to paid.
