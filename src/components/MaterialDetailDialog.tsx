import { Fragment } from "react";

import { MovementList } from "@/components/MovementList";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BilingualName } from "@/components/BilingualName";
import { LocationChips } from "@/components/LocationChips";
import { formatAud, joinMeta, locationText, movementTypeLabel } from "@/lib/format";
import { categoryPath, supplierName } from "@/lib/inventory/catalog";
import { formatQty, getOnHand, movementsNewestFirst, stockedMaterialIds } from "@/lib/inventory/inventory";
import { visibleSpecEntries } from "@/lib/inventory/specs";
import type { Material, MovementType } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { useInventory } from "@/store/InventoryProvider";

/** 物料详情：库存、报价、技术参数、最近流水，以及入库 / 出库 / 退库。 */
export function MaterialDetailDialog({
  material,
  onClose,
  onAct,
  onEdit,
}: {
  material: Material;
  onClose: () => void;
  onAct: (type: MovementType) => void;
  onEdit: () => void;
}) {
  const { state } = useInventory();
  const onHand = getOnHand(state, material.id);
  const stocked = stockedMaterialIds(state).has(material.id);
  const unit = getUnit(material.unit);
  const offers = state.supplierProducts
    .filter((offer) => offer.materialId === material.id)
    .slice()
    .sort((a, b) => a.priceExGst - b.priceExGst || a.supplierProductName.localeCompare(b.supplierProductName, "zh"));
  const specs = visibleSpecEntries(material.specs);
  const recent = movementsNewestFirst(state)
    .filter((row) => row.materialId === material.id)
    .slice(0, 8);
  const materials = state.materials.some((item) => item.id === material.id) ? state.materials : [...state.materials, material];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl" style={{ maxWidth: "48rem" }} data-testid="material-detail">
        <DialogHeader>
          <DialogTitle>
            <BilingualName nameZh={material.nameZh} nameEn={material.nameEn} />
          </DialogTitle>
          <DialogDescription>
            {joinMeta([material.sku, categoryPath(state.categories, material.categoryId) || "未分类", locationText(material.location)])}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">当前库存</p>
            <p className="text-3xl font-semibold whitespace-nowrap tabular-nums text-[#1c3144]" data-testid="detail-stock">
              {formatQty(onHand)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{unit.label}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {stocked ? `最低库存 ${formatQty(material.minStock)}` : "还没有出入库记录"}
              {material.active ? "" : " · 已停用"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["receipt", "issue", "return"] as const).map((type) => (
              <Button key={type} type="button" variant="outline" className="h-10 bg-white" onClick={() => onAct(type)}>
                {movementTypeLabel(type)}
              </Button>
            ))}
          </div>
        </div>

        <section>
          <h3 className="text-sm font-semibold text-[#1c3144]">货位</h3>
          <div className="mt-2">
            <LocationChips materialId={material.id} emptyLabel="还没标在仓库地图上。" />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-[#1c3144]">供应商报价</h3>
          <p className="mt-1 text-xs text-muted-foreground">价格未含 GST。</p>
          {offers.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">还没有供应商报价。</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {offers.map((offer) => (
                <li key={offer.id} className="rounded-lg bg-[#f4f8fa] px-3 py-2 text-sm">
                  <p className="font-medium text-[#1c3144]">{supplierName(state.suppliers, offer.supplierId)}</p>
                  <p className="text-muted-foreground">
                    {joinMeta([offer.supplierCode, offer.supplierProductName])}
                  </p>
                  <p className="mt-1 tabular-nums">
                    {formatAud(offer.priceExGst)} <span className="text-xs text-muted-foreground">未含 GST</span>
                  </p>
                  {offer.notes ? <p className="mt-1 text-xs text-muted-foreground">{offer.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-[#1c3144]">技术参数</h3>
          {specs.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">没有技术参数。</p>
          ) : (
            <dl className="mt-2 grid grid-cols-[minmax(6.5rem,10rem)_minmax(0,1fr)] gap-x-3 gap-y-2">
              {specs.map((entry) => (
                <Fragment key={entry.key}>
                  <dt>
                    <span className="block text-[13px] font-medium leading-5 text-[#1c3144]">{entry.label.primary}</span>
                    {entry.label.secondary ? (
                      <span className="block text-[11px] leading-4 text-muted-foreground">{entry.label.secondary}</span>
                    ) : null}
                  </dt>
                  <dd className="min-w-0 self-center break-words text-sm leading-5">{entry.text}</dd>
                </Fragment>
              ))}
            </dl>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-[#1c3144]">最近流水</h3>
          <div className="mt-2">
            <MovementList rows={recent} materials={materials} suppliers={state.suppliers} compact />
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="button" variant="outline" className="h-10 bg-white" onClick={onEdit}>
            编辑物料
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
