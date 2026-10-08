-- Produk Digital ENO NIHONGO.
-- PR140 only. Do not apply to production until payment/email activation is approved.

create table if not exists public.digital_products (
  id uuid primary key default gen_random_uuid(),
  related_class_id uuid references public.classes(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  category text not null default 'ebook',
  description text,
  price_idr bigint not null check (price_idr >= 0),
  cover_path text,
  preview_paths text[] not null default '{}',
  file_path text not null,
  file_name text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  mime_type text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists digital_products_status_idx on public.digital_products(status,created_at desc);
create index if not exists digital_products_related_class_idx on public.digital_products(related_class_id) where related_class_id is not null;

create table if not exists public.digital_product_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.digital_products(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  delivery_email text not null check (delivery_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  amount_idr bigint not null check (amount_idr >= 0),
  status text not null default 'pending' check (status in ('pending','paid','refunded','cancelled','expired')),
  delivery_status text not null default 'not_sent' check (delivery_status in ('not_sent','queued','sent','failed')),
  delivered_at timestamptz,
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique(product_id,buyer_id)
);
create index if not exists digital_product_purchases_buyer_idx on public.digital_product_purchases(buyer_id,status,created_at desc);
create unique index if not exists digital_product_purchases_order_uidx on public.digital_product_purchases(payment_order_id) where payment_order_id is not null;

alter table public.digital_products enable row level security;
alter table public.digital_product_purchases enable row level security;
revoke all on public.digital_products from anon;
revoke all on public.digital_product_purchases from anon;
grant select on public.digital_products to authenticated;
grant select on public.digital_product_purchases to authenticated;

create policy digital_products_read on public.digital_products
for select to authenticated using (
  status='published' or public.current_app_role() = any(array['admin','owner'])
);
create policy digital_products_admin_insert on public.digital_products
for insert to authenticated with check (public.current_app_role() = any(array['admin','owner']));
create policy digital_products_admin_update on public.digital_products
for update to authenticated using (public.current_app_role() = any(array['admin','owner']))
with check (public.current_app_role() = any(array['admin','owner']));
create policy digital_products_admin_delete on public.digital_products
for delete to authenticated using (public.current_app_role() = any(array['admin','owner']));

create policy digital_product_purchases_read on public.digital_product_purchases
for select to authenticated using (
  buyer_id=(select auth.uid()) or public.current_app_role() = any(array['admin','owner'])
);

create or replace function public.create_digital_product_order(p_product_id uuid,p_delivery_email text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.digital_products%rowtype;
  v_email text := lower(btrim(coalesce(p_delivery_email,'')));
  v_order_id uuid;
  v_merchant text;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid delivery email'; end if;
  select * into v_product from public.digital_products where id=p_product_id and status='published';
  if not found then raise exception 'product unavailable'; end if;
  if exists(select 1 from public.digital_product_purchases where product_id=p_product_id and buyer_id=v_uid and status='paid') then
    return jsonb_build_object('status','already_owned');
  end if;

  -- Provider checkout intentionally remains disabled while Duitku is frozen.
  v_merchant := 'DP-' || replace(gen_random_uuid()::text,'-','');
  insert into public.payment_orders(user_id,provider,merchant_order_id,product_type,product_id,amount_idr,currency,status)
  values(v_uid,'duitku',v_merchant,'digital_product',p_product_id,v_product.price_idr,'IDR','pending')
  returning id into v_order_id;

  insert into public.digital_product_purchases(product_id,buyer_id,payment_order_id,delivery_email,amount_idr,status)
  values(p_product_id,v_uid,v_order_id,v_email,v_product.price_idr,'pending')
  on conflict(product_id,buyer_id) do update
  set payment_order_id=excluded.payment_order_id,
      delivery_email=excluded.delivery_email,
      amount_idr=excluded.amount_idr,
      status=case when digital_product_purchases.status='paid' then 'paid' else 'pending' end;

  return jsonb_build_object('status','payment_not_active','merchant_order_id',v_merchant,'amount_idr',v_product.price_idr);
end $$;
revoke all on function public.create_digital_product_order(uuid,text) from public,anon;
grant execute on function public.create_digital_product_order(uuid,text) to authenticated;

create or replace function public.activate_digital_product_purchase(p_payment_order_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if auth.role()<>'service_role' then raise exception 'forbidden'; end if;
  update public.digital_product_purchases
  set status='paid',paid_at=coalesce(paid_at,now()),delivery_status=case when delivery_status='not_sent' then 'queued' else delivery_status end
  where payment_order_id=p_payment_order_id and status<>'paid';
end $$;
revoke all on function public.activate_digital_product_purchase(uuid) from public,anon,authenticated;
grant execute on function public.activate_digital_product_purchase(uuid) to service_role;

create or replace function public.can_download_digital_product(p_product_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.digital_product_purchases p
    where p.product_id=p_product_id and p.buyer_id=auth.uid() and p.status='paid'
  ) or public.current_app_role() = any(array['admin','owner'])
$$;
revoke all on function public.can_download_digital_product(uuid) from public,anon;
grant execute on function public.can_download_digital_product(uuid) to authenticated,service_role;

create or replace function public.get_digital_product_finance()
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
  select case when public.current_app_role() = any(array['admin','owner']) then jsonb_build_object(
    'gross_revenue',coalesce(sum(amount_idr) filter(where status='paid'),0),
    'paid_orders',count(*) filter(where status='paid'),
    'pending_orders',count(*) filter(where status='pending'),
    'delivery_failures',count(*) filter(where status='paid' and delivery_status='failed')
  ) else null end
  from public.digital_product_purchases
$$;
revoke all on function public.get_digital_product_finance() from public,anon;
grant execute on function public.get_digital_product_finance() to authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('digital-products','digital-products',false,52428800,array['application/pdf','application/zip','image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy digital_products_storage_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id='digital-products' and public.current_app_role() = any(array['admin','owner'])
);
create policy digital_products_storage_admin_update on storage.objects
for update to authenticated using (
  bucket_id='digital-products' and public.current_app_role() = any(array['admin','owner'])
);
create policy digital_products_storage_admin_delete on storage.objects
for delete to authenticated using (
  bucket_id='digital-products' and public.current_app_role() = any(array['admin','owner'])
);

-- Buyer download and email delivery use a trusted server to create short-lived signed URLs
-- only after can_download_digital_product() succeeds. No buyer SELECT policy is added to storage.objects.
