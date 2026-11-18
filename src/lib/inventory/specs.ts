/** 物料 specs jsonb 的展示、搜索和 CSV 展平。空对象表示没有技术参数。 */

export interface SpecLabel {
  primary: string;
  secondary?: string;
}

export interface SpecEntry {
  key: string;
  value: unknown;
  label: SpecLabel;
  text: string;
}

/** 编辑对话框里的一行。original 用来在没改值时保留数字等原始类型。 */
export interface SpecEditRow {
  id: string;
  key: string;
  value: string;
  originalKey: string;
  original: unknown;
}

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const SPEC_LABELS: Record<string, SpecLabel> = {
  power_supply: { primary: "电源/相位", secondary: "Power supply" },
  indoor_model: { primary: "室内机", secondary: "Indoor" },
  outdoor_model: { primary: "室外机", secondary: "Outdoor" },
  controller_model: { primary: "控制器", secondary: "Controller" },
  fascia_model: { primary: "面板", secondary: "Fascia" },
  zone_box_model: { primary: "分区箱", secondary: "Zone box" },
  kit_code: { primary: "套装编号", secondary: "Kit code" },
  system_kit_code: { primary: "系统套装", secondary: "System kit" },
  refrigerant: { primary: "冷媒", secondary: "Refrigerant" },
  cooling_kw: { primary: "制冷 kW" },
  heating_kw: { primary: "制热 kW" },
  capacity_kw: { primary: "容量 kW" },
  airflow_ls: { primary: "风量 L/s" },
  dimensions: { primary: "尺寸" },
  weight_kg: { primary: "重量 kg" },
  price_your: { primary: "Your Price" },
  veu: { primary: "VEU" },
  suits: { primary: "适用型号", secondary: "Suits" },
  option: { primary: "选配", secondary: "Option" },
  description: { primary: "说明", secondary: "Description" },
  notes: { primary: "备注", secondary: "Notes" },
  page: { primary: "价格表页码" },
  indoor_colour: { primary: "室内机颜色", secondary: "Indoor colour" },
  accessory_model: { primary: "附件型号", secondary: "Accessory" },
  type: { primary: "类型", secondary: "Type" },
  system_code: { primary: "系统编号", secondary: "System code" },
  fascia_code: { primary: "面板编号", secondary: "Fascia code" },
  model: { primary: "型号", secondary: "Model" },
  series: { primary: "系列", secondary: "Series" },
  controller: { primary: "控制器", secondary: "Controller" },
  code: { primary: "编号", secondary: "Code" },
  size: { primary: "规格", secondary: "Size" },
  flow_switch: { primary: "流量开关", secondary: "Flow switch" },
  unit_sizes: { primary: "机组尺寸", secondary: "Unit sizes" },
  gst: { primary: "GST" },
  price: { primary: "价格", secondary: "Price" },
  family_heading: { primary: "系列", secondary: "Family" },
  printed_code: { primary: "印刷编号", secondary: "Printed code" },
  spigot_pop: { primary: "接管", secondary: "Spigot" },
  supply_flange: { primary: "送风法兰", secondary: "Supply flange" },
  flange: { primary: "法兰", secondary: "Flange" },
};

/** 定义列表和 CSV 列的优先顺序。不在表里的键插在备注后面，页码和标价靠后。 */
const SPEC_ORDER = [
  "power_supply",
  "refrigerant",
  "cooling_kw",
  "heating_kw",
  "capacity_kw",
  "airflow_ls",
  "indoor_model",
  "outdoor_model",
  "controller_model",
  "fascia_model",
  "zone_box_model",
  "kit_code",
  "system_kit_code",
  "dimensions",
  "weight_kg",
  "veu",
  "suits",
  "option",
  "description",
  "notes",
  "price_your",
  "page",
];

const PRICE_PARTS: Record<string, { zh: string; en: string }> = {
  indoor: { zh: "室内机", en: "Indoor" },
  outdoor: { zh: "室外机", en: "Outdoor" },
  controller: { zh: "控制器", en: "Controller" },
  fascia: { zh: "面板", en: "Fascia" },
  zone_box: { zh: "分区箱", en: "Zone box" },
  flow_switch: { zh: "流量开关", en: "Flow switch" },
  total: { zh: "合计", en: "Total" },
};

const PRICE_PART_ORDER = ["indoor", "outdoor", "controller", "fascia", "zone_box", "flow_switch", "total"];

const WORD_LABELS: Record<string, string> = {
  sku: "SKU",
  vrv: "VRV",
  gst: "GST",
  veu: "VEU",
  r32: "R32",
  skyair: "SkyAir",
  fdyba: "FDYBA",
  id: "ID",
};

