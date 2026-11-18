import type {
  Category,
  CategoryDraft,
  CategoryErrors,
  Supplier,
  SupplierDraft,
  SupplierErrors,
  SupplierOfferDraft,
  SupplierOfferInput,
  SupplierProduct,
} from "./types";
import { bilingualLabel } from "@/lib/format";
import { normalizeText } from "./inventory";

export const MAX_PRICE = 999999.99;

const LIMITS = {
  categoryZh: 80,
  categoryEn: 120,
  supplier: 80,
  contact: 120,
  code: 80,
  productName: 120,
  notes: 200,
  sortOrder: 100_000,
};

function tooLong(value: string, max: number, label: string): string | null {
  return value.length > max ? `${label}不能超过 ${max} 个字。` : null;
}

/** 顶级在前，下级紧跟在上级后面。缺失上级的类别附在末尾。 */
export function categoriesInTreeOrder(categories: Category[]): { category: Category; depth: number }[] {
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const key = category.parentId;
    const list = byParent.get(key) ?? [];
    list.push(category);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || bilingualLabel(a.nameZh, a.nameEn).localeCompare(bilingualLabel(b.nameZh, b.nameEn), "zh"));
  }
  const seen = new Set<string>();
  const ordered: { category: Category; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const category of byParent.get(parentId) ?? []) {
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      ordered.push({ category, depth });
      walk(category.id, depth + 1);
    }
  };
  walk(null, 0);
  const pending = categories.filter((category) => !seen.has(category.id));
  pending.sort(
    (a, b) => a.sortOrder - b.sortOrder || bilingualLabel(a.nameZh, a.nameEn).localeCompare(bilingualLabel(b.nameZh, b.nameEn), "zh"),
  );
  for (const category of pending) {
    if (seen.has(category.id)) continue;
    seen.add(category.id);
    ordered.push({ category, depth: 0 });
    walk(category.id, 1);
  }
  return ordered;
}

