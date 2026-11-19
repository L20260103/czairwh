import { formatQty } from "@/lib/inventory/inventory";
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

/** 库位文本。null 和空白都当成没填，不参与搜索命中「null」。 */
export function locationText(location: string | null | undefined): string {
  if (typeof location !== "string") return "";
  return location.trim().replace(/\s+/g, " ");
}

/** 单独一格里的库位。没填时用「—」，和工单号、备注的空值一样。 */
export function displayLocation(location: string | null | undefined): string {
  return locationText(location) || "—";
}

/** 用「 · 」拼接非空片段。库位为空时不占一段；全部为空时返回「—」。 */
export function joinMeta(parts: Array<string | null | undefined>): string {
  const text = parts
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" · ");
  return text || "—";
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * 一边已经包含另一边（忽略大小写和连续空格）时，再拼一次就是重复。
 * 例如中文名里已经写了 WiFi Kit，或中英文都是 iZone。
 */
export function nameRepeats(nameZh: string, nameEn: string): boolean {
  const zh = normalizeName(nameZh);
  const en = normalizeName(nameEn);
  if (!zh || !en) return true;
  return zh.includes(en) || en.includes(zh);
}

/**
 * 纯文本用的名称。重复的英文只留一次；两边都有且互不包含时仍是「中文 English」。
 * 界面上互不包含的英文用 BilingualName 单独排成浅色第二行。
 */
export function bilingualLabel(nameZh: string, nameEn: string): string {
  const zh = nameZh.trim();
  const en = nameEn.trim();
  if (!zh) return en;
  if (!en) return zh;
  const zhKey = normalizeName(zh);
  const enKey = normalizeName(en);
  if (zhKey.includes(enKey)) return zh;
  if (enKey.includes(zhKey)) return en;
  return `${zh} ${en}`;
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

/** 记账成功提示。出入库页和目录对话框用同一句。 */
export function postedMovementSummary(movement: {
  type: MovementType;
  quantity: number;
  beforeQty: number;
  afterQty: number;
}): string {
  return `${movementTypeLabel(movement.type)}已记下：${formatQty(movement.quantity)}，库存 ${formatQty(movement.beforeQty)} → ${formatQty(movement.afterQty)}`;
}

