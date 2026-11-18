import type { UnitCode } from "./units";

export type MovementType = "receipt" | "issue" | "return";

export interface Material {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: UnitCode;
  location: string;
  minStock: number;
  active: boolean;
  note: string;
  sample: boolean;
  createdAt: string;
}

export interface Movement {
  id: string;
  at: string;
  type: MovementType;
  materialId: string;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  operator: string;
  jobNumber: string;
  recipient: string;
  reference: string;
  notes: string;
  sample: boolean;
}

/** 流水 + 根据全部流水重新推算出的前后数量。 */
export interface DerivedMovement extends Movement {
  derivedBefore: number;
  derivedAfter: number;
}

export interface InventoryState {
  version: 1;
  materials: Material[];
  movements: Movement[];
  lastOperator: string;
}

/** 记账表单的原始输入（数量是字符串）。 */
export interface MovementDraft {
  type: string;
  materialId: string;
  quantity: string;
  operator: string;
  jobNumber: string;
  recipient: string;
  reference: string;
  notes: string;
}

/** 物料表单的原始输入。 */
export interface MaterialDraft {
  sku: string;
  name: string;
  category: string;
  unit: string;
  location: string;
  minStock: string;
  active: boolean;
  note: string;
}

export type MovementErrors = Partial<Record<keyof MovementDraft | "form", string>>;
export type MaterialErrors = Partial<Record<keyof MaterialDraft | "form", string>>;

export type StockStatus = "untracked" | "low" | "ok";

export interface ReorderSuggestion {
  material: Material;
  onHand: number;
  suggested: number;
}
