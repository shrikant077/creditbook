-- CreditBook schema. Run once in Supabase SQL Editor or via Supabase CLI.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  phone_e164 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  phone_e164 text not null check (left(phone_e164, 1) = '+' and substring(phone_e164 from 2) ~ '^[1-9][0-9]{7,14}$'),
  claim_code_hash text,
  claim_code_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, phone_e164),
  unique (id, store_id)
);

create table if not exists public.credit_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  customer_id uuid not null,
  description text not null check (char_length(trim(description)) between 1 and 500),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 100000000000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (customer_id, store_id) references public.customers(id, store_id) on delete restrict
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  customer_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 100000000000),
  method text not null check (method in ('razorpay', 'cash', 'upi', 'bank_transfer')),
  status text not null check (status in ('pending', 'captured', 'failed', 'refunded')),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  recorded_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (customer_id, store_id) references public.customers(id, store_id) on delete restrict,
  check ((method = 'razorpay' and recorded_by is null) or (method <> 'razorpay' and recorded_by is not null))
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Phone-level throttling for one-time store access-code claims.
create table if not exists public.customer_claim_attempts (
  phone_e164 text primary key,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists customers_store_created_idx on public.customers(store_id, created_at desc);
create index if not exists customers_user_idx on public.customers(user_id) where user_id is not null;
create index if not exists credit_entries_customer_created_idx on public.credit_entries(customer_id, created_at desc);
create index if not exists payments_customer_created_idx on public.payments(customer_id, created_at desc);
create unique index if not exists one_pending_online_payment_per_customer
  on public.payments(customer_id)
  where method = 'razorpay' and status = 'pending';

-- New auth users get a profile. Store sign-ups also create their store, even if email confirmation is enabled.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_name text;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  v_store_name := nullif(trim(new.raw_user_meta_data ->> 'store_name'), '');
  if new.raw_user_meta_data ->> 'account_type' = 'store_owner' and v_store_name is not null then
    insert into public.stores (owner_id, name)
    values (new.id, v_store_name)
    on conflict (owner_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at before update on public.stores for each row execute procedure public.set_updated_at();
drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers for each row execute procedure public.set_updated_at();
drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments for each row execute procedure public.set_updated_at();

-- RLS on every exposed table.
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.customers enable row level security;
alter table public.credit_entries enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.customer_claim_attempts enable row level security;

-- Revoke broad default grants first (including TRUNCATE/DELETE); grant only the operations used by the app.
revoke all on public.profiles, public.stores, public.customers, public.credit_entries, public.payments, public.webhook_events, public.customer_claim_attempts from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.stores to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert on public.credit_entries to authenticated;
grant select, insert on public.payments to authenticated;

-- SECURITY DEFINER helpers avoid recursive RLS joins between stores and customers.
create or replace function public.owns_store(p_store_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.stores s where s.id = p_store_id and s.owner_id = auth.uid()) $$;

create or replace function public.has_customer_at_store(p_store_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.customers c where c.store_id = p_store_id and c.user_id = auth.uid()) $$;

create or replace function public.can_access_customer(p_customer_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.customers c join public.stores s on s.id = c.store_id
    where c.id = p_customer_id and (c.user_id = auth.uid() or s.owner_id = auth.uid())
  )
$$;
revoke all on function public.owns_store(uuid), public.has_customer_at_store(uuid), public.can_access_customer(uuid) from public, anon;
grant execute on function public.owns_store(uuid), public.has_customer_at_store(uuid), public.can_access_customer(uuid) to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "stores_select_owner_or_linked_customer" on public.stores for select to authenticated
using (owner_id = (select auth.uid()) or public.has_customer_at_store(id));
create policy "stores_insert_owner" on public.stores for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "stores_update_owner" on public.stores for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "customers_select_owner_or_customer" on public.customers for select to authenticated
using (user_id = (select auth.uid()) or public.owns_store(store_id));
create policy "customers_insert_store_owner" on public.customers for insert to authenticated
with check (public.owns_store(store_id));
create policy "customers_update_store_owner" on public.customers for update to authenticated
using (public.owns_store(store_id)) with check (public.owns_store(store_id));

create policy "credits_select_owner_or_customer" on public.credit_entries for select to authenticated
using (public.can_access_customer(customer_id));
create policy "credits_insert_store_owner" on public.credit_entries for insert to authenticated
with check (created_by = (select auth.uid()) and public.owns_store(store_id));

create policy "payments_select_owner_or_customer" on public.payments for select to authenticated
using (public.can_access_customer(customer_id));
create policy "payments_insert_offline_by_owner" on public.payments for insert to authenticated
with check (
  method in ('cash', 'upi', 'bank_transfer')
  and status = 'captured'
  and recorded_by = (select auth.uid())
  and public.owns_store(store_id)
);

-- Service-role-only claim operation with phone-level brute-force throttling.
create or replace function public.claim_customer_record(p_phone_e164 text, p_claim_hash text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts public.customer_claim_attempts%rowtype;
  v_customer_id uuid;
begin
  insert into public.customer_claim_attempts (phone_e164) values (p_phone_e164)
  on conflict (phone_e164) do nothing;
  select * into v_attempts from public.customer_claim_attempts where phone_e164 = p_phone_e164 for update;
  if v_attempts.locked_until is not null and v_attempts.locked_until > now() then
    return null;
  end if;

  select c.id into v_customer_id from public.customers c
  where c.phone_e164 = p_phone_e164
    and c.claim_code_hash = p_claim_hash
    and c.claim_code_expires_at > now()
    and c.user_id is null
  order by c.created_at desc
  limit 1
  for update;

  if v_customer_id is null then
    update public.customer_claim_attempts
    set attempt_count = attempt_count + 1,
        locked_until = case when attempt_count + 1 >= 10 then now() + interval '1 hour' else null end,
        updated_at = now()
    where phone_e164 = p_phone_e164;
    return null;
  end if;

  update public.customers
  set user_id = p_user_id, claim_code_hash = null, claim_code_expires_at = null
  where id = v_customer_id;
  update public.customer_claim_attempts
  set attempt_count = 0, locked_until = null, updated_at = now()
  where phone_e164 = p_phone_e164;
  return v_customer_id;
end;
$$;
revoke all on function public.claim_customer_record(text, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_customer_record(text, text, uuid) to service_role;

-- Read balance only when caller is the linked customer or the store owner.
create or replace function public.get_customer_balance(p_customer_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if not exists (
    select 1 from public.customers c join public.stores s on s.id = c.store_id
    where c.id = p_customer_id and (c.user_id = auth.uid() or s.owner_id = auth.uid())
  ) then
    raise exception 'Not authorized to view this customer balance';
  end if;
  select
    coalesce((select sum(ce.amount_paise) from public.credit_entries ce where ce.customer_id = p_customer_id), 0)
    - coalesce((select sum(p.amount_paise) from public.payments p where p.customer_id = p_customer_id and p.status = 'captured'), 0)
  into v_balance;
  return greatest(coalesce(v_balance, 0), 0);
end;
$$;
revoke all on function public.get_customer_balance(uuid) from public, anon;
grant execute on function public.get_customer_balance(uuid) to authenticated;

-- Customer-only reservation. Locks the customer row and permits one active Razorpay order at a time.
create or replace function public.reserve_customer_payment(p_customer_id uuid, p_amount_paise bigint)
returns table(payment_id uuid, amount_paise bigint, razorpay_order_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_balance bigint;
  v_pending public.payments%rowtype;
  v_id uuid;
begin
  select * into v_customer from public.customers
  where id = p_customer_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'Customer account not linked to this login'; end if;

  select
    coalesce((select sum(ce.amount_paise) from public.credit_entries ce where ce.customer_id = p_customer_id), 0)
    - coalesce((select sum(p.amount_paise) from public.payments p where p.customer_id = p_customer_id and p.status = 'captured'), 0)
  into v_balance;
  v_balance := greatest(coalesce(v_balance, 0), 0);
  if p_amount_paise is null or p_amount_paise < 100 or p_amount_paise > v_balance then
    raise exception 'Payment amount must be at least INR 1 and cannot exceed the outstanding balance';
  end if;

  select * into v_pending from public.payments
  where customer_id = p_customer_id and method = 'razorpay' and status = 'pending'
  order by created_at desc limit 1 for update;
  if found then
    if v_pending.razorpay_order_id is not null then
      -- Razorpay Orders do not have a general expiry field. Reuse the same order rather than creating a second payable order.
      return query select v_pending.id, v_pending.amount_paise, v_pending.razorpay_order_id;
      return;
    elsif v_pending.created_at > now() - interval '2 minutes' then
      raise exception 'A payment order is already being prepared. Please retry shortly.';
    else
      -- No order id was saved, so the customer never received a payable order from this reservation.
      update public.payments set status = 'failed', updated_at = now() where id = v_pending.id;
    end if;
  end if;

  insert into public.payments (store_id, customer_id, amount_paise, method, status)
  values (v_customer.store_id, p_customer_id, p_amount_paise, 'razorpay', 'pending')
  returning id into v_id;
  return query select v_id, p_amount_paise, null::text;
end;
$$;
revoke all on function public.reserve_customer_payment(uuid, bigint) from public, anon;
grant execute on function public.reserve_customer_payment(uuid, bigint) to authenticated;

-- Store-owner offline payment. A live pending online order blocks offline recording to prevent double collection.
create or replace function public.record_offline_payment(p_customer_id uuid, p_amount_paise bigint, p_method text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_balance bigint;
  v_id uuid;
begin
  select c.* into v_customer
  from public.customers c join public.stores s on s.id = c.store_id
  where c.id = p_customer_id and s.owner_id = auth.uid()
  for update of c;
  if not found then raise exception 'Not authorized to record payment for this customer'; end if;
  if p_method not in ('cash', 'upi', 'bank_transfer') then raise exception 'Invalid offline payment method'; end if;
  if p_amount_paise is null or p_amount_paise < 1 then raise exception 'Invalid payment amount'; end if;
  update public.payments
  set status = 'failed', updated_at = now()
  where customer_id = p_customer_id and method = 'razorpay' and status = 'pending'
    and razorpay_order_id is null and created_at <= now() - interval '2 minutes';
  if exists (select 1 from public.payments p where p.customer_id = p_customer_id and p.method = 'razorpay' and p.status = 'pending') then
    raise exception 'An online payment order is still active. Ask the customer to complete that order before recording an offline payment.';
  end if;
  select
    coalesce((select sum(ce.amount_paise) from public.credit_entries ce where ce.customer_id = p_customer_id), 0)
    - coalesce((select sum(p.amount_paise) from public.payments p where p.customer_id = p_customer_id and p.status = 'captured'), 0)
  into v_balance;
  v_balance := greatest(coalesce(v_balance, 0), 0);
  if p_amount_paise > v_balance then raise exception 'Payment cannot exceed the outstanding balance'; end if;
  insert into public.payments (store_id, customer_id, amount_paise, method, status, recorded_by)
  values (v_customer.store_id, p_customer_id, p_amount_paise, p_method, 'captured', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_offline_payment(uuid, bigint, text) from public, anon;
grant execute on function public.record_offline_payment(uuid, bigint, text) to authenticated;

-- Service-role-only payment confirmation used by Checkout verification.
create or replace function public.capture_razorpay_payment(p_order_id text, p_payment_id text, p_amount_paise bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where razorpay_order_id = p_order_id for update;
  if not found then raise exception 'Payment order not found'; end if;
  if v_payment.amount_paise <> p_amount_paise then raise exception 'Payment amount mismatch'; end if;
  if v_payment.status = 'captured' and v_payment.razorpay_payment_id = p_payment_id then return true; end if;
  if v_payment.status <> 'pending' then raise exception 'Payment is not pending'; end if;
  update public.payments
  set status = 'captured', razorpay_payment_id = p_payment_id, updated_at = now()
  where id = v_payment.id;
  return true;
end;
$$;
revoke all on function public.capture_razorpay_payment(text, text, bigint) from public, anon, authenticated;
grant execute on function public.capture_razorpay_payment(text, text, bigint) to service_role;

-- Service-role-only webhook inbox and captured-payment reconciliation. Event insert + update are atomic.
create or replace function public.process_razorpay_webhook(p_event_id text, p_event_type text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_row_id uuid;
  v_order_id text;
  v_payment_id text;
  v_amount bigint;
  v_payment public.payments%rowtype;
begin
  insert into public.webhook_events (provider_event_id, event_type, payload)
  values (p_event_id, p_event_type, p_payload)
  on conflict (provider_event_id) do nothing
  returning id into v_event_row_id;
  if v_event_row_id is null then return true; end if;

  if p_event_type = 'payment.captured' then
    v_order_id := p_payload #>> '{payload,payment,entity,order_id}';
    v_payment_id := p_payload #>> '{payload,payment,entity,id}';
    v_amount := nullif(p_payload #>> '{payload,payment,entity,amount}', '')::bigint;
    if v_order_id is null or v_payment_id is null or v_amount is null then
      raise exception 'Malformed payment.captured webhook payload';
    end if;
    if p_payload #>> '{payload,payment,entity,currency}' is distinct from 'INR' then
      raise exception 'Unexpected webhook currency';
    end if;
    select * into v_payment from public.payments where razorpay_order_id = v_order_id for update;
    if not found then raise exception 'No local payment matches Razorpay order'; end if;
    if v_payment.amount_paise <> v_amount then raise exception 'Webhook payment amount mismatch'; end if;
    if v_payment.status = 'pending' then
      update public.payments set status = 'captured', razorpay_payment_id = v_payment_id, updated_at = now()
      where id = v_payment.id;
    elsif v_payment.status <> 'captured' or v_payment.razorpay_payment_id <> v_payment_id then
      raise exception 'Payment state conflict while processing webhook';
    end if;
  end if;

  update public.webhook_events set processed_at = now() where id = v_event_row_id;
  return true;
end;
$$;
revoke all on function public.process_razorpay_webhook(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.process_razorpay_webhook(text, text, jsonb) to service_role;

-- Only the service role can inspect or mutate webhook events.
revoke all on public.webhook_events from anon, authenticated;
grant all on public.webhook_events, public.customer_claim_attempts to service_role;
