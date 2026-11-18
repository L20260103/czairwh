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

export function originLabel(sample: boolean): string {
  return sample ? "示例数据" : "本机新增";
}
