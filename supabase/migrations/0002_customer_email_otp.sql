-- Switch customer identity verification from SMS/phone to email OTP.
-- Existing customer rows are kept; their email remains NULL until the store owner updates it.

alter table public.customers
  add column if not exists email text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_email_format_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_email_format_check
      check (email is null or (email = lower(btrim(email)) and position('@' in email) > 1));
  end if;
end $$;

-- A customer is identified within a store by their normalized email address.
create unique index if not exists customers_store_email_lower_key
  on public.customers (store_id, lower(email))
  where email is not null;

-- Remove the old phone-based RPC before replacing its temporary throttle table.
drop function if exists public.claim_customer_record(text, text, uuid);

-- Old phone-based attempt counters are no longer used. They contain only temporary
-- throttling state, so recreate them keyed by normalized email.
drop table if exists public.customer_claim_attempts;
create table public.customer_claim_attempts (
  email text primary key,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.customer_claim_attempts enable row level security;
revoke all on public.customer_claim_attempts from anon, authenticated;
grant all on public.customer_claim_attempts to service_role;

-- Replace it with an email-based claim.
create function public.claim_customer_record(p_email text, p_claim_hash text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts public.customer_claim_attempts%rowtype;
  v_customer_id uuid;
  v_email text := lower(btrim(p_email));
begin
  if v_email is null or v_email = '' then return null; end if;

  insert into public.customer_claim_attempts (email) values (v_email)
  on conflict (email) do nothing;
  select * into v_attempts
  from public.customer_claim_attempts
  where email = v_email
  for update;

  if v_attempts.locked_until is not null and v_attempts.locked_until > now() then
    return null;
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.email = v_email
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
    where email = v_email;
    return null;
  end if;

  update public.customers
  set user_id = p_user_id, claim_code_hash = null, claim_code_expires_at = null
  where id = v_customer_id;

  update public.customer_claim_attempts
  set attempt_count = 0, locked_until = null, updated_at = now()
  where email = v_email;

  return v_customer_id;
end;
$$;

revoke all on function public.claim_customer_record(text, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_customer_record(text, text, uuid) to service_role;
