import type { UnitCode } from "./units";

export type MovementType = "receipt" | "issue" | "return";

export interface Category {
  id: string;
  nameZh: string;
  nameEn: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface Material {
  id: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  categoryId: string;
  unit: UnitCode;
  location: string;
  minStock: number;
  active: boolean;
  note: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  notes: string;
  updatedAt: string;
}

/** 某供应商对某内部物料的一条报价。货号在同一供应商下也可以重复。 */
export interface SupplierProduct {
  id: string;
  materialId: string;
  supplierId: string;
  supplierCode: string;
  supplierProductName: string;
  priceExGst: number;
  currency: "AUD";
  notes: string;
  updatedAt: string;
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
  /** 只有入库会填。空字符串表示没选供应商。 */
  supplierId: string;
  reference: string;
  notes: string;
}

/** 流水 + 根据全部流水重新推算出的前后数量。 */
export interface DerivedMovement extends Movement {
  derivedBefore: number;
  derivedAfter: number;
}

export interface InventoryState {
  categories: Category[];
  materials: Material[];
  suppliers: Supplier[];
  supplierProducts: SupplierProduct[];
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
  supplierId: string;
  reference: string;
  notes: string;
}

/** 物料表单的原始输入。 */
export interface MaterialDraft {
  sku: string;
  nameZh: string;
  nameEn: string;
  categoryId: string;
  unit: string;
  location: string;
  minStock: string;
  active: boolean;
  note: string;
}

export interface CategoryDraft {
  nameZh: string;
  nameEn: string;
  /** "root" 表示顶级。 */
  parentId: string;
  sortOrder: string;
}

export interface SupplierDraft {
  name: string;
  contact: string;
  notes: string;
}

/** 物料对话框里正在编辑的一条报价。price 仍是字符串。 */
export interface SupplierOfferDraft {
  /** 已保存的行有 id；新行只有本地 key。 */
  id?: string;
  key: string;
  supplierId: string;
  supplierCode: string;
  supplierProductName: string;
  price: string;
  notes: string;
}

export interface SupplierOfferInput {
  id?: string;
  supplierId: string;
  supplierCode: string;
  supplierProductName: string;
  priceExGst: number;
  notes: string;
}

export type MovementErrors = Partial<Record<keyof MovementDraft | "form", string>>;
export type MaterialErrors = Partial<Record<keyof MaterialDraft | "form" | "offers", string>>;
export type CategoryErrors = Partial<Record<keyof CategoryDraft | "form", string>>;
export type SupplierErrors = Partial<Record<keyof SupplierDraft | "form", string>>;

export type StockStatus = "untracked" | "low" | "ok";

export interface ReorderSuggestion {
  material: Material;
  onHand: number;
  suggested: number;
}
