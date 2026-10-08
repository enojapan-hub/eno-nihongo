-- Only newly created profiles receive the ENO prefix. Existing referral links remain valid.
create or replace function public.prefix_new_referral_code()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.referral_code is not null and new.referral_code <> '' and left(upper(new.referral_code), 3) <> 'ENO' then
    new.referral_code := 'ENO' || upper(new.referral_code);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prefix_new_referral_code on public.profiles;
create trigger trg_prefix_new_referral_code
before insert on public.profiles
for each row execute function public.prefix_new_referral_code();
