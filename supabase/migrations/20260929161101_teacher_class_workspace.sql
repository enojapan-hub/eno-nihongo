-- Extend the existing classroom tables; keep all access under the existing RLS.
alter table public.class_meetings add column if not exists meeting_id text, add column if not exists passcode text;
alter table public.class_schedule add column if not exists meeting_url text, add column if not exists meeting_id text, add column if not exists passcode text;
alter table public.class_assignments add column if not exists category text not null default 'Umum', add column if not exists topic text, add column if not exists allow_late boolean not null default false, add column if not exists submission_type text not null default 'text';
alter table public.class_quiz_questions add column if not exists category text not null default 'Umum', add column if not exists topic text;
alter table public.class_grades add column if not exists weakness_note text;

alter table public.class_announcements add column if not exists is_published boolean not null default true;
drop policy if exists class_announcement_read on public.class_announcements;
create policy class_announcement_read on public.class_announcements for select to authenticated using(is_published and public.is_class_member(class_id));

-- Table privileges and RLS are both required. These tables already have owner/member policies.
grant select, insert, update, delete on public.class_materials, public.class_assignments, public.class_schedule, public.class_announcements, public.class_meetings to authenticated;
grant select, insert, update on public.class_assignment_submissions to authenticated;
grant select on public.class_grades, public.class_quiz_attempts, public.class_enrollments to authenticated;

