import { toast } from "sonner";

import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { downloadFile, reorderCsv } from "@/lib/csv";
import { bilingualLabel, formatAud, joinMeta, locationText } from "@/lib/format";
import { categoryPath, cheapestOffers, supplierName } from "@/lib/inventory/catalog";
import { formatQty, getReorderSuggestions } from "@/lib/inventory/inventory";
import { getUnit } from "@/lib/inventory/units";
import { Link } from "@/lib/router";
import type { InventoryState } from "@/lib/inventory/types";
import { useInventory } from "@/store/InventoryProvider";

function ReorderPrice({ state, materialId }: { state: InventoryState; materialId: string }) {
  const best = cheapestOffers(state.supplierProducts, materialId)[0];
  if (!best) return <p className="mt-1 text-sm text-[#8a4b16]">还没有供应商报价。</p>;
  return (
    <p className="mt-1 text-sm">
      最低 {supplierName(state.suppliers, best.supplierId)}
      {best.supplierCode ? ` · ${best.supplierCode}` : ""} · {best.supplierProductName} · {formatAud(best.priceExGst)} 未含 GST
    </p>
  );
}

/** 待补货（#/reorder）。 */
export function ReorderPage() {
  const { state } = useInventory();
  const suggestions = getReorderSuggestions(state);

  function exportCsv() {
    downloadFile("coolzone-待补货建议.csv", `\uFEFF${reorderCsv(state)}`, "text/csv;charset=utf-8");
    toast.success("已下载待补货建议");
  }

  return (
    <div>
      <PageHeader title="待补货">
        当前库存低于最低库存时才会出现。建议补货量 = 最低库存 − 当前库存，只补到最低线。这里没有最高库存，也没有采购批量。这些数字不会发送给供应商，也不会写入 Tradify 或 monday。
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button className="h-11 px-4" onClick={exportCsv} disabled={suggestions.length === 0}>
          导出建议 CSV
        </Button>
        <p className="text-sm text-muted-foreground">导出是文件下载，不是下单。</p>
      </div>
      {suggestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#c9d5df] bg-white/70 px-4 py-10 text-center">
          <p className="font-medium text-[#1c3144]">目前没有低于最低库存的物料</p>
          <p className="mt-1 text-sm text-muted-foreground">最低库存为 0 的物料不在监控里。</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {suggestions.map((item) => (
            <li key={item.material.id} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{bilingualLabel(item.material.nameZh, item.material.nameEn)}</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {joinMeta([
                      item.material.sku,
                      categoryPath(state.categories, item.material.categoryId),
                      locationText(item.material.location),
                    ])}
                  </p>
                  <ReorderPrice state={state} materialId={item.material.id} />
                </div>
                <p className="text-right">
                  <span className="block text-xs text-muted-foreground">建议补货</span>
                  <span className="text-2xl font-semibold tabular-nums text-[#8a4b16]">
                    {formatQty(item.suggested)}
                    <span className="ml-1 text-sm font-normal">{getUnit(item.material.unit).label}</span>
                  </span>
                </p>
              </div>
              <p className="mt-3 text-sm tabular-nums">
                现存 {formatQty(item.onHand)} · 最低 {formatQty(item.material.minStock)} {getUnit(item.material.unit).label}
              </p>
              <div className="mt-3">
                <Link
                  href={`/move?type=receipt&material=${item.material.id}`}
                  className="text-sm font-medium text-[#1f5f78]"
                >
                  到货后记一笔入库
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
