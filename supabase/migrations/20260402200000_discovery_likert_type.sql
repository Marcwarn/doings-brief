-- Add 'likert' question type to discovery_questions
-- Drop old check constraint and add new one including 'likert'
alter table public.discovery_questions
  drop constraint if exists discovery_questions_type_check;

alter table public.discovery_questions
  add constraint discovery_questions_type_check
  check (type in ('open', 'choice', 'scale', 'likert'));

-- Add columns for likert importance dimension (reuses scale fields for agreement)
-- agreement uses scale_min/scale_max/scale_min_label/scale_max_label (already exist)
-- importance uses new columns
alter table public.discovery_questions
  add column if not exists likert_importance_min integer,
  add column if not exists likert_importance_max integer,
  add column if not exists likert_importance_min_label text,
  add column if not exists likert_importance_max_label text;

-- discovery_responses: add likert columns for storing both dimensions
alter table public.discovery_responses
  add column if not exists likert_agreement integer,
  add column if not exists likert_importance integer;
