-- Supabase SQL schema for shared suggestion board
-- Enable extensions if needed
create extension if not exists pgcrypto; -- for gen_random_uuid()

-- Tables
create table if not exists settings (
  id bigint primary key generated always as identity,
  accepting boolean not null default true
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists contributors (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  name text,
  company text,
  via text,
  created_at timestamptz not null default now()
);

create table if not exists votes (
  topic_id uuid not null references topics(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  primary key (topic_id, visitor_id)
);

create table if not exists completed (
  id uuid primary key,
  title text not null,
  score integer not null,
  contributors jsonb not null default '[]'::jsonb,
  completed_at date,
  video_url text
);

-- Seed a settings row if none exists
insert into settings (accepting)
select true
where not exists (select 1 from settings);

-- RPC to increment topic score atomically
create or replace function increment_topic_score(p_topic_id uuid, p_amount integer)
returns void language sql as $$
  update topics set score = score + p_amount where id = p_topic_id;
$$;

-- Noop RPC used as placeholder (can be ignored)
create or replace function noop()
returns integer language sql as $$ select 1; $$;
