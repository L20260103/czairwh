import { formatMelbourneTime, movementTypeLabel, originLabel } from "@/lib/format";
import {
  formatQty,
  fromCents,
  getOnHand,
  getReorderSuggestions,
  getStockStatus,
  toCents,
  withDerivedBalances,
} from "@/lib/inventory/inventory";
import type { InventoryState } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";

function escapeCell(value: unknown): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

function statusText(minStock: number, onHand: number, active: boolean): string {
  const status = getStockStatus(minStock, onHand);
  const text = status === "low" ? "低于最低库存" : status === "untracked" ? "未设最低库存" : "正常";
  return active ? text : `已停用；${text}`;
}

/** 库存快照 CSV。 */
export function inventorySnapshotCsv(state: InventoryState): string {
  const header = [
    "标记",
    "SKU",
    "名称",
    "类别",
    "单位",
    "库位",
    "最低库存",
    "当前库存",
    "状态",
    "建议补货量",
    "备注",
  ];
  const rows = state.materials
    .slice()
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((material) => {
      const onHand = getOnHand(state, material.id);
      const shortfall = toCents(material.minStock) - toCents(onHand);
      const suggested = shortfall > 0 ? fromCents(shortfall) : 0;
      return [
        originLabel(material.sample),
        material.sku,
        material.name,
        material.category,
        getUnit(material.unit).label,
        material.location,
        formatQty(material.minStock),
        formatQty(onHand),
        statusText(material.minStock, onHand, material.active),
        formatQty(Math.max(0, suggested)),
        material.note,
      ];
    });
  return toCsv([header, ...rows]);
}

/** 全部流水 CSV（按时间顺序，前后数量用重算结果）。 */
export function movementsCsv(state: InventoryState): string {
  const header = [
    "标记",
    "时间（墨尔本）",
    "类型",
    "SKU",
    "名称",
    "单位",
    "数量",
    "变动前",
    "变动后",
    "操作人",
    "工单号",
    "领用人",
    "参考单号",
    "备注",
  ];
  const materials = new Map(state.materials.map((m) => [m.id, m]));
  const rows = withDerivedBalances(state).map((movement) => {
    const material = materials.get(movement.materialId);
    return [
      originLabel(movement.sample),
      formatMelbourneTime(movement.at),
      movementTypeLabel(movement.type),
      material?.sku ?? "",
      material?.name ?? "",
      material ? getUnit(material.unit).label : "",
      formatQty(movement.quantity),
      formatQty(movement.derivedBefore),
      formatQty(movement.derivedAfter),
      movement.operator,
      movement.jobNumber,
      movement.recipient,
      movement.reference,
      movement.notes,
    ];
  });
  return toCsv([header, ...rows]);
}

/** 待补货建议 CSV。 */
export function reorderCsv(state: InventoryState): string {
  const header = [
    "标记",
    "SKU",
    "名称",
    "类别",
    "单位",
    "库位",
    "当前库存",
    "最低库存",
    "建议补货量",
    "说明",
  ];
  const explanation = "仅建议，未发送采购单。建议量=最低库存-当前库存。示例规则，未经业务访谈确认。";
  const rows = getReorderSuggestions(state).map((item) => [
    originLabel(item.material.sample),
    item.material.sku,
    item.material.name,
    item.material.category,
    getUnit(item.material.unit).label,
    item.material.location,
    formatQty(item.onHand),
    formatQty(item.material.minStock),
    formatQty(item.suggested),
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
