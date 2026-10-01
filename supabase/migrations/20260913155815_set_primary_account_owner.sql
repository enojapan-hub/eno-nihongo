update public.profiles p
set role = 'owner', updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('tonosajjah@gmail.com');
