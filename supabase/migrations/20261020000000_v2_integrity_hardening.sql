-- ENO NIHONGO v2 — integrity hardening (LOCAL, belum diterapkan ke Production).
-- Dasar: audit read-only database "Eno japan hub" pada 2026-10-10.
-- Non-destruktif dan idempotent. Tidak menyentuh konten Chokai/Simulasi atau pembayaran.

-- 1) search_path record_learning_activity tersimpan sebagai SATU identifier
--    "pg_catalog,public,auth". Isi fungsi sudah memakai nama ber-skema sehingga tidak
--    dapat dieksploitasi, tetapi konfigurasinya salah dan rapuh. Perbaiki ke daftar skema.
alter function public.record_learning_activity(text, integer, integer, jsonb)
  set search_path = pg_catalog, public, auth;

-- 2) Race condition XP: cek "lesson_completed sudah pernah" berjalan SEBELUM baris
--    user_stats dikunci, sehingga panggilan paralel untuk materi yang sama dapat
--    sama-sama memberi +5 XP. Serialkan per (user, activity, konten) dengan advisory lock.
create or replace function public.record_learning_activity(
  p_activity_type text, p_content_type text, p_content_id uuid,
  p_points integer default 0, p_xp integer default 0, p_correct boolean default null,
  p_duration_seconds integer default 0, p_metadata jsonb default '{}'::jsonb)
returns public.user_learning_stats
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
 v_user_id uuid:=auth.uid(); v_today date:=(now() at time zone 'Asia/Tokyo')::date; v_prev_date date; v_current_streak int:=0; v_longest_streak int:=0;
 v_effective_points int:=0; v_effective_xp int:=0; v_count_lesson int:=0; v_result public.user_learning_stats; v_valid_content boolean:=false;
begin
 if v_user_id is null then raise exception 'User belum login'; end if;
 if p_activity_type not in ('lesson_completed','quiz_completed','quiz_answered','daily_target_completed','simulation_section_completed','simulation_full_completed') then raise exception 'invalid_activity_type'; end if;
 if coalesce(p_duration_seconds,0)<0 or p_duration_seconds>86400 then raise exception 'invalid_duration'; end if;

 -- Direct client calls cannot self-award arbitrary rewards. Only verified lesson mastery gets fixed XP.
 if p_activity_type='lesson_completed' then
   if p_content_id is null or p_content_type not in ('kanji','vocabulary','grammar','reading','listening') then raise exception 'invalid_content'; end if;
   case p_content_type
     when 'kanji' then select exists(select 1 from public.kanji where id=p_content_id and is_published=true) into v_valid_content;
     when 'vocabulary' then select exists(select 1 from public.vocabulary where id=p_content_id and is_published=true) into v_valid_content;
     when 'grammar' then select exists(select 1 from public.grammar_points where id=p_content_id and is_published=true) into v_valid_content;
     when 'reading' then select exists(select 1 from public.reading_passages where id=p_content_id and is_published=true) into v_valid_content;
     when 'listening' then select exists(select 1 from public.listening_items where id=p_content_id and is_published=true) into v_valid_content;
   end case;
   if not v_valid_content then raise exception 'invalid_content'; end if;
   -- NEW: serialize concurrent completions of the same item by the same user.
   perform pg_advisory_xact_lock(hashtextextended(v_user_id::text||':lesson_completed:'||p_content_type||':'||p_content_id::text,0));
   if not exists(select 1 from public.learning_activity la where la.user_id=v_user_id and la.activity_type='lesson_completed' and la.metadata->>'content_id'=p_content_id::text and la.metadata->>'content_type'=p_content_type) then
     v_effective_xp:=5; v_count_lesson:=1;
   end if;
 end if;

 insert into public.user_stats(user_id) values(v_user_id) on conflict(user_id) do nothing;
 select last_activity_date,current_streak,longest_streak into v_prev_date,v_current_streak,v_longest_streak from public.user_stats where user_id=v_user_id for update;
 if v_prev_date is null then v_current_streak:=1; elsif v_prev_date=v_today then v_current_streak:=greatest(v_current_streak,1); elsif v_prev_date=v_today-1 then v_current_streak:=greatest(v_current_streak,0)+1; else v_current_streak:=1; end if;
 v_longest_streak:=greatest(coalesce(v_longest_streak,0),v_current_streak);
 update public.user_stats set total_xp=total_xp+v_effective_xp,reward_points=reward_points+v_effective_points,current_streak=v_current_streak,longest_streak=v_longest_streak,last_activity_date=v_today,updated_at=now() where user_id=v_user_id;
 insert into public.user_learning_stats(user_id,display_name,avatar_url,jlpt_level,ui_language) select p.id,p.display_name,p.avatar_url,coalesce(p.target_level::text,'N5'),coalesce(p.ui_language,'id') from public.profiles p where p.id=v_user_id on conflict(user_id) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url,jlpt_level=excluded.jlpt_level,ui_language=excluded.ui_language;
 insert into public.learning_activity(user_id,activity_type,points,xp,metadata) values(v_user_id,p_activity_type,v_effective_points,v_effective_xp,coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('content_type',p_content_type,'content_id',p_content_id,'correct',p_correct,'duration_seconds',greatest(coalesce(p_duration_seconds,0),0)));
 update public.user_learning_stats u set xp=s.total_xp,total_points=s.reward_points,study_minutes=u.study_minutes+case when p_duration_seconds>=60 then p_duration_seconds/60 else 0 end,lessons_completed=u.lessons_completed+v_count_lesson,current_streak=s.current_streak,longest_streak=s.longest_streak,last_activity_at=now(),updated_at=now() from public.user_stats s where u.user_id=v_user_id and s.user_id=v_user_id returning u.* into v_result;
 return v_result;
end
$function$;

-- 3) Hak tabel berlebih pada user_item_progress. RLS hanya mengizinkan role
--    authenticated pada baris miliknya, tetapi anon dan authenticated memegang
--    TRUNCATE/TRIGGER/REFERENCES (TRUNCATE tidak tunduk pada RLS). Cabut yang tidak perlu.
revoke all on table public.user_item_progress from anon;
revoke truncate, trigger, references on table public.user_item_progress from authenticated;

-- 4) Pencatatan drift: enroll_in_class ada di database tetapi tidak ada di migration.
--    Definisi di bawah identik dengan Production (tidak mengubah perilaku).
create or replace function public.enroll_in_class(p_class_id uuid)
returns text language plpgsql security definer set search_path to 'public'
as $function$
declare v_capacity integer; v_price numeric; v_count integer; v_status text;
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 select capacity,price,status into v_capacity,v_price,v_status from public.classes where id=p_class_id for update;
 if not found or v_status<>'published' then raise exception 'Kelas tidak tersedia'; end if;
 if coalesce(v_price,0)>0 then raise exception 'Pendaftaran kelas berbayar belum tersedia'; end if;
 select count(*) into v_count from public.class_enrollments where class_id=p_class_id and status='active';
 if v_capacity is not null and v_count>=v_capacity then raise exception 'Kelas sudah penuh'; end if;
 insert into public.class_enrollments(class_id,user_id,status) values(p_class_id,auth.uid(),'active') on conflict (class_id,user_id) do update set status='active';
 return 'active';
end $function$;
