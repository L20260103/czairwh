import { useState } from "react";

import { CategoryDialog } from "@/components/CategoryDialog";
import { EmptyState, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { bilingualLabel } from "@/lib/format";
import { categoriesInTreeOrder } from "@/lib/inventory/catalog";
import type { Category } from "@/lib/inventory/types";
import { useInventory } from "@/store/InventoryProvider";

/** 类别（#/categories）。名称中英双语，可以有上级。 */
export function CategoriesPage() {
  const { state } = useInventory();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const rows = categoriesInTreeOrder(state.categories);

  return (
    <div>
      <PageHeader title="类别">
        物料必须选一个类别。中文名和英文名至少填一个，两边都有时显示为「中文 English」。可以有上级，例如顶级「风管和出风 Ducting & Air Distribution」下面再放子类。类别清单不写在程序里。
      </PageHeader>
      <div className="mb-4">
        <Button className="h-11 px-4" onClick={() => setEditing("new")}>
          新增类别
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="还没有类别">先新增顶级类别，再按需要加下级。空库不会自带类别。</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {rows.map(({ category, depth }) => (
            <li key={category.id} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10" style={{ marginLeft: depth * 16 }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{bilingualLabel(category.nameZh, category.nameEn)}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {category.nameZh || "无中文名"} · {category.nameEn || "无英文名"} · 排序 {category.sortOrder}
                    {depth === 0 ? " · 顶级" : " · 下级"}
                  </p>
                </div>
                <Button variant="outline" className="h-10 bg-white" onClick={() => setEditing(category)}>
                  编辑
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <CategoryDialog
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
