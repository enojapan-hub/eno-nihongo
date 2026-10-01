create extension if not exists pgcrypto;

create type public.jlpt_level as enum ('N5','N4','N3','N2','N1');
create type public.content_skill as enum ('kanji','vocabulary','grammar','reading','listening');
create type public.progress_status as enum ('new','learning','review','mastered');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  target_level public.jlpt_level default 'N5',
  referral_code text unique,
  role text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  reward_points integer not null default 0 check (reward_points >= 0),
  last_activity_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kanji (
  id uuid primary key default gen_random_uuid(),
  character text not null unique,
  level public.jlpt_level not null,
  onyomi text[] not null default '{}',
  kunyomi text[] not null default '{}',
  meaning_id text not null,
  meaning_en text,
  stroke_count integer,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create index kanji_level_idx on public.kanji(level, sort_order);

create table public.kanji_relations (
  id uuid primary key default gen_random_uuid(),
  kanji_id uuid not null references public.kanji(id) on delete cascade,
  related_kanji_id uuid not null references public.kanji(id) on delete cascade,
  note_id text,
  sort_order integer not null default 0,
  unique (kanji_id, related_kanji_id)
);

create table public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  reading text,
  romaji text,
  meaning_id text not null,
  meaning_en text,
  part_of_speech text,
  examples jsonb not null default '[]'::jsonb,
  level public.jlpt_level not null,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create index vocabulary_level_idx on public.vocabulary(level, sort_order);

create table public.grammar_points (
  id uuid primary key default gen_random_uuid(),
  pattern text not null,
  meaning_id text not null,
  meaning_en text,
  structure text,
  explanation_id text,
  explanation_en text,
  examples jsonb not null default '[]'::jsonb,
  level public.jlpt_level not null,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create index grammar_level_idx on public.grammar_points(level, sort_order);

create table public.reading_passages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level public.jlpt_level not null,
  body_jp text not null,
  translation_id text,
  translation_en text,
  estimated_minutes integer,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.listening_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level public.jlpt_level not null,
  audio_url text,
  transcript_jp text,
  translation_id text,
  duration_seconds integer,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  prompt_note text,
  choices jsonb not null default '[]'::jsonb,
  correct_index integer not null check (correct_index >= 0),
  explanation_id text,
  explanation_en text,
  level public.jlpt_level not null,
  skill public.content_skill not null,
  kanji_id uuid references public.kanji(id) on delete set null,
  vocabulary_id uuid references public.vocabulary(id) on delete set null,
  grammar_id uuid references public.grammar_points(id) on delete set null,
  passage_id uuid references public.reading_passages(id) on delete set null,
  listening_id uuid references public.listening_items(id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create index questions_level_skill_idx on public.questions(level, skill, is_published);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  level public.jlpt_level not null,
  skill public.content_skill,
  question_count integer not null default 0,
  time_limit_seconds integer,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (quiz_id, question_id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid references public.quizzes(id) on delete set null,
  level public.jlpt_level,
  skill public.content_skill,
  total_questions integer not null check (total_questions >= 0),
  correct_count integer not null check (correct_count >= 0 and correct_count <= total_questions),
  score numeric(5,2) not null default 0,
  xp_earned integer not null default 0,
  duration_seconds integer not null default 0,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index quiz_attempts_user_idx on public.quiz_attempts(user_id, created_at desc);

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_index integer not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);
create index quiz_answers_user_idx on public.quiz_answers(user_id, created_at desc);

create table public.user_item_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type public.content_skill not null,
  item_id uuid not null,
  level public.jlpt_level not null,
  status public.progress_status not null default 'new',
  repetitions integer not null default 0,
  ease_factor numeric(4,2) not null default 2.50,
  interval_days integer not null default 0,
  last_reviewed_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, item_type, item_id)
);
create index user_item_progress_due_idx on public.user_item_progress(user_id, due_at);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  code text not null,
  status text not null default 'pending',
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  unique(referrer_id, referred_user_id)
);

create table public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_kind text not null,
  premium_days integer not null default 0,
  points_spent integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare code text;
