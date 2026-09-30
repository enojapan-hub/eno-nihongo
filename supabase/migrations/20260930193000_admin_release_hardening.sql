-- Admin release hardening: settings, action queue, media management, RBAC-compatible gates
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;

insert into public.platform_settings(key,value,description) values
('maintenance_mode','false'::jsonb,'Nonaktifkan akses pengguna biasa sementara'),
('registration_enabled','true'::jsonb,'Izinkan pendaftaran/login pengguna baru'),
('class_creation_enabled','true'::jsonb,'Izinkan guru membuat pengajuan kelas'),
('max_upload_mb','10'::jsonb,'Batas upload umum dalam MB')
on conflict(key) do nothing;

create or replace function public.get_platform_settings_admin()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not (public.has_permission('system.view') or public.has_permission('system.manage')) then raise exception 'forbidden'; end if;
 return coalesce((select jsonb_object_agg(key,value) from public.platform_settings),'{}'::jsonb);
end$$;
revoke all on function public.get_platform_settings_admin() from public,anon;
grant execute on function public.get_platform_settings_admin() to authenticated;

create or replace function public.admin_save_platform_settings(p_settings jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare k text; v jsonb;
begin
 if not public.has_permission('system.manage') then raise exception 'forbidden'; end if;
 if jsonb_typeof(p_settings)<>'object' then raise exception 'invalid settings'; end if;
 for k,v in select * from jsonb_each(p_settings) loop
   if k not in('maintenance_mode','registration_enabled','class_creation_enabled','max_upload_mb') then raise exception 'unknown setting: %',k; end if;
   if k='max_upload_mb' and ((v#>>'{}')::int<1 or (v#>>'{}')::int>100) then raise exception 'max_upload_mb must be 1-100'; end if;
   insert into public.platform_settings(key,value,updated_by,updated_at) values(k,v,auth.uid(),now())
   on conflict(key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 end loop;
 insert into public.admin_audit_log(actor_id,action,entity_type,metadata) values(auth.uid(),'update_platform_settings','system',p_settings);
end$$;
revoke all on function public.admin_save_platform_settings(jsonb) from public,anon;
grant execute on function public.admin_save_platform_settings(jsonb) to authenticated;

create or replace function public.get_admin_action_queue()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not (public.has_permission('system.view') or public.has_permission('operations.view') or public.has_permission('users.view')) then raise exception 'forbidden'; end if;
 return jsonb_build_array(
  jsonb_build_object('key','classes','label','Pengajuan kelas','count',(select count(*) from public.classes where status='review'),'href','/admin-kelas','severity','warning'),
  jsonb_build_object('key','reports','label','Laporan aktif','count',(select count(*) from public.content_reports where status in('open','reviewing')),'href','/admin-operasional?tab=laporan','severity','warning'),
  jsonb_build_object('key','content_fix','label','Konten perlu perbaikan','count',(select count(*) from public.content_review_status where status='needs_fix'),'href','/admin-operasional?tab=review','severity','warning'),
  jsonb_build_object('key','payments','label','Pembayaran pending >24 jam','count',(select count(*) from public.payment_orders where status='pending' and created_at<now()-interval '24 hours'),'href','/admin-keuangan','severity','critical'),
  jsonb_build_object('key','imports','label','Import gagal 7 hari','count',(select count(*) from public.admin_import_jobs where status='failed' and created_at>now()-interval '7 days'),'href','/admin-import-export','severity','critical')
 );
end$$;
revoke all on function public.get_admin_action_queue() from public,anon;
grant execute on function public.get_admin_action_queue() to authenticated;

-- Complete audit coverage for CMS save operations without changing existing write semantics.
create or replace function public.admin_audit_content_save(p_kind text,p_id uuid,p_created boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_permission('content.edit') then raise exception 'forbidden'; end if;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),case when p_created then 'create_content' else 'update_content' end,p_kind,p_id::text,jsonb_build_object('source','cms'));
end$$;
revoke all on function public.admin_audit_content_save(text,uuid,boolean) from public,anon;
grant execute on function public.admin_audit_content_save(text,uuid,boolean) to authenticated;

-- Media metadata is managed through RPC; binary upload remains in existing purpose-specific buckets.
create or replace function public.admin_register_media(p_title text,p_url text,p_media_type text,p_mime_type text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if not public.has_permission('operations.manage') then raise exception 'forbidden'; end if;
 if nullif(btrim(p_title),'') is null or nullif(btrim(p_url),'') is null then raise exception 'title and url required'; end if;
 if p_media_type not in('image','audio') then raise exception 'invalid media type'; end if;
 insert into public.media_library(title,url,media_type,mime_type,created_by) values(btrim(p_title),btrim(p_url),p_media_type,nullif(p_mime_type,''),auth.uid()) returning id into rid;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'register_media','media',rid::text,jsonb_build_object('title',p_title,'url',p_url,'type',p_media_type));
 return rid;
end$$;
revoke all on function public.admin_register_media(text,text,text,text) from public,anon;
grant execute on function public.admin_register_media(text,text,text,text) to authenticated;

create or replace function public.admin_delete_media(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare u text; refs bigint;
begin
 if not public.has_permission('operations.manage') then raise exception 'forbidden'; end if;
 select url into u from public.media_library where id=p_id;
 if u is null then raise exception 'media not found'; end if;
 select (select count(*) from public.listening_items where audio_url=u)+(select count(*) from public.jlpt_simulation_questions where audio_url=u or image_url=u) into refs;
 if refs>0 then raise exception 'Media masih digunakan oleh % konten',refs; end if;
 delete from public.media_library where id=p_id;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'delete_media','media',p_id::text,jsonb_build_object('url',u));
end$$;
revoke all on function public.admin_delete_media(uuid) from public,anon;
grant execute on function public.admin_delete_media(uuid) to authenticated;

-- Dedicated managed media bucket. Public because lesson/simulation media must be consumable by learners.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('admin-media','admin-media',true,52428800,array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp3','audio/wav','audio/webm'])
on conflict(id) do nothing;
drop policy if exists "admin_media_staff_insert" on storage.objects;
drop policy if exists "admin_media_staff_update" on storage.objects;
drop policy if exists "admin_media_staff_delete" on storage.objects;
create policy "admin_media_staff_insert" on storage.objects for insert to authenticated with check(bucket_id='admin-media' and public.has_permission('operations.manage'));
create policy "admin_media_staff_update" on storage.objects for update to authenticated using(bucket_id='admin-media' and public.has_permission('operations.manage')) with check(bucket_id='admin-media' and public.has_permission('operations.manage'));
create policy "admin_media_staff_delete" on storage.objects for delete to authenticated using(bucket_id='admin-media' and public.has_permission('operations.manage'));