/** 固定展开成 CSV 列的键。price_*_list 和 suits_* 另按模式匹配。 */
const FLAT_EXACT = new Set([
  "power_supply",
  "indoor_model",
  "outdoor_model",
  "controller_model",
  "fascia_model",
  "zone_box_model",
  "kit_code",
  "system_kit_code",
  "refrigerant",
  "cooling_kw",
  "heating_kw",
  "capacity_kw",
  "airflow_ls",
  "dimensions",
  "weight_kg",
  "price_your",
  "veu",
  "suits",
  "option",
  "description",
  "notes",
  "page",
]);

/** null、数组和其他非对象都当成没有参数。 */
export function normalizeSpecs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const specs: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!key || BLOCKED_KEYS.has(key)) continue;
    specs[key] = entry;
  }
  return specs;
}

export function humanizeKey(key: string): string {
  return key
    .split("_")
    .filter((part) => part.length > 0)
    .map((part, index) => {
      const mapped = WORD_LABELS[part.toLowerCase()];
      if (mapped) return mapped;
      const lower = part.toLowerCase();
      if (index > 0 && (lower === "of" || lower === "for" || lower === "and")) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function isPriceListKey(key: string): boolean {
  return /^price_.+_list$/.test(key);
}

export function specLabel(key: string): SpecLabel {
  const known = SPEC_LABELS[key];
  if (known) return known;
  if (isPriceListKey(key)) return priceListLabel(key);
  if (key.startsWith("suits_")) return { primary: "适用型号", secondary: humanizeKey(key.slice("suits_".length)) };
  return { primary: humanizeKey(key) };
}

function priceListLabel(key: string): SpecLabel {
  const middle = key.slice("price_".length, -"_list".length);
  const part = PRICE_PARTS[middle];
  if (!part) return { primary: "部件标价", secondary: humanizeKey(middle) };
  return { primary: `${part.zh}标价`, secondary: `${part.en} list` };
}

function priceListRank(key: string): number {
  const middle = key.slice("price_".length, -"_list".length);
  const index = PRICE_PART_ORDER.indexOf(middle);
  return index >= 0 ? index : 50;
}

function specSortKey(key: string): [number, number, string] {
  if (key === "page") return [900, 0, ""];
  if (isPriceListKey(key)) return [800, priceListRank(key), key];
  if (key.startsWith("suits_") && key !== "suits") return [indexOfSpec("suits") * 10 + 1, 0, key];
  const index = SPEC_ORDER.indexOf(key);
  if (index >= 0) return [index * 10, 0, ""];
  return [indexOfSpec("notes") * 10 + 1, 0, key];
}

function indexOfSpec(key: string): number {
  const index = SPEC_ORDER.indexOf(key);
  return index >= 0 ? index : SPEC_ORDER.length;
}

/** 标量文本。空白字符串视为没有值。 */
export function specScalarText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function withUnit(value: string, unit: string, already: RegExp): string {
  return already.test(value) ? value : `${value} ${unit}`;
}

/** 对话框里看到的值。冷量、风量和重量补上单位。 */
export function formatSpecValue(key: string, value: unknown): string {
  const text = specScalarText(value);
  if (!text) {
    if (value && typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    }
    return "";
  }
  if (key === "cooling_kw" || key === "heating_kw" || key === "capacity_kw") return withUnit(text, "kW", /kw/i);
  if (key === "airflow_ls") return withUnit(text, "L/s", /l\s*\/\s*s/i);
  if (key === "weight_kg") return withUnit(text, "kg", /kg/i);
  return text;
}

export function visibleSpecEntries(specs: unknown): SpecEntry[] {
  const record = normalizeSpecs(specs);
  return Object.keys(record)
    .map((key) => {
      const value = record[key];
      return { key, value, label: specLabel(key), text: formatSpecValue(key, value) };
    })
    .filter((entry) => entry.text.length > 0)
    .sort((a, b) => compareSpecKeys(a.key, b.key));
}

function compareSpecKeys(a: string, b: string): number {
  const ka = specSortKey(a);
  const kb = specSortKey(b);
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]) || a.localeCompare(b);
}

function clip(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * 列表名称下面的一行。机器优先电源、冷媒、冷量和控制器。
 * 没有这些字段时才退到类型、适用型号或 Your Price。只有页码时不显示。
 */
export function specSummary(specs: unknown): string {
  const record = normalizeSpecs(specs);
  const parts: string[] = [];
  const power = specScalarText(record.power_supply);
  if (power) parts.push(power);
  const refrigerant = specScalarText(record.refrigerant);
  if (refrigerant) parts.push(refrigerant);
  const cooling = specScalarText(record.cooling_kw);
  const capacity = specScalarText(record.capacity_kw);
  const heating = specScalarText(record.heating_kw);
  if (cooling) parts.push(withUnit(cooling, "kW", /kw/i));
  else if (capacity) parts.push(withUnit(capacity, "kW", /kw/i));
  else if (heating) parts.push(`制热 ${withUnit(heating, "kW", /kw/i)}`);
  const controllerModel = specScalarText(record.controller_model);
  const controller = specScalarText(record.controller);
  if (controllerModel) parts.push(`控制器 ${controllerModel}`);
  else if (controller && controller.length <= 20) parts.push(`控制器 ${controller}`);
  if (parts.length > 0) return parts.join(" · ");

  const type = specScalarText(record.type);
  if (type) return clip(type, 72);
  const suits =
    specScalarText(record.suits) ||
    Object.keys(record)
      .filter((key) => key.startsWith("suits_"))
      .sort()
      .map((key) => specScalarText(record[key]))
      .find((text) => text.length > 0) ||
    "";
  if (suits) return clip(suits, 72);
  const description = specScalarText(record.description);
  if (description && description.length <= 42) return description;
  const price = specScalarText(record.price_your);
  if (price) return `Your Price ${price}`;
  const model = specScalarText(record.model) || specScalarText(record.accessory_model) || specScalarText(record.kit_code);
  if (model) return model;
  if (description) return clip(description, 72);
  return "";
}

/** 搜索只用参数值，不用键名。 */
export function specSearchText(specs: unknown): string {
  return Object.values(normalizeSpecs(specs))
    .map((value) => {
      const scalar = specScalarText(value);
      if (scalar) return scalar;
      if (value && typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return "";
        }
      }
      return "";
    })
    .filter((text) => text.length > 0)
    .join(" ");
}

export function isFlattenedSpecKey(key: string): boolean {
  return FLAT_EXACT.has(key) || isPriceListKey(key) || key.startsWith("suits_");
}

export function flattenedSpecKeys(materials: ReadonlyArray<{ specs?: unknown }>): string[] {
  const present = new Set<string>();
  for (const material of materials) {
    for (const [key, value] of Object.entries(normalizeSpecs(material.specs))) {
      if (!isFlattenedSpecKey(key)) continue;
      if (!specScalarText(value) && !(value && typeof value === "object")) continue;
      present.add(key);
    }
  }
  return [...present].sort(compareSpecKeys);
}

export function specColumnHeader(key: string): string {
  const label = specLabel(key);
  return label.secondary ? `${label.primary} ${label.secondary}` : label.primary;
}

export function uniqueSpecHeaders(keys: readonly string[]): string[] {
  const headers = keys.map((key) => specColumnHeader(key));
  const counts = new Map<string, number>();
  for (const header of headers) counts.set(header, (counts.get(header) ?? 0) + 1);
  return headers.map((header, index) => (counts.get(header)! > 1 ? `${header} (${keys[index]})` : header));
}

/** 没被展成独立列的参数。没有剩余时返回空字符串。 */
export function specRemainderJson(specs: unknown, flattened: readonly string[]): string {
  const record = normalizeSpecs(specs);
  const flat = new Set(flattened);
  const extra: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    if (flat.has(key)) continue;
    const value = record[key];
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    extra[key] = value;
  }
  return Object.keys(extra).length > 0 ? JSON.stringify(extra) : "";
}

export function specCsvCells(specs: unknown, columns: readonly string[]): string[] {
  const record = normalizeSpecs(specs);
  return [...columns.map((key) => specScalarText(record[key])), specRemainderJson(record, columns)];
}

export function specEditRows(specs: unknown): SpecEditRow[] {
  return visibleSpecEntries(specs).map((entry, index) => ({
    id: `spec-${index}-${entry.key}`,
    key: entry.key,
    value: editValue(entry.value),
    originalKey: entry.key,
    original: entry.value,
  }));
}

function editValue(value: unknown): string {
  const scalar = specScalarText(value);
  if (scalar || value === 0 || value === false) return scalar;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return "";
}

export function specsFromEditRows(rows: readonly SpecEditRow[]): Record<string, unknown> {
  const specs: Record<string, unknown> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key || BLOCKED_KEYS.has(key)) continue;
    const value = row.value.trim();
    if (!value) continue;
    if (row.originalKey === key && editValue(row.original) === value) {
      specs[key] = row.original;
      continue;
    }
    specs[key] = key === "page" && /^-?\d+$/.test(value) ? Number(value) : value;
  }
  return specs;
}