export function categoryPath(categories: Category[], categoryId: string): string {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const names: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(categoryId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.push(bilingualLabel(current.nameZh, current.nameEn));
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.reverse().join(" / ");
}

export function descendantIds(categories: Category[], categoryId: string): Set<string> {
  const ids = new Set<string>([categoryId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of categories) {
      if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function categorySelectOptions(categories: Category[], excludeIds: Set<string> = new Set()): { value: string; label: string }[] {
  return categoriesInTreeOrder(categories)
    .filter(({ category }) => !excludeIds.has(category.id))
    .map(({ category, depth }) => ({
      value: category.id,
      label: `${depth > 0 ? `${"· ".repeat(depth)}` : ""}${bilingualLabel(category.nameZh, category.nameEn)}`,
    }));
}

type CategoryResult =
  | { ok: true; value: { nameZh: string; nameEn: string; parentId: string | null; sortOrder: number } }
  | { ok: false; errors: CategoryErrors };

function sameName(left: string, right: string): boolean {
  return left.localeCompare(right, "zh", { sensitivity: "accent" }) === 0;
}

/** 校验类别。editingId 为正在修改的类别。中英文至少填一个。 */
export function validateCategory(categories: Category[], draft: CategoryDraft, editingId: string | undefined): CategoryResult {
  const errors: CategoryErrors = {};
  const existing = editingId ? categories.find((category) => category.id === editingId) : undefined;
  if (editingId && !existing) errors.form = "找不到要修改的类别。";

  const nameZh = normalizeText(draft.nameZh);
  const nameEn = normalizeText(draft.nameEn);
  if (!nameZh && !nameEn) errors.nameZh = "中文名和英文名至少填一个。";
  const nameZhTooLong = tooLong(nameZh, LIMITS.categoryZh, "中文名");
  if (nameZhTooLong) errors.nameZh = nameZhTooLong;
  const nameEnTooLong = tooLong(nameEn, LIMITS.categoryEn, "英文名");
  if (nameEnTooLong) errors.nameEn = nameEnTooLong;

  let parentId: string | null = null;
  if (draft.parentId && draft.parentId !== "root") {
    const parent = categories.find((category) => category.id === draft.parentId);
    if (!parent) errors.parentId = "请选择有效的上级类别。";
    else if (editingId && (parent.id === editingId || descendantIds(categories, editingId).has(parent.id))) {
      errors.parentId = "不能把类别放到自己或自己的下级下面。";
    } else parentId = parent.id;
  }

  const sortText = draft.sortOrder.trim();
  let sortOrder = 0;
  if (!sortText) sortOrder = 0;
  else if (!/^-?\d+$/.test(sortText)) errors.sortOrder = "排序请填整数。";
  else {
    sortOrder = Number(sortText);
    if (sortOrder < -LIMITS.sortOrder || sortOrder > LIMITS.sortOrder) {
      errors.sortOrder = `排序要在 -${LIMITS.sortOrder} 到 ${LIMITS.sortOrder} 之间。`;
    }
  }

  if (!errors.nameZh && !errors.nameEn) {
    const siblingTaken = categories.some(
      (category) =>
        category.id !== editingId &&
        category.parentId === parentId &&
        sameName(category.nameZh, nameZh) &&
        sameName(category.nameEn, nameEn),
    );
    if (siblingTaken) errors.nameZh = "同级已有中英文都相同的类别。";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { nameZh, nameEn, parentId, sortOrder } };
}

export function categoryDeleteError(categories: Category[], materials: { categoryId: string }[], categoryId: string): string | null {
  if (!categories.some((category) => category.id === categoryId)) return "找不到类别。";
  if (categories.some((category) => category.parentId === categoryId)) return "请先删除或移走下级类别。";
  if (materials.some((material) => material.categoryId === categoryId)) return "已有物料使用这个类别，不能删除。";
  return null;
}

type SupplierResult = { ok: true; value: { name: string; contact: string; notes: string } } | { ok: false; errors: SupplierErrors };

export function validateSupplier(suppliers: Supplier[], draft: SupplierDraft, editingId: string | undefined): SupplierResult {
  const errors: SupplierErrors = {};
  if (editingId && !suppliers.some((supplier) => supplier.id === editingId)) errors.form = "找不到要修改的供应商。";

  const name = normalizeText(draft.name);
  const contact = normalizeText(draft.contact);
  const notes = normalizeText(draft.notes);
  if (!name) errors.name = "请填写供应商名称。";
  const nameTooLong = tooLong(name, LIMITS.supplier, "供应商名称");
  if (nameTooLong) errors.name = nameTooLong;
  const contactTooLong = tooLong(contact, LIMITS.contact, "联系方式");
  if (contactTooLong) errors.contact = contactTooLong;
  const notesTooLong = tooLong(notes, LIMITS.notes, "备注");
  if (notesTooLong) errors.notes = notesTooLong;
  if (
    name &&
    suppliers.some(
      (supplier) => supplier.id !== editingId && supplier.name.localeCompare(name, "zh", { sensitivity: "accent" }) === 0,
    )
  ) {
    errors.name = "已经有同名供应商。";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, contact, notes } };
}

export function supplierDeleteError(
  suppliers: Supplier[],
  products: SupplierProduct[],
  movements: { supplierId: string }[],
  supplierId: string,
): string | null {
  if (!suppliers.some((supplier) => supplier.id === supplierId)) return "找不到供应商。";
  if (movements.some((movement) => movement.supplierId === supplierId)) return "已有入库记过这个供应商，不能删除。";
  if (products.some((product) => product.supplierId === supplierId)) return "请先删掉这个供应商的报价。";
  return null;
}

/** 价格：非负，最多两位小数。 */
export function parsePrice(input: string): { ok: true; value: number } | { ok: false; error: string } {
  const text = input.trim();
  if (!text) return { ok: false, error: "请填写未含 GST 的价格。" };
  if (text.includes(",") || text.includes("，")) return { ok: false, error: "请使用小数点，不要用逗号。" };
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) return { ok: false, error: "价格最多保留 2 位小数。" };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "价格不能为负数。" };
  if (value > MAX_PRICE) return { ok: false, error: `价格不能超过 ${MAX_PRICE}。` };
  return { ok: true, value };
}

export function offerIdentity(supplierId: string, supplierCode: string, supplierProductName: string): string {
  return `${supplierId}\u0000${supplierCode}\u0000${supplierProductName.toLowerCase()}`;
}

type OfferResult = { ok: true; value: SupplierOfferInput[] } | { ok: false; error: string };

/** 校验某物料的全部报价。otherProducts 是其他物料上的报价，用来撞唯一键。 */
export function validateOffers(
  drafts: SupplierOfferDraft[],
  suppliers: Supplier[],
  otherProducts: SupplierProduct[],
): OfferResult {
  const value: SupplierOfferInput[] = [];
  const seen = new Set(otherProducts.map((product) => offerIdentity(product.supplierId, product.supplierCode, product.supplierProductName)));
  for (const draft of drafts) {
    const supplierId = draft.supplierId;
    if (!supplierId || !suppliers.some((supplier) => supplier.id === supplierId)) return { ok: false, error: "报价要选择供应商。" };
    const supplierCode = normalizeText(draft.supplierCode);
    const supplierProductName = normalizeText(draft.supplierProductName);
    const notes = normalizeText(draft.notes);
    const codeTooLong = tooLong(supplierCode, LIMITS.code, "对方货号");
    if (codeTooLong) return { ok: false, error: codeTooLong };
    if (!supplierProductName) return { ok: false, error: "请填写对方品名。" };
    const nameTooLong = tooLong(supplierProductName, LIMITS.productName, "对方品名");
    if (nameTooLong) return { ok: false, error: nameTooLong };
    const notesTooLong = tooLong(notes, LIMITS.notes, "报价备注");
    if (notesTooLong) return { ok: false, error: notesTooLong };
    const price = parsePrice(draft.price);
    if (!price.ok) return price;
    const identity = offerIdentity(supplierId, supplierCode, supplierProductName);
    if (seen.has(identity)) {
      return { ok: false, error: "同一供应商下，相同货号和对方品名的报价已存在。货号本身可以重复，但品名要能区分。" };
    }
    seen.add(identity);
    value.push({
      id: draft.id,
      supplierId,
      supplierCode,
      supplierProductName,
      priceExGst: price.value,
      notes,
    });
  }
  return { ok: true, value };
}

/** 同一物料里价格最低的报价。并列的全部返回。 */
export function cheapestOffers(products: SupplierProduct[], materialId: string): SupplierProduct[] {
  const rows = products.filter((product) => product.materialId === materialId);
  if (rows.length === 0) return [];
  const lowest = Math.min(...rows.map((product) => product.priceExGst));
  return rows.filter((product) => product.priceExGst === lowest);
}

export function supplierName(suppliers: Supplier[], supplierId: string): string {
  return suppliers.find((supplier) => supplier.id === supplierId)?.name ?? "已缺失供应商";
}
