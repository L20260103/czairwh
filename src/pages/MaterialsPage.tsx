import { useState } from "react";

import { OriginBadge, PageHeader } from "@/components/common";
import { MaterialDialog } from "@/components/MaterialDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Material } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { useInventory } from "@/store/InventoryProvider";

/** 物料目录（#/materials）。 */
export function MaterialsPage() {
  const { state } = useInventory();
  const [query, setQuery] = useState("");
  /** "new" = 新增；Material = 编辑；null = 关闭。 */
  const [editing, setEditing] = useState<Material | "new" | null>(null);

  const q = query.trim().toLowerCase();
  const materials = state.materials.filter((m) =>
    q ? `${m.sku} ${m.name} ${m.category} ${m.location}`.toLowerCase().includes(q) : true,
  );

  return (
    <div>
      <PageHeader title="物料目录">
        这里维护 SKU、名称、类别、单位、库位和最低库存。改最低库存不会改变现存数量。已有流水的物料不能删除，也不能改 SKU 或单位。
      </PageHeader>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索目录"
          className="h-11 bg-white"
          aria-label="搜索物料目录"
        />
        <Button className="h-11 px-4" onClick={() => setEditing("new")}>
          新增物料
        </Button>
      </div>
      <ul className="grid gap-3">
        {materials.map((material) => (
          <li key={material.id} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{material.name}</h2>
                  <OriginBadge sample={material.sample} />
                  {material.active ? null : <span className="text-xs text-muted-foreground">已停用</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {material.sku} · {material.category} · {material.location}
                </p>
                <p className="mt-1 text-sm">
                  单位 {getUnit(material.unit).label}（{getUnit(material.unit).en}） · 最低库存 {material.minStock}
                </p>
              </div>
              <Button variant="outline" className="h-10 bg-white" onClick={() => setEditing(material)}>
                编辑
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {materials.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">目录里没有匹配的物料。</p> : null}
      {editing ? (
        <MaterialDialog
          key={editing === "new" ? "new" : editing.id}
          material={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
