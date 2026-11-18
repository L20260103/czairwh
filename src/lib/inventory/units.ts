/** 计量单位。integer = true 时只能记整数。 */
export const UNITS = [
  { code: "piece", label: "个", en: "piece", integer: true },
  { code: "set", label: "套", en: "set", integer: true },
  { code: "unit", label: "台", en: "unit", integer: true },
  { code: "roll", label: "卷", en: "roll", integer: true },
  { code: "bottle", label: "瓶", en: "bottle", integer: true },
  { code: "box", label: "箱", en: "box", integer: true },
  { code: "metre", label: "米", en: "m", integer: false },
  { code: "kg", label: "千克", en: "kg", integer: false },
  { code: "litre", label: "升", en: "L", integer: false },
  { code: "sqm", label: "平方米", en: "m²", integer: false },
] as const;

export type UnitCode = (typeof UNITS)[number]["code"];
export type Unit = (typeof UNITS)[number];

const unitsByCode = new Map<string, Unit>(UNITS.map((unit) => [unit.code, unit]));

export function isUnitCode(code: string): code is UnitCode {
  return unitsByCode.has(code);
}

export function getUnit(code: string): Unit {
  const unit = unitsByCode.get(code);
  if (!unit) throw new Error(`Unknown unit ${code}`);
  return unit;
}

/** 类别建议（下拉提示）。 */
export const CATEGORY_SUGGESTIONS = [
  "铜管 Copper",
  "保温 Insulation",
  "制冷剂 Refrigerant",
  "风口 Grille",
  "过滤 Filter",
  "电气 Electrical",
  "配件 Fittings",
  "控制器 Controls",
  "排水 Drainage",
  "辅材 Consumable",
  "气体 Gas",
];

/** 库位建议（下拉提示）。 */
export const LOCATION_SUGGESTIONS = [
  "A-01 铜管架",
  "A-02 保温架",
  "A-03 配件盒",
  "A-04 管材",
  "B-01 冷媒柜",
  "B-02 气体架",
  "C-01 滤网架",
  "C-03 风口架",
  "D-01 控制器柜",
  "D-02 线材",
  "E-01 辅材",
];
