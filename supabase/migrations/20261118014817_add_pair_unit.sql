-- 给物料单位加上 pair（界面显示「对」），整数单位。
-- 在已经执行过 20261118012637_init.sql 的库上执行本文件。没有种子数据。

begin;

alter table public.materials drop constraint materials_unit_known;
alter table public.materials add constraint materials_unit_known check (
  unit in ('piece', 'set', 'unit', 'roll', 'bottle', 'box', 'pair', 'metre', 'kg', 'litre', 'sqm')
);

alter table public.materials drop constraint materials_integer_min_stock;
alter table public.materials add constraint materials_integer_min_stock check (
  unit not in ('piece', 'set', 'unit', 'roll', 'bottle', 'box', 'pair')
  or min_stock = trunc(min_stock)
);

commit;