begin
  code := 'ENO-' || upper(substr(replace(new.id::text,'-',''),1,8));
  insert into public.profiles(id, display_name, referral_code) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name'), code) on conflict (id) do nothing;
  insert into public.user_stats(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.award_quiz_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare today date := current_date; last_day date; new_streak integer;
begin
  insert into public.user_stats(user_id) values (new.user_id) on conflict (user_id) do nothing;
  select last_activity_date, current_streak into last_day, new_streak from public.user_stats where user_id = new.user_id for update;
  if last_day = today then
    new_streak := coalesce(new_streak,0);
  elsif last_day = today - 1 then
    new_streak := coalesce(new_streak,0) + 1;
  else
    new_streak := 1;
  end if;
  update public.user_stats set total_xp = total_xp + greatest(new.xp_earned,0), current_streak = new_streak, longest_streak = greatest(longest_streak,new_streak), last_activity_date = today, updated_at = now() where user_id = new.user_id;
  return new;
end; $$;
create trigger quiz_attempt_activity after insert on public.quiz_attempts for each row execute function public.award_quiz_activity();

create or replace function public.award_item_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare today date := current_date; last_day date; new_streak integer;
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.repetitions < new.repetitions) then
    insert into public.user_stats(user_id) values (new.user_id) on conflict (user_id) do nothing;
    select last_activity_date, current_streak into last_day, new_streak from public.user_stats where user_id = new.user_id for update;
    if last_day = today then new_streak := coalesce(new_streak,0); elsif last_day = today - 1 then new_streak := coalesce(new_streak,0)+1; else new_streak := 1; end if;
    update public.user_stats set total_xp = total_xp + 5, current_streak = new_streak, longest_streak = greatest(longest_streak,new_streak), last_activity_date = today, updated_at = now() where user_id = new.user_id;
  end if;
  return new;
end; $$;
create trigger item_progress_activity after insert or update on public.user_item_progress for each row execute function public.award_item_activity();

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger stats_updated_at before update on public.user_stats for each row execute function public.set_updated_at();
create trigger item_progress_updated_at before update on public.user_item_progress for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_stats enable row level security;
alter table public.kanji enable row level security;
alter table public.kanji_relations enable row level security;
alter table public.vocabulary enable row level security;
alter table public.grammar_points enable row level security;
alter table public.reading_passages enable row level security;
alter table public.listening_items enable row level security;
alter table public.questions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.user_item_progress enable row level security;
alter table public.referrals enable row level security;
alter table public.reward_grants enable row level security;

create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy stats_select_own on public.user_stats for select using (auth.uid() = user_id);

create policy kanji_public_read on public.kanji for select using (is_published or auth.role() = 'service_role');
create policy kanji_relations_public_read on public.kanji_relations for select using (exists(select 1 from public.kanji k where k.id=kanji_id and k.is_published));
create policy vocabulary_public_read on public.vocabulary for select using (is_published or auth.role() = 'service_role');
create policy grammar_public_read on public.grammar_points for select using (is_published or auth.role() = 'service_role');
create policy reading_public_read on public.reading_passages for select using (is_published or auth.role() = 'service_role');
create policy listening_public_read on public.listening_items for select using (is_published or auth.role() = 'service_role');
create policy questions_public_read on public.questions for select using (is_published or auth.role() = 'service_role');
create policy quizzes_public_read on public.quizzes for select using (is_published or auth.role() = 'service_role');
create policy quiz_questions_public_read on public.quiz_questions for select using (exists(select 1 from public.quizzes q where q.id=quiz_id and q.is_published));
create policy attempts_own_select on public.quiz_attempts for select using (auth.uid() = user_id);
create policy attempts_own_insert on public.quiz_attempts for insert with check (auth.uid() = user_id);
create policy answers_own_select on public.quiz_answers for select using (auth.uid() = user_id);
create policy answers_own_insert on public.quiz_answers for insert with check (auth.uid() = user_id);
create policy progress_own_all on public.user_item_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy referrals_own_select on public.referrals for select using (auth.uid() = referrer_id or auth.uid() = referred_user_id);
create policy reward_grants_own_select on public.reward_grants for select using (auth.uid() = user_id);
