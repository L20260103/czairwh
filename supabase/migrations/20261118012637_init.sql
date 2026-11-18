-- Coolzone 库存共享库。没有种子数据：空库应显示空目录。
-- 在 Supabase SQL Editor 里整份执行。不要把示例物料、示例流水或类别写进本文件。
-- 类别（含下面两组及其下级）由你稍后自行插入：
--   风管和出风 / Ducting & Air Distribution
--   安装耗材 / Installation Consumables
-- 顶级行 parent_id 为空，下级行的 parent_id 指向顶级。name_zh、name_en 至少填一个。
-- 界面把两者显示成「中文 English」。
--
-- 当前访问是开放的：anon 与 authenticated 都可以 select / insert / update / delete。
-- 知道网址和公开的 publishable key 的人都能改数据。
-- 以后要改成必须登录：不要改这份已经应用的迁移，去执行 supabase/authenticated-only.sql，
-- 再把应用里的 AuthGate 接上（见 src/lib/supabase/access.ts）。
--
-- 本迁移不创建视图。以后若加视图，必须 with (security_invoker = true)。
-- 本迁移不在 public 创建函数，因此没有 security definer 函数。
-- 单位不是单独的表：应用里的单位是固定代码，用 check 约束写死，避免再插入种子行。

begin;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name_zh text not null default '',
  name_en text not null default '',
  parent_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_parent_fkey
    foreign key (parent_id) references public.categories (id) on delete restrict,
  constraint categories_parent_not_self check (parent_id is null or parent_id <> id),
  constraint categories_name_zh_len check (char_length(name_zh) <= 80),
  constraint categories_name_en_len check (char_length(name_en) <= 120),
  constraint categories_name_present check (char_length(btrim(name_zh)) > 0 or char_length(btrim(name_en)) > 0),
  constraint categories_sort_order_range check (sort_order between -100000 and 100000)
);

comment on table public.categories is
  '物料类别，可有上级。中英名至少有一个。显示为「中文 English」。不要在迁移里插入种子。';

create unique index categories_root_name_unique
  on public.categories (lower(name_zh), lower(name_en))
  where parent_id is null;

create unique index categories_child_name_unique
  on public.categories (parent_id, lower(name_zh), lower(name_en))
  where parent_id is not null;

create index categories_parent_id_idx on public.categories (parent_id);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  constraint suppliers_name_len check (char_length(name) between 1 and 80),
  constraint suppliers_contact_len check (char_length(contact) <= 120),
  constraint suppliers_notes_len check (char_length(notes) <= 200)
);

comment on table public.suppliers is '供应商主档。名称、联系方式和备注。';

create unique index suppliers_name_lower_idx on public.suppliers (lower(name));

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  name_zh text not null default '',
  name_en text not null default '',
  category_id uuid not null,
  unit text not null,
  location text not null,
  min_stock numeric(7, 2) not null,
  active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint materials_category_id_fkey
    foreign key (category_id) references public.categories (id) on delete restrict,
  constraint materials_sku_unique unique (sku),
  constraint materials_sku_format check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
  constraint materials_name_zh_len check (char_length(name_zh) <= 80),
  constraint materials_name_en_len check (char_length(name_en) <= 120),
  constraint materials_name_present check (char_length(btrim(name_zh)) > 0 or char_length(btrim(name_en)) > 0),
  constraint materials_location_len check (char_length(location) between 1 and 40),
  constraint materials_note_len check (char_length(note) <= 200),
  constraint materials_unit_known check (
    unit in ('piece', 'set', 'unit', 'roll', 'bottle', 'box', 'metre', 'kg', 'litre', 'sqm')
  ),
  constraint materials_min_stock_range check (min_stock >= 0 and min_stock <= 99999.99),
  constraint materials_integer_min_stock check (
    unit not in ('piece', 'set', 'unit', 'roll', 'bottle', 'box')
    or min_stock = trunc(min_stock)
  )
);

comment on table public.materials is
  '内部物料。中英名至少有一个，显示为「中文 English」。现存数量不存在这里，由 stock_movements 推算。';

create index materials_category_id_idx on public.materials (category_id);

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null,
  supplier_id uuid not null,
  supplier_code text not null default '',
  supplier_product_name text not null,
  price_ex_gst numeric(12, 2) not null,
  currency text not null default 'AUD',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  constraint supplier_products_material_id_fkey
    foreign key (material_id) references public.materials (id) on delete restrict,
  constraint supplier_products_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers (id) on delete restrict,
  constraint supplier_products_code_len check (char_length(supplier_code) <= 80),
  constraint supplier_products_name_len check (char_length(supplier_product_name) between 1 and 120),
  constraint supplier_products_notes_len check (char_length(notes) <= 200),
  constraint supplier_products_currency_aud check (currency = 'AUD'),
  constraint supplier_products_price_range check (price_ex_gst >= 0 and price_ex_gst <= 999999.99)
);

comment on table public.supplier_products is
  '供应商对自己货品的叫法和未含 GST 价格。同一内部物料可以有多家供应商。supplier_code 即使在同一供应商下也不唯一（例如 Ideal Vent Supply 的 CRBB450/500 对应两件不同的货）。唯一键是 (supplier_id, supplier_code, supplier_product_name)。';

create unique index supplier_products_identity_idx
  on public.supplier_products (supplier_id, supplier_code, supplier_product_name);

