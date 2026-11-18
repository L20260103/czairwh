# czairwh — Coolzone 库存试用（coolzone-inventory）

Coolzone Heating & Cooling 仓库的库存试用：物料目录、类别、供应商报价、入库 / 出库 / 退库、流水、待补货和 CSV 导出。

所有设备共用一份数据，存在 Supabase。没有内置示例物料或示例流水。空库就是空的。

**目前没有登录。任何打开 https://l20260103.github.io/czairwh/ 的人都能查看和修改库存。** 公开的 publishable key 写在前端里，只能当作公开钥匙，不要把 service role 或 secret key 放进这个仓库。

本项目是从原来的单文件成品 `reference/original.html` 还原出来的源码。

## 技术栈

React 19 + TypeScript、Vite、Tailwind CSS v4、shadcn/ui（Base UI 版）、lucide-react、sonner、`@supabase/supabase-js`。

## 使用

```bash
npm install      # 安装依赖（需要 Node.js 20+）
npm run dev      # 本地开发，浏览器打开终端里显示的地址
npm run build    # 打包，生成 dist/index.html（一个文件）
npm run preview  # 预览打包结果
```

打包结果仍是单文件，但库存要联网才能读写。GitHub Pages 在推到 `main` 后由 `.github/workflows/deploy.yml` 发布。构建不需要额外的密钥：地址和 publishable key 的默认值在 `src/lib/supabase/client.ts`。也可以用环境变量 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY` 覆盖。

## Supabase 设置

项目：`https://vpsemuqatdafmezsawbe.supabase.co`。

1. 打开 Supabase SQL Editor，整份执行 `supabase/migrations/20261118012637_init.sql`。这份文件没有种子行。不要在迁移里插入示例物料。
2. 执行成功后应有这些表，并且每张表都开了 RLS。`anon` 和 `authenticated` 可以 select / insert / update / delete。
3. 同一份 SQL 会把这些表加入 `supabase_realtime` 发布。如果报 publication 不存在，到 Database → Publications，给这些表打开 Realtime。
4. Data API 保持开启。
5. 建议在 Authentication → Sign In / Providers 里关闭允许公开注册。应用现在没有登录页，关掉注册不影响使用，只是少一个入口。
6. **现在不用改 Site URL。** 以后接登录时，把 Site URL 和 Redirect URLs 设为 `https://l20260103.github.io/czairwh/`。
7. 类别由你自己用 SQL 插入。结构支持顶级和 `parent_id` 下级，`name_zh` 与 `name_en` 至少填一个。计划中的两个顶级组是「风管和出风 / Ducting & Air Distribution」和「安装耗材 / Installation Consumables」，以及它们的子类。界面显示为「中文 English」。

打开页面后，别的电脑应看到同一份目录和流水。知道网址就能改，这是当前刻意的开放策略。

以后要改成必须登录：执行 `supabase/authenticated-only.sql`（收紧策略的唯一位置），把 `src/lib/supabase/access.ts` 里的 `AUTH_REQUIRED` 改为 `true`，再用 `src/components/AuthGate.tsx` 包住应用并接上邮箱密码登录。不要做公开注册。

## 表

| 表 | 列 |
| --- | --- |
| `categories` | `id`，`name_zh`，`name_en`，`parent_id`，`sort_order`，`created_at` |
| `suppliers` | `id`，`name`，`contact`，`notes`，`updated_at` |
| `materials` | `id`，`sku`，`name_zh`，`name_en`，`category_id`，`unit`，`location`，`min_stock`，`active`，`note`，`created_at` |
| `supplier_products` | `id`，`material_id`，`supplier_id`，`supplier_code`，`supplier_product_name`，`price_ex_gst`，`currency`，`notes`，`updated_at` |
| `stock_movements` | `id`，`at`，`type`，`material_id`，`quantity`，`before_qty`，`after_qty`，`operator`，`job_number`，`recipient`，`supplier_id`，`reference`，`notes` |
| `app_settings` | `setting_key`，`setting_value`，`updated_at` |

`supplier_code` 即使在同一供应商下也不唯一。唯一键是 `(supplier_id, supplier_code, supplier_product_name)`。`currency` 固定为 `AUD`。入库的 `supplier_id` 可空；出库和退库必须为空。`app_settings` 目前只有 `last_operator`，没有预插行。

单位不是表，是物料 `unit` 上的 check 约束（`piece`、`set`、`unit`、`roll`、`bottle`、`box`、`pair`、`length`、`metre`、`kg`、`litre`、`sqm`）。`pair` 显示为「对」，`length` 显示为「条」。若已经执行过初版迁移，再执行 `supabase/migrations/20261118014817_add_pair_unit.sql` 才能保存单位为「对」的物料。已经有库的还要再执行 `supabase/migrations/20261118031912_add_length_unit.sql` 才能保存单位为「条」的物料。操作人、领用人和工单号是流水上的文本，没有单独主档。

`materials.location` 可以不填。列仍然是 `not null`，默认 `''`，空字符串表示没有库位，`materials_location_len` 为 `char_length(location) <= 40`。若库是在这条约束放宽之前建的，再执行 `supabase/migrations/20261118023000_optional_location.sql`。这份迁移也会把库位「待定」改成空字符串。

## 目录结构

```
index.html                 页面骨架
vite.config.ts             Vite 配置（单文件打包，base 为 /czairwh/）
supabase/
  migrations/20261118012637_init.sql              建表、RLS、Realtime。没有种子数据
  migrations/20261118014817_add_pair_unit.sql     已有库补上单位「对」
  migrations/20261118023000_optional_location.sql 已有库把库位改成可空字符串
  migrations/20261118031912_add_length_unit.sql   已有库补上单位「条」
  authenticated-only.sql                          以后收紧为仅登录用户。现在不要执行
src/
  lib/supabase/            客户端、公开钥匙、登录开关
  lib/inventory/           校验、计算、Supabase 读写
  components/AuthGate.tsx  登录门占位，没有挂到 App 上
  pages/                   总览、库存、出入库、流水、待补货、物料、供应商、类别
reference/                 原始文件，不参与打包
```

## 改规则

数量精度、出库 / 退库限制、重复提交窗口等业务规则都在 `src/lib/inventory/inventory.ts`。
类别、供应商和报价的校验在 `src/lib/inventory/catalog.ts`。
「假设与范围」页面已删除。地址栏里的旧 `#/guide` 会回到总览。
