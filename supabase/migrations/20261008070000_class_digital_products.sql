-- Produk Digital Kelas: schema + secure access layer.
-- PR140 only. Do not apply to production until payment activation is approved.

create table if not exists public.class_digital_products (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text,
  price_idr bigint not null check (price_idr >= 0),
  cover_path text,
  file_path text not null,
  file_name text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  mime_type text,
  status text not null default 'draft' check (status in ('draft','review','published','rejected','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_digital_products_class_idx
  on public.class_digital_products(class_id, status, created_at desc);
create index if not exists class_digital_products_teacher_idx
  on public.class_digital_products(teacher_id, created_at desc);

create table if not exists public.class_digital_product_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.class_digital_products(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  amount_idr bigint not null check (amount_idr >= 0),
  teacher_share_idr bigint not null check (teacher_share_idr >= 0),
  platform_fee_idr bigint not null check (platform_fee_idr >= 0),
  status text not null default 'pending' check (status in ('pending','paid','refunded','cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(product_id, buyer_id)
);

create index if not exists class_digital_product_purchases_buyer_idx
  on public.class_digital_product_purchases(buyer_id, status, created_at desc);
create index if not exists class_digital_product_purchases_order_idx
  on public.class_digital_product_purchases(payment_order_id);

alter table public.class_digital_products enable row level security;
alter table public.class_digital_product_purchases enable row level security;

revoke all on public.class_digital_products from anon;
revoke all on public.class_digital_product_purchases from anon;
grant select, insert, update, delete on public.class_digital_products to authenticated;
grant select on public.class_digital_product_purchases to authenticated;

drop policy if exists class_digital_products_read on public.class_digital_products;
create policy class_digital_products_read on public.class_digital_products
for select to authenticated using (
  status = 'published'
  or teacher_id = (select auth.uid())
  or public.current_app_role() = any(array['admin','owner'])
);

drop policy if exists class_digital_products_teacher_insert on public.class_digital_products;
create policy class_digital_products_teacher_insert on public.class_digital_products
for insert to authenticated with check (
  teacher_id = (select auth.uid())
  and public.current_app_role() = 'teacher'
  and status in ('draft','review')
  and exists (
    select 1 from public.classes c
    where c.id = class_id and c.teacher_id = (select auth.uid())
  )
);

drop policy if exists class_digital_products_manage on public.class_digital_products;
create policy class_digital_products_manage on public.class_digital_products
for update to authenticated using (
  teacher_id = (select auth.uid())
  or public.current_app_role() = any(array['admin','owner'])
) with check (
  public.current_app_role() = any(array['admin','owner'])
  or (
    teacher_id = (select auth.uid())
    and status in ('draft','review','archived')
    and exists (
      select 1 from public.classes c
      where c.id = class_id and c.teacher_id = (select auth.uid())
    )
  )
);

drop policy if exists class_digital_products_delete on public.class_digital_products;
create policy class_digital_products_delete on public.class_digital_products
for delete to authenticated using (
  (teacher_id = (select auth.uid()) and status = 'draft')
  or public.current_app_role() = any(array['admin','owner'])
);

drop policy if exists class_digital_product_purchases_read on public.class_digital_product_purchases;
create policy class_digital_product_purchases_read on public.class_digital_product_purchases
for select to authenticated using (
  buyer_id = (select auth.uid())
  or exists (
    select 1 from public.class_digital_products p
    where p.id = product_id and p.teacher_id = (select auth.uid())
  )
  or public.current_app_role() = any(array['admin','owner'])
);

create or replace function public.can_access_class_digital_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.class_digital_products p
    where p.id = p_product_id
      and (
        p.teacher_id = auth.uid()
        or public.current_app_role() = any(array['admin','owner'])
        or exists (
          select 1 from public.class_digital_product_purchases x
          where x.product_id = p.id
            and x.buyer_id = auth.uid()
            and x.status = 'paid'
        )
      )
  );
$$;
revoke all on function public.can_access_class_digital_product(uuid) from public, anon;
grant execute on function public.can_access_class_digital_product(uuid) to authenticated, service_role;

create or replace function public.create_class_digital_product_order(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.class_digital_products%rowtype;
  v_order_id uuid;
  v_merchant text;
begin
  if v_uid is null then raise exception 'authentication required'; end if;

  select * into v_product
  from public.class_digital_products
  where id = p_product_id and status = 'published';

  if not found then raise exception 'product unavailable'; end if;
  if v_product.teacher_id = v_uid then raise exception 'teacher cannot buy own product'; end if;

  if exists (
    select 1 from public.class_digital_product_purchases
    where product_id = p_product_id and buyer_id = v_uid and status = 'paid'
  ) then
    return jsonb_build_object('status','already_owned');
  end if;

  -- Checkout provider remains intentionally disabled until Duitku activation is approved.
  -- This RPC only prepares an internal pending order and never marks access as paid.
  v_merchant := 'CDP-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.payment_orders(
    user_id, provider, merchant_order_id, product_type, product_id,
    amount_idr, currency, status
  ) values (
    v_uid, 'duitku', v_merchant, 'class_digital_product', p_product_id,
    v_product.price_idr, 'IDR', 'pending'
  ) returning id into v_order_id;

  insert into public.class_digital_product_purchases(
    product_id, buyer_id, payment_order_id, amount_idr,
    teacher_share_idr, platform_fee_idr, status
  ) values (
    p_product_id, v_uid, v_order_id, v_product.price_idr,
    floor(v_product.price_idr * 0.80), v_product.price_idr - floor(v_product.price_idr * 0.80),
    'pending'
  )
  on conflict (product_id,buyer_id) do update
  set payment_order_id = excluded.payment_order_id,
      amount_idr = excluded.amount_idr,
      teacher_share_idr = excluded.teacher_share_idr,
      platform_fee_idr = excluded.platform_fee_idr,
      status = case when class_digital_product_purchases.status = 'paid' then 'paid' else 'pending' end;

  return jsonb_build_object(
    'status','payment_not_active',
    'merchant_order_id',v_merchant,
    'amount_idr',v_product.price_idr
  );
end;
$$;
revoke all on function public.create_class_digital_product_order(uuid) from public, anon;
grant execute on function public.create_class_digital_product_order(uuid) to authenticated;

-- Called only by trusted payment processing after a verified provider event.
create or replace function public.activate_class_digital_product_purchase(p_payment_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  update public.class_digital_product_purchases
  set status = 'paid', paid_at = coalesce(paid_at, now())
  where payment_order_id = p_payment_order_id and status <> 'paid';
end;
$$;
revoke all on function public.activate_class_digital_product_purchase(uuid) from public, anon, authenticated;
grant execute on function public.activate_class_digital_product_purchase(uuid) to service_role;

create or replace function public.get_class_digital_product_finance()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.current_app_role() = any(array['admin','owner']) then
      jsonb_build_object(
        'gross_revenue', coalesce(sum(amount_idr) filter (where status='paid'),0),
        'teacher_commission', coalesce(sum(teacher_share_idr) filter (where status='paid'),0),
        'platform_revenue', coalesce(sum(platform_fee_idr) filter (where status='paid'),0),
        'paid_orders', count(*) filter (where status='paid')
      )
    else null
  end
  from public.class_digital_product_purchases;
$$;
revoke all on function public.get_class_digital_product_finance() from public, anon;
grant execute on function public.get_class_digital_product_finance() to authenticated, service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'class-digital-products','class-digital-products',false,52428800,
  array['application/pdf','application/zip','image/png','image/jpeg','audio/mpeg','audio/mp4']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists class_digital_products_storage_teacher_insert on storage.objects;
create policy class_digital_products_storage_teacher_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'class-digital-products'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_app_role() = 'teacher'
);

drop policy if exists class_digital_products_storage_teacher_manage on storage.objects;
create policy class_digital_products_storage_teacher_manage on storage.objects
for update to authenticated using (
  bucket_id = 'class-digital-products'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_app_role() = any(array['admin','owner'])
  )
);

drop policy if exists class_digital_products_storage_teacher_delete on storage.objects;
create policy class_digital_products_storage_teacher_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'class-digital-products'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_app_role() = any(array['admin','owner'])
  )
);

-- Direct SELECT on storage objects is intentionally not granted to buyers.
-- Download delivery must use a short-lived signed URL created by a trusted server
-- after can_access_class_digital_product() succeeds.
