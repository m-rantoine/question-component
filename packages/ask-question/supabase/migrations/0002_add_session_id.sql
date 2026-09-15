-- Separates runs of the same questions: class periods, sections, or the same
-- lesson taught again next term.
--
-- Nullable and additive on purpose. Rows written before this migration keep
-- session_id = null, which the dashboard shows as "no session" and includes
-- under "all sessions". Nothing is rewritten and nothing is dropped.

alter table public.answers
  add column if not exists session_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'answers_session_id_check'
  ) then
    alter table public.answers
      add constraint answers_session_id_check
      check (session_id is null or session_id ~ '^[A-Za-z0-9_.-]{1,64}$');
  end if;
end $$;

comment on column public.answers.session_id is
  'Optional run identifier — a class period, section or term. Null means unscoped.';

-- The dashboard reads one group, optionally narrowed to one session, in time order.
create index if not exists answers_group_session_created_idx
  on public.answers (group_id, session_id, created_at);
