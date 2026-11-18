-- 给物料单位加上 length（界面显示「条」），整数单位。
-- 在已经执行过 20261118014817_add_pair_unit.sql 的库上执行本文件。没有种子数据。
-- 本文件只放宽单位约束，不改任何物料的现有 unit。

begin;

alter table public.materials drop constraint materials_unit_known;
alter table public.materials add constraint materials_unit_known check (
  unit in ('piece', 'set', 'unit', 'roll', 'bottle', 'box', 'pair', 'length', 'metre', 'kg', 'litre', 'sqm')
);

alter table public.materials drop constraint materials_integer_min_stock;
alter table public.materials add constraint materials_integer_min_stock check (
  unit not in ('piece', 'set', 'unit', 'roll', 'bottle', 'box', 'pair', 'length')
  or min_stock = trunc(min_stock)
);

commit;
