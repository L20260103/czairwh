import type { Material } from "@/lib/inventory/types";

/** 仓库平面上的一个货位。`col` 为空是中间小货架。 */
export interface StorageLocation {
  code: string;
  zone: string;
  bay: string;
  col: number | null;
  level: number;
  sort: number;
  notes: string;
}

/** 物料放在某个货位上的一条记录。同一物料可以占多个货位。 */
export interface MaterialPlacement {
  id: string;
  materialId: string;
  locationCode: string;
  /** 这个货位上的数量，单位跟物料自己的单位。 */
  quantity: number;
  notes: string;
  createdAt: string;
}

export function materialMatchesQuery(material: Pick<Material, "sku" | "nameZh" | "nameEn">, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return [material.sku, material.nameZh, material.nameEn].some((value) => value.toLowerCase().includes(needle));
}

export function placementsByCode(placements: MaterialPlacement[]): Map<string, MaterialPlacement[]> {
  const map = new Map<string, MaterialPlacement[]>();
  for (const placement of placements) {
    const list = map.get(placement.locationCode);
    if (list) list.push(placement);
    else map.set(placement.locationCode, [placement]);
  }
  return map;
}

/** 第 3 层在前，方便正面图从上往下画。 */
export function levelsDescending(cells: StorageLocation[]): number[] {
  return [...new Set(cells.map((cell) => cell.level))].sort((a, b) => b - a);
}

/** 有列号时从左到右；小货架没有列，返回 `[null]`。 */
export function columnKeys(cells: StorageLocation[]): Array<number | null> {
  const cols = new Set<number>();
  let missing = false;
  for (const cell of cells) {
    if (cell.col == null) missing = true;
    else cols.add(cell.col);
  }
  if (cols.size === 0) return missing ? [null] : [];
  return [...cols].sort((a, b) => a - b);
}

export function cellAt(cells: StorageLocation[], col: number | null, level: number): StorageLocation | undefined {
  return cells.find((cell) => cell.col === col && cell.level === level);
}
