-- Minimal stand-ins for what a Supabase project already has, so the
-- migrations can run on a plain local Postgres for tests. NEVER run this
-- against a real Supabase project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- pg_cron / pg_net / Vault stand-ins: the cron migrations only need these
-- names to exist; nothing is ever scheduled or sent in tests.
create schema if not exists cron;
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint
  language sql as $$ select 1::bigint $$;
create schema if not exists net;
create or replace function net.http_post(url text, headers jsonb default '{}'::jsonb, body jsonb default '{}'::jsonb)
  returns bigint language sql as $$ select 1::bigint $$;
create schema if not exists vault;
create table if not exists vault.decrypted_secrets (name text primary key, decrypted_secret text);

-- Storage stand-in: migrations only insert bucket rows.
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean);
