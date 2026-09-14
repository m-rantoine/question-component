-- Ask a Question — database schema.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is written to be re-runnable: every statement is guarded.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.answers (
  -- Minted in the browser so a retried request cannot create a second row.
  id            uuid primary key,
  -- Identifies a browser session, not an authenticated user. A student who
  -- logs out and back in gets a new id on purpose; the dashboard groups by
  -- name so they still appear once.
  student_id    uuid        not null,
  student_name  text        not null check (length(btrim(student_name)) between 2 and 60),
  group_id      text        not null check (group_id ~ '^[A-Za-z0-9_.-]{1,64}$'),
  question_id   text        not null check (question_id ~ '^[A-Za-z0-9_.-]{1,64}$'),
  -- Shape depends on the question type: a string, a number, or an array of
  -- option strings for checkboxes.
  answer        jsonb       not null,
  -- Every attempt is its own row; ordering by this column is what makes
  -- "first attempt" and "latest attempt" meaningful.
  created_at    timestamptz not null default now()
);

comment on table public.answers is
  'One row per attempt. Append-only: a retry never overwrites an earlier answer.';

-- The dashboard reads a whole group in one query, ordered by time.
create index if not exists answers_group_created_idx
  on public.answers (group_id, created_at);

create index if not exists answers_group_question_idx
  on public.answers (group_id, question_id);

create index if not exists answers_student_idx
  on public.answers (student_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
--
-- The anon key ships in the browser bundle, so it is public by definition.
-- It gets INSERT and nothing else:
--
--   * no SELECT  — students cannot read the class's answers,
--   * no UPDATE  — an attempt cannot be edited after the fact,
--   * no DELETE  — an attempt cannot be removed.
--
-- The dashboard reads through /api/answers, which runs on the server with the
-- service-role key and bypasses RLS.

alter table public.answers enable row level security;
alter table public.answers force row level security;

-- Defence in depth: even if a policy is added by accident later, the role has
-- no privilege to select, update or delete.
revoke all on table public.answers from anon, authenticated;
grant insert on table public.answers to anon;

drop policy if exists "anon may insert an answer" on public.answers;
create policy "anon may insert an answer"
  on public.answers
  for insert
  to anon
  with check (true);

-- ---------------------------------------------------------------------------
-- Optional: keep the table from growing without bound
-- ---------------------------------------------------------------------------
-- Nothing here deletes data automatically. When a term ends, archive with:
--
--   create table answers_2026_spring as
--     select * from public.answers where created_at < '2026-07-01';
--   delete from public.answers where created_at < '2026-07-01';
