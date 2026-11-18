import type { MovementType } from "@/lib/inventory/types";

/** 墨尔本时间，例如 2026/11/04 10:20。 */
export function formatMelbourneTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** 中英都有时显示「中文 English」，只有一边时显示那一边。 */
export function bilingualLabel(nameZh: string, nameEn: string): string {
  const zh = nameZh.trim();
  const en = nameEn.trim();
  if (zh && en) return `${zh} ${en}`;
  return zh || en;
}

/** 未含 GST 的澳元价格，例如 A$12.50。 */
export function formatAud(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}A$${Math.abs(value).toFixed(2)}`;
}

export function movementTypeLabel(type: MovementType): string {
  switch (type) {
    case "receipt":
      return "入库";
    case "issue":
      return "出库";
    default:
      return "退库";
  }
}

