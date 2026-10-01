create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_name text; v_avatar text; v_code text;
begin
  v_name:=coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',split_part(coalesce(new.email,'member'),'@',1),'ENO NIHONGO Member');
  v_avatar:=coalesce(new.raw_user_meta_data->>'avatar_url',new.raw_user_meta_data->>'picture');
  v_code:=upper(substr(replace(new.id::text,'-',''),1,12));
  insert into public.profiles(id,display_name,avatar_url,target_level,ui_language,referral_code,role)
  values(new.id,v_name,v_avatar,'N5','id',v_code,'student') on conflict(id) do nothing;
  insert into public.user_stats(user_id) values(new.id) on conflict(user_id) do nothing;
  insert into public.user_settings(user_id) values(new.id) on conflict(user_id) do nothing;
  insert into public.user_notifications(user_id,title,body,kind,action_url)
  values(new.id,'Selamat datang di ENO NIHONGO','Notifikasi target, progres, dan hasil simulasi akan muncul di sini.','welcome','/target');
  insert into public.user_notifications(user_id,title,body,kind,action_url)
  values(new.id,'Foto profil Google aktif','Foto profil mengikuti akun Google dan dapat diganti kapan saja.','info','/profil-foto');
  return new;
end $$;
