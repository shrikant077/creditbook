-- Customer accounts now use email + password. Shop access codes are entered
-- after sign-in and link each individual shop customer record to the global user.
-- No email is sent during customer signup, so this migration also adds a small
-- server-side IP-hash rate limiter for public customer account creation.

create table if not exists public.customer_signup_attempts (
  ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_signup_attempts enable row level security;
revoke all on public.customer_signup_attempts from anon, authenticated;
grant all on public.customer_signup_attempts to service_role;

create or replace function public.allow_customer_signup(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts public.customer_signup_attempts%rowtype;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  insert into public.customer_signup_attempts (ip_hash)
  values (p_ip_hash)
  on conflict (ip_hash) do nothing;

  select * into v_attempts
  from public.customer_signup_attempts
  where ip_hash = p_ip_hash
  for update;

  if v_attempts.window_started_at < now() - interval '1 hour' then
    update public.customer_signup_attempts
    set attempt_count = 1,
        window_started_at = now(),
        updated_at = now()
    where ip_hash = p_ip_hash;
    return true;
  end if;

  if v_attempts.attempt_count >= 20 then
    return false;
  end if;

  update public.customer_signup_attempts
  set attempt_count = attempt_count + 1,
      updated_at = now()
  where ip_hash = p_ip_hash;

  return true;
end;
$$;

revoke all on function public.allow_customer_signup(text) from public, anon, authenticated;
grant execute on function public.allow_customer_signup(text) to service_role;