create or replace function public.teacher_manage_class(p_class_id uuid, p_action text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.classes; begin
  select * into c from public.classes where id=p_class_id for update;
  if auth.uid() is null or c.id is null or not public.can_manage_class(p_class_id) then raise exception 'Akses kelas ditolak'; end if;
  if p_action='save' then
    if nullif(btrim(p_data->>'title'),'') is null then raise exception 'Nama kelas wajib diisi'; end if;
    if (p_data->>'capacity')::int < 1 or (p_data->>'price')::numeric < 0 then raise exception 'Kapasitas atau harga tidak valid'; end if;
    if (p_data->>'capacity')::int < (select count(*) from public.class_enrollments where class_id=p_class_id and status='active') then raise exception 'Kapasitas tidak boleh kurang dari jumlah peserta'; end if;
    if nullif(p_data->>'meeting_url','') is not null and p_data->>'meeting_url' !~ '^https://' then raise exception 'Link sesi harus menggunakan HTTPS'; end if;
    if (p_data->>'reveal_until')::timestamptz < (p_data->>'reveal_from')::timestamptz then raise exception 'Waktu tutup akses harus setelah waktu buka'; end if;
    insert into public.class_meetings(class_id,meeting_url,meeting_id,passcode,reveal_from,reveal_until) values(p_class_id,coalesce(p_data->>'meeting_url',''),nullif(p_data->>'meeting_id',''),nullif(p_data->>'passcode',''),(p_data->>'reveal_from')::timestamptz,(p_data->>'reveal_until')::timestamptz) on conflict(class_id) do update set meeting_url=excluded.meeting_url,meeting_id=excluded.meeting_id,passcode=excluded.passcode,reveal_from=excluded.reveal_from,reveal_until=excluded.reveal_until,updated_at=now();
    update public.classes set title=btrim(p_data->>'title'), description=p_data->>'description', level=p_data->>'level', capacity=nullif(p_data->>'capacity','')::int, price=(p_data->>'price')::numeric, updated_at=now() where id=p_class_id;
  elsif p_action='archive' then
    update public.classes set status='closed',updated_at=now() where id=p_class_id;
  elsif p_action='review' and c.status in ('draft','rejected') then
    update public.classes set status='review',updated_at=now() where id=p_class_id;
  elsif p_action='delete' then
    if c.status <> 'draft' or exists(select 1 from public.class_enrollments where class_id=p_class_id) or exists(select 1 from public.class_assignment_submissions s join public.class_assignments a on a.id=s.assignment_id where a.class_id=p_class_id) or exists(select 1 from public.class_quiz_attempts a join public.class_quizzes q on q.id=a.quiz_id where q.class_id=p_class_id) then raise exception 'Hanya draft tanpa peserta dan hasil belajar yang dapat dihapus. Arsipkan kelas ini.'; end if;
    delete from public.classes where id=p_class_id;
  else raise exception 'Tindakan tidak tersedia untuk status kelas ini'; end if;
end $$;
revoke all on function public.teacher_manage_class(uuid,text,jsonb) from public,anon;
grant execute on function public.teacher_manage_class(uuid,text,jsonb) to authenticated;

-- Create a class and every session atomically, preventing half-created classes on failure.
create or replace function public.teacher_create_class_with_sessions(p_data jsonb, p_sessions jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid; begin
  if auth.uid() is null or public.current_app_role() not in ('teacher','admin','owner') then raise exception 'Akses guru diperlukan'; end if;
  if jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) not between 1 and 60 then raise exception 'Jumlah pertemuan harus 1–60'; end if;
  if nullif(btrim(p_data->>'title'),'') is null or (p_data->>'price')::numeric < 0 or coalesce((p_data->>'capacity')::int,0)<1 then raise exception 'Nama, harga, atau kapasitas tidak valid'; end if;
  if coalesce(p_data->>'status','') not in ('draft','review') then raise exception 'Status kelas tidak valid'; end if;
  if exists(select 1 from jsonb_array_elements(p_sessions) s where (s->>'starts_at') is null or (s->>'ends_at') is null or (s->>'ends_at')::timestamptz <= (s->>'starts_at')::timestamptz) then raise exception 'Jam selesai harus setelah jam mulai'; end if;
  cid:=public.teacher_create_class(p_title=>p_data->>'title',p_level=>p_data->>'level',p_description=>p_data->>'description',p_banner_url=>p_data->>'banner_url',p_meeting_url=>p_data->>'meeting_url',p_starts_at=>(select min((s->>'starts_at')::timestamptz) from jsonb_array_elements(p_sessions) s),p_ends_at=>(select max((s->>'ends_at')::timestamptz) from jsonb_array_elements(p_sessions) s),p_capacity=>(p_data->>'capacity')::int,p_price=>(p_data->>'price')::numeric,p_currency=>'IDR',p_status=>p_data->>'status');
  insert into public.class_schedule(class_id,title,starts_at,ends_at) select cid,s->>'title',(s->>'starts_at')::timestamptz,(s->>'ends_at')::timestamptz from jsonb_array_elements(p_sessions) s;
  return cid;
end $$;
revoke all on function public.teacher_create_class_with_sessions(jsonb,jsonb) from public,anon;
grant execute on function public.teacher_create_class_with_sessions(jsonb,jsonb) to authenticated;

create schema if not exists private;
-- Notifications carry no room passwords; the destination enforces membership.
create or replace function private.notify_class_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cid uuid:=new.class_id; heading text; message text; begin
  if tg_table_name in ('class_materials','class_assignments','class_quizzes') then
    if not new.is_published then return new; end if;
    if tg_op='UPDATE' then
      if old.is_published then
        if tg_table_name='class_materials' then return new; end if;
        if old.due_at is not distinct from new.due_at then return new; end if;
      end if;
    end if;
    heading:=case tg_table_name when 'class_materials' then 'Materi baru' when 'class_assignments' then 'Tugas baru' else 'Kuis baru' end;
    message:=new.title;
    if tg_op='UPDATE' then if old.is_published then heading:='Batas pengerjaan diperbarui'; end if; end if;
  elsif tg_table_name='class_announcements' then
    if not new.is_published then return new; end if;
    if tg_op='UPDATE' and old.is_published and old.title is not distinct from new.title and old.body is not distinct from new.body then return new; end if;
    heading:=case when tg_op='INSERT' then 'Pengumuman kelas' else 'Pengumuman diperbarui' end;
    message:=new.title || ': ' || left(new.body,300);
  elsif tg_table_name='class_meetings' then
    if tg_op='UPDATE' and (old.meeting_url,old.meeting_id,old.passcode,old.reveal_from,old.reveal_until) is not distinct from (new.meeting_url,new.meeting_id,new.passcode,new.reveal_from,new.reveal_until) then return new; end if;
    heading:='Informasi kelas live diperbarui';message:='Buka ruang kelas untuk melihat akses sesi terbaru.';
  else
    if tg_op='UPDATE' and (old.title,old.starts_at,old.ends_at,old.meeting_url,old.meeting_id,old.passcode) is not distinct from (new.title,new.starts_at,new.ends_at,new.meeting_url,new.meeting_id,new.passcode) then return new; end if;
    heading:='Jadwal kelas diperbarui';message:=new.title || '. Periksa tanggal dan jam terbaru di ruang kelas.';
  end if;
  insert into public.user_notifications(user_id,kind,title,body,action_url)
  select e.user_id,'info',heading,message,'/kelas/'||cid||'/workspace' from public.class_enrollments e where e.class_id=cid and e.status='active';
  return new;
end $$;
revoke all on function private.notify_class_change() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['class_materials','class_assignments','class_quizzes','class_announcements','class_schedule','class_meetings'] loop
    execute format('create trigger classroom_notify after insert or update on public.%I for each row execute function private.notify_class_change()',t);
  end loop;
end $$;

-- Preserve graded work and reject enrollment, assignment and timestamp manipulation.
create or replace function private.validate_class_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.class_assignments; begin
  select * into a from public.class_assignments where id=new.assignment_id for share;
  if auth.uid() is null or new.user_id<>auth.uid() or not public.is_class_member(a.class_id) or not a.is_published then raise exception 'Tugas tidak dapat dikumpulkan'; end if;
  if tg_op='UPDATE' then
    if (old.assignment_id,old.user_id) is distinct from (new.assignment_id,new.user_id) then raise exception 'Pemilik tugas tidak dapat diubah'; end if;
    if exists(select 1 from public.class_grades where user_id=old.user_id and assignment_id=old.assignment_id) then raise exception 'Tugas yang sudah dinilai tidak dapat diubah'; end if;
  end if;
  if a.due_at<now() and not a.allow_late then raise exception 'Batas pengumpulan tugas sudah berakhir'; end if;
  if a.submission_type='upload' and nullif(new.attachment_url,'') is null then raise exception 'Unggah berkas tugas'; end if;
  if a.submission_type='text' and nullif(btrim(new.answer_text),'') is null then raise exception 'Jawaban tertulis wajib diisi'; end if;
  if nullif(btrim(new.answer_text),'') is null and nullif(new.attachment_url,'') is null then raise exception 'Isi jawaban atau unggah tugas'; end if;
  if new.attachment_url is not null and new.attachment_url not like a.class_id::text||'/'||new.user_id::text||'/%' then raise exception 'Lampiran tugas tidak valid'; end if;
  new.status:='submitted';new.submitted_at:=now();return new;
end $$;
revoke all on function private.validate_class_submission() from public,anon,authenticated;
create trigger classroom_validate_submission before insert or update on public.class_assignment_submissions for each row execute function private.validate_class_submission();

create or replace function public.teacher_grade_assignment(p_submission_id uuid,p_score numeric,p_feedback text,p_weakness text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.class_assignment_submissions; a public.class_assignments; begin
  select * into s from public.class_assignment_submissions where id=p_submission_id for update;
  select * into a from public.class_assignments where id=s.assignment_id;
  if auth.uid() is null or a.id is null or not public.can_manage_class(a.class_id) then raise exception 'Akses penilaian ditolak'; end if;
  if p_score is null or p_score::text in ('NaN','Infinity','-Infinity') or p_score<0 or p_score>coalesce(a.max_score,100) then raise exception 'Nilai harus antara 0 dan nilai maksimal'; end if;
  insert into public.class_grades(class_id,user_id,assignment_id,score,feedback,weakness_note) values(a.class_id,s.user_id,a.id,p_score,p_feedback,p_weakness) on conflict(user_id,assignment_id) do update set score=excluded.score,feedback=excluded.feedback,weakness_note=excluded.weakness_note,updated_at=now();
end $$;
revoke all on function public.teacher_grade_assignment(uuid,numeric,text,text) from public,anon;
grant execute on function public.teacher_grade_assignment(uuid,numeric,text,text) to authenticated;
-- Keep the old endpoint subject to the same bounds checks.
create or replace function public.grade_class_submission(p_submission_id uuid,p_score numeric,p_feedback text default null)
returns void language sql security invoker set search_path = '' as $$ select public.teacher_grade_assignment(p_submission_id,p_score,p_feedback,null); $$;

create or replace function private.protect_class_work()
returns trigger language plpgsql security definer set search_path = '' as $$
declare qid uuid; begin
  if tg_table_name='class_quiz_questions' then
    qid:=case when tg_op='DELETE' then old.quiz_id else new.quiz_id end;
    if tg_op='UPDATE' and old.quiz_id<>new.quiz_id then raise exception 'Soal tidak dapat dipindahkan'; end if;
    perform 1 from public.class_quizzes where id=qid for update;
    if tg_op<>'DELETE' then
      if jsonb_typeof(new.choices)<>'array' or jsonb_array_length(new.choices)<2 or new.correct_index<0 or new.correct_index>=jsonb_array_length(new.choices) then raise exception 'Pilihan atau kunci jawaban tidak valid'; end if;
    end if;
    if exists(select 1 from public.class_quiz_attempts where quiz_id=qid) then raise exception 'Kuis sudah dikerjakan. Buat kuis baru agar hasil peserta tetap akurat.'; end if;
  elsif tg_table_name='class_quizzes' and tg_op='DELETE' then
    if exists(select 1 from public.class_quiz_attempts where quiz_id=old.id) then raise exception 'Kuis sudah memiliki hasil; jangan dihapus'; end if;
  elsif tg_table_name='class_assignments' then
    if tg_op='UPDATE' then
      if old.class_id<>new.class_id then raise exception 'Tugas tidak dapat dipindahkan'; end if;
      if old.is_published and not new.is_published and exists(select 1 from public.class_assignment_submissions where assignment_id=old.id) then raise exception 'Tugas sudah memiliki jawaban; tetap simpan akses peserta'; end if;
    end if;
    if tg_op='DELETE' then
      if exists(select 1 from public.class_assignment_submissions where assignment_id=old.id) then raise exception 'Tugas sudah memiliki jawaban; jangan dihapus'; end if;
    elsif tg_op='UPDATE' then
      if (old.title,old.description,old.max_score,old.category,old.topic,old.submission_type) is distinct from (new.title,new.description,new.max_score,new.category,new.topic,new.submission_type) and exists(select 1 from public.class_assignment_submissions where assignment_id=old.id) then raise exception 'Tugas sudah dikerjakan. Duplikat untuk mengubah isi atau bobot nilai.'; end if;
    end if;
    if tg_op<>'DELETE' then
      if new.max_score is null or new.max_score<=0 or new.max_score::text in ('NaN','Infinity','-Infinity') then raise exception 'Nilai maksimal harus positif'; end if;
      if new.submission_type not in ('text','upload','mixed') then raise exception 'Jenis tugas tidak valid'; end if;
    end if;
  elsif tg_table_name='class_schedule' and tg_op<>'DELETE' then
    if tg_op='UPDATE' and old.class_id<>new.class_id then raise exception 'Sesi tidak dapat dipindahkan'; end if;
    if new.ends_at is null or new.ends_at<=new.starts_at then raise exception 'Jam selesai harus setelah jam mulai'; end if;
    if nullif(new.meeting_url,'') is not null and new.meeting_url !~ '^https://' then raise exception 'Link sesi harus menggunakan HTTPS'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;return new;
end $$;
revoke all on function private.protect_class_work() from public,anon,authenticated;
create trigger classroom_protect_question before insert or update or delete on public.class_quiz_questions for each row execute function private.protect_class_work();
create trigger classroom_protect_quiz before delete on public.class_quizzes for each row execute function private.protect_class_work();
create trigger classroom_protect_assignment before insert or update or delete on public.class_assignments for each row execute function private.protect_class_work();
create trigger classroom_validate_schedule before insert or update on public.class_schedule for each row execute function private.protect_class_work();

-- Topic accuracy: one latest attempt per quiz, so repeats do not inflate the summary.
create or replace function public.get_teacher_class_topic_insights(p_class_id uuid)
returns table(user_id uuid,category text,topic text,correct_count bigint,total_questions bigint,accuracy numeric)
language plpgsql stable security definer set search_path = '' as $$ begin
  if auth.uid() is null or not public.can_manage_class(p_class_id) then raise exception 'Akses kelas ditolak'; end if;
  return query with latest as (
    select distinct on (a.user_id,a.quiz_id) a.* from public.class_quiz_attempts a join public.class_quizzes q on q.id=a.quiz_id where q.class_id=p_class_id order by a.user_id,a.quiz_id,a.submitted_at desc,a.id desc
  ), results as (
    select a.user_id,q.category,coalesce(nullif(q.topic,''),'Belum diberi topik') topic,(a.answers->>q.id::text)=q.correct_index::text correct from latest a join public.class_quiz_questions q on q.quiz_id=a.quiz_id
  ) select r.user_id,r.category,r.topic,count(*) filter(where r.correct),count(*),round(100.0*count(*) filter(where r.correct)/count(*),1) from results r group by r.user_id,r.category,r.topic order by r.user_id,6;
end $$;
revoke all on function public.get_teacher_class_topic_insights(uuid) from public,anon;
grant execute on function public.get_teacher_class_topic_insights(uuid) to authenticated;

-- Private assignment attachments. Existing attachment_url stores an object path.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('class-submissions','class-submissions',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/mp4','audio/wav','audio/webm']) on conflict(id) do nothing;
create policy classroom_attachment_insert on storage.objects for insert to authenticated with check(bucket_id='class-submissions' and (storage.foldername(name))[2]=auth.uid()::text and public.is_class_member(((storage.foldername(name))[1])::uuid));
create policy classroom_attachment_read on storage.objects for select to authenticated using(bucket_id='class-submissions' and ((storage.foldername(name))[2]=auth.uid()::text or public.can_manage_class(((storage.foldername(name))[1])::uuid)));

-- Serialize answer submission with question edits to preserve grade consistency.
CREATE OR REPLACE FUNCTION public.submit_class_quiz(p_quiz_id uuid, p_answers jsonb)
 RETURNS TABLE(attempt_id uuid, score numeric, correct_count integer, total_questions integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v_class uuid;v_due timestamptz;v_correct int:=0;v_total int:=0;v_id uuid;v_score numeric:=0;v_bad int:=0; begin if auth.uid() is null then raise exception 'Login diperlukan';end if;if jsonb_typeof(p_answers)<>'object' then raise exception 'Format jawaban tidak valid';end if;perform 1 from public.class_quizzes where id=p_quiz_id for update;select class_id,due_at into v_class,v_due from public.class_quizzes where id=p_quiz_id and is_published;if v_class is null or not public.is_class_member(v_class) then raise exception 'Akses quiz ditolak';end if;if v_due is not null and now()>v_due then raise exception 'Batas waktu quiz sudah berakhir';end if;select count(*) into v_bad from jsonb_each_text(p_answers) e where e.value !~ '^[0-9]+$';if v_bad>0 then raise exception 'Format jawaban tidak valid';end if;select count(*),count(*) filter(where case when (p_answers->>id::text) ~ '^[0-9]+$' then (p_answers->>id::text)::int else -1 end=correct_index) into v_total,v_correct from public.class_quiz_questions where quiz_id=p_quiz_id;if v_total=0 then raise exception 'Quiz belum memiliki soal';end if;v_score:=round((v_correct::numeric/v_total::numeric)*100,2);insert into public.class_quiz_attempts(quiz_id,user_id,answers,score,correct_count,total_questions) values(p_quiz_id,auth.uid(),p_answers,v_score,v_correct,v_total) returning id into v_id;return query select v_id,v_score,v_correct,v_total;end $function$
;

create or replace function private.validate_quiz_publication()
returns trigger language plpgsql security definer set search_path = '' as $$ begin
  if tg_op='UPDATE' and old.class_id<>new.class_id then raise exception 'Kuis tidak dapat dipindahkan ke kelas lain'; end if;
  if tg_op='UPDATE' then if old.is_published and not new.is_published and exists(select 1 from public.class_quiz_attempts where quiz_id=old.id) then raise exception 'Kuis sudah memiliki hasil; tetap simpan akses peserta'; end if; end if;
  if new.is_published and not exists(select 1 from public.class_quiz_questions where quiz_id=new.id) then raise exception 'Tambahkan soal sebelum menerbitkan kuis'; end if;
  return new;
end $$;
revoke all on function private.validate_quiz_publication() from public,anon,authenticated;
create trigger classroom_validate_quiz before insert or update on public.class_quizzes for each row execute function private.validate_quiz_publication();

create or replace function private.sync_class_session_range()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cid uuid; begin
  cid:=case when tg_op='DELETE' then old.class_id else new.class_id end;
  update public.classes set starts_at=(select min(starts_at) from public.class_schedule where class_id=cid),ends_at=(select max(ends_at) from public.class_schedule where class_id=cid),updated_at=now() where id=cid;
  if tg_op='DELETE' then
    insert into public.user_notifications(user_id,kind,title,body,action_url) select e.user_id,'info','Sesi kelas dibatalkan',old.title,'/kelas/'||cid||'/workspace' from public.class_enrollments e where e.class_id=cid and e.status='active';
    return old;
  end if;return new;
end $$;
revoke all on function private.sync_class_session_range() from public,anon,authenticated;
create trigger classroom_sync_session after insert or update or delete on public.class_schedule for each row execute function private.sync_class_session_range();

create or replace function private.notify_class_grade()
returns trigger language plpgsql security definer set search_path = '' as $$ begin
  if tg_op='UPDATE' and (old.score,old.feedback,old.weakness_note) is not distinct from (new.score,new.feedback,new.weakness_note) then return new; end if;
  insert into public.user_notifications(user_id,kind,title,body,action_url) values(new.user_id,'info','Tugas sudah dinilai','Buka tugas untuk melihat nilai dan koreksi guru.','/kelas/'||new.class_id||'/tugas/'||new.assignment_id);
  return new;
end $$;
revoke all on function private.notify_class_grade() from public,anon,authenticated;
create trigger classroom_notify_grade after insert or update on public.class_grades for each row execute function private.notify_class_grade();

create or replace function public.get_my_class_topic_insights(p_class_id uuid)
returns table(user_id uuid,category text,topic text,correct_count bigint,total_questions bigint,accuracy numeric)
language plpgsql stable security definer set search_path = '' as $$ begin
  if auth.uid() is null or not public.is_class_member(p_class_id) then raise exception 'Akses kelas ditolak'; end if;
  return query with latest as (
    select distinct on (a.user_id,a.quiz_id) a.* from public.class_quiz_attempts a join public.class_quizzes q on q.id=a.quiz_id where q.class_id=p_class_id and a.user_id=auth.uid() order by a.user_id,a.quiz_id,a.submitted_at desc,a.id desc
  ), results as (
    select a.user_id,q.category,coalesce(nullif(q.topic,''),'Belum diberi topik') topic,(a.answers->>q.id::text)=q.correct_index::text correct from latest a join public.class_quiz_questions q on q.quiz_id=a.quiz_id
  ) select r.user_id,r.category,r.topic,count(*) filter(where r.correct),count(*),round(100.0*count(*) filter(where r.correct)/count(*),1) from results r group by r.user_id,r.category,r.topic order by r.user_id,6;
end $$;
revoke all on function public.get_my_class_topic_insights(uuid) from public,anon;
grant execute on function public.get_my_class_topic_insights(uuid) to authenticated;

