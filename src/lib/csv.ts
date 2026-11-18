import { formatAud, formatMelbourneTime, locationText, movementTypeLabel } from "@/lib/format";
import { categoryPath, cheapestOffers, supplierName } from "@/lib/inventory/catalog";
import { flattenedSpecKeys, specCsvCells, uniqueSpecHeaders } from "@/lib/inventory/specs";
import {
  formatQty,
  fromCents,
  getOnHand,
  getReorderSuggestions,
  getStockStatus,
  stockedMaterialIds,
  toCents,
  withDerivedBalances,
} from "@/lib/inventory/inventory";
import type { InventoryState, Material } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";

function escapeCell(value: unknown): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

function materialNames(material: Material): [string, string] {
  return [material.nameZh, material.nameEn];
}

function cheapestText(state: InventoryState, materialId: string): [string, string, string, string] {
  const best = cheapestOffers(state.supplierProducts, materialId)[0];
  if (!best) return ["", "", "", ""];
  return [supplierName(state.suppliers, best.supplierId), best.supplierCode, best.supplierProductName, formatAud(best.priceExGst)];
}

function statusText(minStock: number, onHand: number, active: boolean, stocked: boolean): string {
  if (!stocked) return active ? "未入过库" : "已停用；未入过库";
  const status = getStockStatus(minStock, onHand);
  const text = status === "low" ? "低于最低库存" : status === "untracked" ? "未设最低库存" : "正常";
  return active ? text : `已停用；${text}`;
}

/** 库存快照 CSV。常用技术参数各占一列，其余键放进「其余参数」JSON。 */
export function inventorySnapshotCsv(state: InventoryState): string {
  const materials = state.materials.slice().sort((a, b) => a.sku.localeCompare(b.sku));
  const specKeys = flattenedSpecKeys(materials);
  const header = [
    "SKU",
    "中文名",
    "英文名",
    "类别",
    "单位",
    "库位",
    "最低库存",
    "当前库存",
    "状态",
    "建议补货量",
    "最低供应商",
    "对方货号",
    "对方品名",
    "未含GST价格",
    "备注",
    ...uniqueSpecHeaders(specKeys),
    "其余参数",
  ];
  const stockedIds = stockedMaterialIds(state);
  const rows = materials.map((material) => {
    const stocked = stockedIds.has(material.id);
    const onHand = getOnHand(state, material.id);
    const shortfall = toCents(material.minStock) - toCents(onHand);
    // 没入过库的目录货不算缺货，建议补货量记 0。
    const suggested = stocked && shortfall > 0 ? fromCents(shortfall) : 0;
    const [nameZh, nameEn] = materialNames(material);
    return [
      material.sku,
      nameZh,
      nameEn,
      categoryPath(state.categories, material.categoryId),
      getUnit(material.unit).label,
      locationText(material.location),
      formatQty(material.minStock),
      formatQty(onHand),
      statusText(material.minStock, onHand, material.active, stocked),
      formatQty(Math.max(0, suggested)),
      ...cheapestText(state, material.id),
      material.note,
      ...specCsvCells(material.specs, specKeys),
    ];
  });
  return toCsv([header, ...rows]);
}

/** 全部流水 CSV（按时间顺序，前后数量用重算结果）。 */
export function movementsCsv(state: InventoryState): string {
  const header = [
    "时间（墨尔本）",
    "类型",
    "SKU",
    "中文名",
    "英文名",
    "单位",
    "数量",
    "变动前",
    "变动后",
    "操作人",
    "工单号",
    "领用人",
    "供应商",
    "参考单号",
    "备注",
  ];
  const materials = new Map(state.materials.map((m) => [m.id, m]));
  const rows = withDerivedBalances(state).map((movement) => {
    const material = materials.get(movement.materialId);
    return [
      formatMelbourneTime(movement.at),
      movementTypeLabel(movement.type),
      material?.sku ?? "",
      material?.nameZh ?? "",
      material?.nameEn ?? "",
      material ? getUnit(material.unit).label : "",
      formatQty(movement.quantity),
      formatQty(movement.derivedBefore),
      formatQty(movement.derivedAfter),
      movement.operator,
      movement.jobNumber,
      movement.recipient,
      movement.supplierId ? supplierName(state.suppliers, movement.supplierId) : "",
      movement.reference,
      movement.notes,
    ];
  });
  return toCsv([header, ...rows]);
}

/** 待补货建议 CSV。 */
export function reorderCsv(state: InventoryState): string {
  const header = [
    "SKU",
    "中文名",
    "英文名",
    "类别",
    "单位",
    "库位",
    "当前库存",
    "最低库存",
    "建议补货量",
    "最低供应商",
    "对方货号",
    "对方品名",
    "未含GST价格",
    "说明",
  ];
  const explanation = "仅建议，未发送采购单。建议量=最低库存-当前库存。试用规则，未经业务访谈确认。价格是目录里的未含 GST 最低报价。";
  const rows = getReorderSuggestions(state).map((item) => [
    item.material.sku,
    item.material.nameZh,
    item.material.nameEn,
    categoryPath(state.categories, item.material.categoryId),
    getUnit(item.material.unit).label,
    locationText(item.material.location),
    formatQty(item.onHand),
    formatQty(item.material.minStock),
    formatQty(item.suggested),
    ...cheapestText(state, item.material.id),
    explanation,
  ]);
  return toCsv([header, ...rows]);
}

/** 在浏览器里触发下载。 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