create index supplier_products_material_id_idx on public.supplier_products (material_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null,
  type text not null,
  material_id uuid not null,
  quantity numeric(7, 2) not null,
  before_qty numeric(12, 2) not null,
  after_qty numeric(12, 2) not null,
  operator text not null,
  job_number text not null default '',
  recipient text not null default '',
  supplier_id uuid,
  reference text not null default '',
  notes text not null default '',
  constraint stock_movements_material_id_fkey
    foreign key (material_id) references public.materials (id) on delete restrict,
  constraint stock_movements_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers (id) on delete restrict,
  constraint stock_movements_type_known check (type in ('receipt', 'issue', 'return')),
  constraint stock_movements_quantity_range check (quantity > 0 and quantity <= 99999.99),
  constraint stock_movements_operator_len check (char_length(operator) between 1 and 40),
  constraint stock_movements_job_len check (char_length(job_number) <= 40),
  constraint stock_movements_recipient_len check (char_length(recipient) <= 40),
  constraint stock_movements_reference_len check (char_length(reference) <= 80),
  constraint stock_movements_notes_len check (char_length(notes) <= 200),
  constraint stock_movements_fields_by_type check (
    (
      type = 'receipt'
      and job_number = ''
      and recipient = ''
    )
    or (
      type = 'issue'
      and char_length(btrim(job_number)) > 0
      and char_length(btrim(recipient)) > 0
    )
    or (
      type = 'return'
      and char_length(btrim(job_number)) > 0
    )
  ),
  constraint stock_movements_supplier_on_receipt check (type = 'receipt' or supplier_id is null)
);

comment on table public.stock_movements is
  '库存流水。应用界面只追加。入库可以选供应商，出库和退库的 supplier_id 必须为空。';

create index stock_movements_material_id_at_idx on public.stock_movements (material_id, at);
create index stock_movements_at_idx on public.stock_movements (at);
create index stock_movements_supplier_id_idx on public.stock_movements (supplier_id);

create table public.app_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now(),
  constraint app_settings_key_known check (setting_key in ('last_operator')),
  constraint app_settings_last_operator_len check (
    setting_key <> 'last_operator' or char_length(setting_value) <= 40
  )
);

comment on table public.app_settings is
  '全员共用的设置。目前只有 setting_key = last_operator。没有预插行。';

alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.materials enable row level security;
alter table public.supplier_products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.app_settings enable row level security;

create policy categories_select_open on public.categories for select to anon, authenticated using (true);
create policy categories_insert_open on public.categories for insert to anon, authenticated with check (true);
create policy categories_update_open on public.categories for update to anon, authenticated using (true) with check (true);
create policy categories_delete_open on public.categories for delete to anon, authenticated using (true);

create policy suppliers_select_open on public.suppliers for select to anon, authenticated using (true);
create policy suppliers_insert_open on public.suppliers for insert to anon, authenticated with check (true);
create policy suppliers_update_open on public.suppliers for update to anon, authenticated using (true) with check (true);
create policy suppliers_delete_open on public.suppliers for delete to anon, authenticated using (true);

create policy materials_select_open on public.materials for select to anon, authenticated using (true);
create policy materials_insert_open on public.materials for insert to anon, authenticated with check (true);
create policy materials_update_open on public.materials for update to anon, authenticated using (true) with check (true);
create policy materials_delete_open on public.materials for delete to anon, authenticated using (true);

create policy supplier_products_select_open on public.supplier_products for select to anon, authenticated using (true);
create policy supplier_products_insert_open on public.supplier_products for insert to anon, authenticated with check (true);
create policy supplier_products_update_open on public.supplier_products for update to anon, authenticated using (true) with check (true);
create policy supplier_products_delete_open on public.supplier_products for delete to anon, authenticated using (true);

create policy stock_movements_select_open on public.stock_movements for select to anon, authenticated using (true);
create policy stock_movements_insert_open on public.stock_movements for insert to anon, authenticated with check (true);
create policy stock_movements_update_open on public.stock_movements for update to anon, authenticated using (true) with check (true);
create policy stock_movements_delete_open on public.stock_movements for delete to anon, authenticated using (true);

create policy app_settings_select_open on public.app_settings for select to anon, authenticated using (true);
create policy app_settings_insert_open on public.app_settings for insert to anon, authenticated with check (true);
create policy app_settings_update_open on public.app_settings for update to anon, authenticated using (true) with check (true);
create policy app_settings_delete_open on public.app_settings for delete to anon, authenticated using (true);

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.categories,
  public.suppliers,
  public.materials,
  public.supplier_products,
  public.stock_movements,
  public.app_settings
to anon, authenticated, service_role;

revoke truncate, references, trigger on table
  public.categories,
  public.suppliers,
  public.materials,
  public.supplier_products,
  public.stock_movements,
  public.app_settings
from anon, authenticated;

alter table public.categories replica identity full;
alter table public.suppliers replica identity full;
alter table public.materials replica identity full;
alter table public.supplier_products replica identity full;
alter table public.stock_movements replica identity full;
alter table public.app_settings replica identity full;

alter publication supabase_realtime add table
  public.categories,
  public.suppliers,
  public.materials,
  public.supplier_products,
  public.stock_movements,
  public.app_settings;

commit;
