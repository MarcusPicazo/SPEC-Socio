-- Internal operators (the Socio team). Rows are managed by the service role
-- from the Supabase dashboard / SQL editor; there is no self-service signup.
create table if not exists public.operators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

alter table public.operators enable row level security;

-- An operator may read their own row (used by the frontend to confirm role).
-- Writes are left to the service role only — no insert/update/delete policy.
create policy "operators_select_own"
  on public.operators
  for select
  to authenticated
  using (user_id = auth.uid());

-- security definer so policies on other tables can call this without
-- depending on operators' own RLS policies (and without any recursion risk).
create or replace function public.is_operator()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.operators o where o.user_id = auth.uid()
  );
$$;

revoke all on function public.is_operator() from public;
grant execute on function public.is_operator() to authenticated;
