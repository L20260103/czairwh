import { useMemo, useState } from "react";

import { EmptyState, PageHeader, ShowMore, useVisibleLimit } from "@/components/common";
import { MaterialDialog } from "@/components/MaterialDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bilingualLabel, formatAud, joinMeta, locationText } from "@/lib/format";
import { categoryPath, cheapestOffers, supplierName } from "@/lib/inventory/catalog";
import type { InventoryState, Material, SupplierProduct } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { useInventory } from "@/store/InventoryProvider";

const NO_OFFERS: SupplierProduct[] = [];

function CheapestOffer({ state, materialId, offers }: { state: InventoryState; materialId: string; offers: SupplierProduct[] }) {
  const best = cheapestOffers(offers, materialId)[0];
  if (!best) return <p className="mt-1 text-sm text-muted-foreground">还没有供应商报价。</p>;
  return (
    <p className="mt-1 text-sm">
      最低报价 {supplierName(state.suppliers, best.supplierId)}
      {best.supplierCode ? ` · ${best.supplierCode}` : ""} · {best.supplierProductName} · {formatAud(best.priceExGst)} 未含 GST
    </p>
  );
}

/** 物料目录（#/materials）。 */
export function MaterialsPage() {
  const { state } = useInventory();
  const [query, setQuery] = useState("");
  /** "new" = 新增；Material = 编辑；null = 关闭。 */
  const [editing, setEditing] = useState<Material | "new" | null>(null);

  const indexed = useMemo(() => {
    const offersByMaterial = new Map<string, SupplierProduct[]>();
    for (const offer of state.supplierProducts) {
      const bucket = offersByMaterial.get(offer.materialId);
      if (bucket) bucket.push(offer);
      else offersByMaterial.set(offer.materialId, [offer]);
    }
    return state.materials.map((material) => ({
      material,
      offers: offersByMaterial.get(material.id) ?? NO_OFFERS,
      haystack: `${material.sku} ${material.nameZh} ${material.nameEn} ${categoryPath(state.categories, material.categoryId)} ${locationText(material.location)}`.toLowerCase(),
    }));
  }, [state.categories, state.materials, state.supplierProducts]);

  const q = query.trim().toLowerCase();
  const materials = q ? indexed.filter((row) => row.haystack.includes(q)) : indexed;
  const [visibleLimit, showMore] = useVisibleLimit(q);

  return (
    <div>
      <PageHeader title="物料目录">
        这里维护 SKU、中英文名、类别、单位、库位、最低库存和供应商报价。中英文至少填一个，两边都有时显示为「中文 English」。库位可以不填。改最低库存不会改变现存数量。已有流水的物料不能删除，也不能改 SKU 或单位。
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
      <p className="mb-3 text-xs text-muted-foreground">
        显示 {materials.length} / {state.materials.length}
      </p>
      <ul className="grid gap-3">
        {materials.slice(0, visibleLimit).map(({ material, offers }) => (
          <li key={material.id} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{bilingualLabel(material.nameZh, material.nameEn)}</h2>
                  {material.active ? null : <span className="text-xs text-muted-foreground">已停用</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {joinMeta([material.sku, categoryPath(state.categories, material.categoryId) || "未分类", locationText(material.location)])}
                </p>
                <CheapestOffer state={state} materialId={material.id} offers={offers} />
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
      {materials.length > visibleLimit ? <ShowMore onClick={showMore} /> : null}
      {materials.length === 0 ? (
        <EmptyState title={query.trim() ? "目录里没有匹配的物料" : "目录还是空的"}>
          {query.trim() ? "换个关键词，或清除搜索。" : "点「新增物料」添加第一条。如果还没有类别，要先去类别页。"}
        </EmptyState>
      ) : null}
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
