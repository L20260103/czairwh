-- 不要现在执行。
--
-- 这是以后收紧权限的唯一一份 SQL。应用接上登录之后再在 SQL Editor 执行：
-- 1. 把 src/lib/supabase/access.ts 里的 AUTH_REQUIRED 改为 true
-- 2. 在 App 里用 src/components/AuthGate.tsx 包住库存界面，并在该组件里接上邮箱密码登录
-- 3. 然后执行本文件
--
-- 执行后，未登录的浏览器（anon）不能再读、也不能再改。authenticated 仍可 select / insert / update / delete。
-- 可以重复执行。

begin;

drop policy if exists categories_select_open on public.categories;
drop policy if exists categories_insert_open on public.categories;
drop policy if exists categories_update_open on public.categories;
drop policy if exists categories_delete_open on public.categories;
drop policy if exists suppliers_select_open on public.suppliers;
drop policy if exists suppliers_insert_open on public.suppliers;
drop policy if exists suppliers_update_open on public.suppliers;
drop policy if exists suppliers_delete_open on public.suppliers;
drop policy if exists materials_select_open on public.materials;
drop policy if exists materials_insert_open on public.materials;
drop policy if exists materials_update_open on public.materials;
drop policy if exists materials_delete_open on public.materials;
drop policy if exists supplier_products_select_open on public.supplier_products;
drop policy if exists supplier_products_insert_open on public.supplier_products;
drop policy if exists supplier_products_update_open on public.supplier_products;
drop policy if exists supplier_products_delete_open on public.supplier_products;
drop policy if exists stock_movements_select_open on public.stock_movements;
drop policy if exists stock_movements_insert_open on public.stock_movements;
drop policy if exists stock_movements_update_open on public.stock_movements;
drop policy if exists stock_movements_delete_open on public.stock_movements;
drop policy if exists app_settings_select_open on public.app_settings;
drop policy if exists app_settings_insert_open on public.app_settings;
drop policy if exists app_settings_update_open on public.app_settings;
drop policy if exists app_settings_delete_open on public.app_settings;

revoke select, insert, update, delete on table
  public.categories,
  public.suppliers,
  public.materials,
  public.supplier_products,
  public.stock_movements,
  public.app_settings
from anon;

drop policy if exists categories_select_authenticated on public.categories;
drop policy if exists categories_insert_authenticated on public.categories;
drop policy if exists categories_update_authenticated on public.categories;
drop policy if exists categories_delete_authenticated on public.categories;
drop policy if exists suppliers_select_authenticated on public.suppliers;
drop policy if exists suppliers_insert_authenticated on public.suppliers;
drop policy if exists suppliers_update_authenticated on public.suppliers;
drop policy if exists suppliers_delete_authenticated on public.suppliers;
drop policy if exists materials_select_authenticated on public.materials;
drop policy if exists materials_insert_authenticated on public.materials;
drop policy if exists materials_update_authenticated on public.materials;
drop policy if exists materials_delete_authenticated on public.materials;
drop policy if exists supplier_products_select_authenticated on public.supplier_products;
drop policy if exists supplier_products_insert_authenticated on public.supplier_products;
drop policy if exists supplier_products_update_authenticated on public.supplier_products;
drop policy if exists supplier_products_delete_authenticated on public.supplier_products;
drop policy if exists stock_movements_select_authenticated on public.stock_movements;
drop policy if exists stock_movements_insert_authenticated on public.stock_movements;
drop policy if exists stock_movements_update_authenticated on public.stock_movements;
drop policy if exists stock_movements_delete_authenticated on public.stock_movements;
drop policy if exists app_settings_select_authenticated on public.app_settings;
drop policy if exists app_settings_insert_authenticated on public.app_settings;
drop policy if exists app_settings_update_authenticated on public.app_settings;
drop policy if exists app_settings_delete_authenticated on public.app_settings;

create policy categories_select_authenticated on public.categories for select to authenticated using (true);
create policy categories_insert_authenticated on public.categories for insert to authenticated with check (true);
create policy categories_update_authenticated on public.categories for update to authenticated using (true) with check (true);
create policy categories_delete_authenticated on public.categories for delete to authenticated using (true);

create policy suppliers_select_authenticated on public.suppliers for select to authenticated using (true);
create policy suppliers_insert_authenticated on public.suppliers for insert to authenticated with check (true);
create policy suppliers_update_authenticated on public.suppliers for update to authenticated using (true) with check (true);
create policy suppliers_delete_authenticated on public.suppliers for delete to authenticated using (true);

create policy materials_select_authenticated on public.materials for select to authenticated using (true);
create policy materials_insert_authenticated on public.materials for insert to authenticated with check (true);
create policy materials_update_authenticated on public.materials for update to authenticated using (true) with check (true);
create policy materials_delete_authenticated on public.materials for delete to authenticated using (true);

create policy supplier_products_select_authenticated on public.supplier_products for select to authenticated using (true);
create policy supplier_products_insert_authenticated on public.supplier_products for insert to authenticated with check (true);
create policy supplier_products_update_authenticated on public.supplier_products for update to authenticated using (true) with check (true);
create policy supplier_products_delete_authenticated on public.supplier_products for delete to authenticated using (true);

create policy stock_movements_select_authenticated on public.stock_movements for select to authenticated using (true);
create policy stock_movements_insert_authenticated on public.stock_movements for insert to authenticated with check (true);
create policy stock_movements_update_authenticated on public.stock_movements for update to authenticated using (true) with check (true);
create policy stock_movements_delete_authenticated on public.stock_movements for delete to authenticated using (true);

create policy app_settings_select_authenticated on public.app_settings for select to authenticated using (true);
create policy app_settings_insert_authenticated on public.app_settings for insert to authenticated with check (true);
create policy app_settings_update_authenticated on public.app_settings for update to authenticated using (true) with check (true);
create policy app_settings_delete_authenticated on public.app_settings for delete to authenticated using (true);

grant select, insert, update, delete on table
  public.categories,
  public.suppliers,
  public.materials,
  public.supplier_products,
  public.stock_movements,
  public.app_settings
to authenticated;

commit;
