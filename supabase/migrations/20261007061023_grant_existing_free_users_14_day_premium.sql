update public.profiles
set plan = 'premium',
    premium_until = now() + interval '14 days',
    updated_at = now()
where plan = 'free';
