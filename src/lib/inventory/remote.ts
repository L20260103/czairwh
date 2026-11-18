import { MAX_LENGTH } from "@/lib/inventory/inventory";
import type {
  Category,
  InventoryState,
  Material,
  Movement,
  MovementType,
  Supplier,
  SupplierProduct,
} from "@/lib/inventory/types";
import { isUnitCode } from "@/lib/inventory/units";
import { supabase } from "@/lib/supabase/client";

const MATERIAL_COLUMNS = "id, sku, name_zh, name_en, category_id, unit, location, min_stock, active, note, created_at";
const MOVEMENT_COLUMNS =
  "id, at, type, material_id, quantity, before_qty, after_qty, operator, job_number, recipient, supplier_id, reference, notes";
const CATEGORY_COLUMNS = "id, name_zh, name_en, parent_id, sort_order, created_at";
const SUPPLIER_COLUMNS = "id, name, contact, notes, updated_at";
const OFFER_COLUMNS =
  "id, material_id, supplier_id, supplier_code, supplier_product_name, price_ex_gst, currency, notes, updated_at";

type DbError = { message: string; code?: string };

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error(`共享库存里有一条无法识别的${label}。`);
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`共享库存里的${label}无效。`);
  return value;
}

function asText(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`共享库存里的${label}无效。`);
  return value;
}

function asOptionalString(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error("共享库存里有一条文本字段无法识别。");
  return value;
}

/**
 * 库位可以不填。null 和空字符串都是未填写。
 * 只拒绝不是文本，或超过 40 字。空字符串不再报「库位无效」。
 */
export function readStoredLocation(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > MAX_LENGTH.location) {
    throw new Error("共享库存里的库位无效。");
  }
  return value.trim().replace(/\s+/g, " ");
}

function asNumber(value: unknown, label: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) throw new Error(`共享库存里的${label}无效。`);
  return number;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`共享库存里的${label}无效。`);
  return value;
}

function asMovementType(value: unknown): MovementType {
  if (value === "receipt" || value === "issue" || value === "return") return value;
  throw new Error("共享库存里有一条流水类型无法识别。");
}

function mapCategory(value: unknown): Category {
  const row = asRecord(value, "类别");
  const parent = row.parent_id;
  const nameZh = asText(row.name_zh, "类别中文名");
  const nameEn = asText(row.name_en, "类别英文名");
  if (!nameZh.trim() && !nameEn.trim()) throw new Error("共享库存里有一条没有名称的类别。");
  return {
    id: asString(row.id, "类别"),
    nameZh,
    nameEn,
    parentId: parent == null ? null : asString(parent, "上级类别"),
    sortOrder: asNumber(row.sort_order, "类别排序"),
    createdAt: asString(row.created_at, "类别时间"),
  };
}

function mapMaterial(value: unknown): Material {
  const row = asRecord(value, "物料");
  const unit = asString(row.unit, "单位");
  if (!isUnitCode(unit)) throw new Error(`共享库存里有无法识别的单位「${unit}」。`);
  const nameZh = asText(row.name_zh, "物料中文名");
  const nameEn = asText(row.name_en, "物料英文名");
  if (!nameZh.trim() && !nameEn.trim()) throw new Error("共享库存里有一条没有名称的物料。");
  return {
    id: asString(row.id, "物料"),
    sku: asString(row.sku, "SKU"),
    nameZh,
    nameEn,
    categoryId: asString(row.category_id, "类别"),
    unit,
    location: readStoredLocation(row.location),
    minStock: asNumber(row.min_stock, "最低库存"),
    active: asBoolean(row.active, "启用状态"),
    note: asOptionalString(row.note),
    createdAt: asString(row.created_at, "物料时间"),
  };
}

function mapSupplier(value: unknown): Supplier {
  const row = asRecord(value, "供应商");
  return {
    id: asString(row.id, "供应商"),
    name: asString(row.name, "供应商名称"),
    contact: asOptionalString(row.contact),
    notes: asOptionalString(row.notes),
    updatedAt: asString(row.updated_at, "供应商时间"),
  };
}

function mapOffer(value: unknown): SupplierProduct {
  const row = asRecord(value, "报价");
  const currency = asString(row.currency, "币种");
  if (currency !== "AUD") throw new Error(`报价币种只支持 AUD，读到了「${currency}」。`);
  return {
    id: asString(row.id, "报价"),
    materialId: asString(row.material_id, "报价物料"),
    supplierId: asString(row.supplier_id, "报价供应商"),
    supplierCode: asOptionalString(row.supplier_code),
    supplierProductName: asString(row.supplier_product_name, "对方品名"),
    priceExGst: asNumber(row.price_ex_gst, "未含 GST 价格"),
    currency: "AUD",
    notes: asOptionalString(row.notes),
    updatedAt: asString(row.updated_at, "报价时间"),
  };
}

function mapMovement(value: unknown): Movement {
  const row = asRecord(value, "流水");
  return {
    id: asString(row.id, "流水"),
    at: asString(row.at, "流水时间"),
    type: asMovementType(row.type),
    materialId: asString(row.material_id, "流水物料"),
    quantity: asNumber(row.quantity, "数量"),
    beforeQty: asNumber(row.before_qty, "变动前数量"),
    afterQty: asNumber(row.after_qty, "变动后数量"),
    operator: asString(row.operator, "操作人"),
    jobNumber: asOptionalString(row.job_number),
    recipient: asOptionalString(row.recipient),
    supplierId: row.supplier_id == null ? "" : asString(row.supplier_id, "供应商"),
    reference: asOptionalString(row.reference),
    notes: asOptionalString(row.notes),
  };
}

export type RemoteFailure = { ok: false; error: string; code?: string };

function failure(error: DbError, fallback: string): RemoteFailure {
  const message = error.message?.trim();
  if (error.code === "23505" || message.includes("duplicate key")) {
    if (message.includes("materials_sku")) return { ok: false, error: "SKU 已存在。", code: error.code };
    if (message.includes("suppliers_name")) return { ok: false, error: "已经有同名供应商。", code: error.code };
    if (message.includes("supplier_products_identity")) {
      return { ok: false, error: "同一供应商下，相同货号和对方品名的报价已存在。", code: error.code };
    }
    if (message.includes("categories_")) return { ok: false, error: "同级已有同名类别。", code: error.code };
  }
  if (error.code === "23503") return { ok: false, error: "还有关联记录，不能这样改。", code: error.code };
  return { ok: false, error: message ? `${fallback}（${message}）` : fallback, code: error.code };
}

export async function loadRemoteState(): Promise<{ ok: true; state: InventoryState } | RemoteFailure> {
  const [categories, materials, suppliers, offers, movements, setting] = await Promise.all([
    supabase.from("categories").select(CATEGORY_COLUMNS).order("sort_order").order("name_zh").order("name_en"),
    supabase.from("materials").select(MATERIAL_COLUMNS).order("sku"),
    supabase.from("suppliers").select(SUPPLIER_COLUMNS).order("name"),
    supabase.from("supplier_products").select(OFFER_COLUMNS).order("supplier_product_name"),
    supabase.from("stock_movements").select(MOVEMENT_COLUMNS).order("at").order("id"),
    supabase.from("app_settings").select("setting_key, setting_value").eq("setting_key", "last_operator").maybeSingle(),
  ]);
  const firstError = categories.error ?? materials.error ?? suppliers.error ?? offers.error ?? movements.error ?? setting.error;
  if (firstError) return failure(firstError, "没能读取共享库存");
  try {
    const last = setting.data as { setting_value?: unknown } | null;
    return {
      ok: true,
      state: {
        categories: (categories.data ?? []).map(mapCategory),
        materials: (materials.data ?? []).map(mapMaterial),
        suppliers: (suppliers.data ?? []).map(mapSupplier),
        supplierProducts: (offers.data ?? []).map(mapOffer),
        movements: (movements.data ?? []).map(mapMovement),
        lastOperator: typeof last?.setting_value === "string" ? last.setting_value : "",
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "共享库存里的数据无法识别。" };
  }
}

function materialRow(material: Material) {
  return {
    id: material.id,
    sku: material.sku,
    name_zh: material.nameZh,
    name_en: material.nameEn,
    category_id: material.categoryId,
    unit: material.unit,
    location: typeof material.location === "string" ? material.location.trim().replace(/\s+/g, " ") : "",
    min_stock: material.minStock,
    active: material.active,
    note: material.note,
    created_at: material.createdAt,
  };
}

export async function insertMaterial(material: Material): Promise<{ ok: true; material: Material } | RemoteFailure> {
  const { data, error } = await supabase.from("materials").insert(materialRow(material)).select(MATERIAL_COLUMNS).single();
  if (error) return failure(error, "没能保存物料");
  try {
    return { ok: true, material: mapMaterial(data) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "保存物料后的返回数据无法识别。" };
  }
}

export async function updateMaterial(material: Material): Promise<{ ok: true; material: Material } | RemoteFailure> {
  const row = materialRow(material);
  const { id, created_at: createdAt, ...changes } = row;
  const { data, error } = await supabase.from("materials").update(changes).eq("id", id).select(MATERIAL_COLUMNS).single();
  if (error) return failure(error, "没能保存物料");
  void createdAt;
  try {
    return { ok: true, material: mapMaterial(data) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "保存物料后的返回数据无法识别。" };
  }
}

export async function deleteMaterial(id: string): Promise<{ ok: true } | RemoteFailure> {
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) return failure(error, "没能删除物料");
  return { ok: true };
}

export async function insertMovement(movement: Movement): Promise<{ ok: true } | RemoteFailure> {
  const { error } = await supabase.from("stock_movements").insert({
    id: movement.id,
    at: movement.at,
    type: movement.type,
    material_id: movement.materialId,
    quantity: movement.quantity,
    before_qty: movement.beforeQty,
    after_qty: movement.afterQty,
    operator: movement.operator,
    job_number: movement.jobNumber,
    recipient: movement.recipient,
    supplier_id: movement.supplierId || null,
    reference: movement.reference,
    notes: movement.notes,
  });
  if (error) return failure(error, "没能记下这笔流水");
  return { ok: true };
}

export async function rememberOperator(operator: string): Promise<{ ok: true } | RemoteFailure> {
  const { error } = await supabase.from("app_settings").upsert(
    { setting_key: "last_operator", setting_value: operator, updated_at: new Date().toISOString() },
    { onConflict: "setting_key" },
  );
  if (error) return failure(error, "没能记住操作人");
  return { ok: true };
}

export async function insertCategory(category: Category): Promise<{ ok: true; category: Category } | RemoteFailure> {
  const { data, error } = await supabase
    .from("categories")
    .insert({
      id: category.id,
      name_zh: category.nameZh,
      name_en: category.nameEn,
      parent_id: category.parentId,
      sort_order: category.sortOrder,
      created_at: category.createdAt,
    })
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) return failure(error, "没能保存类别");
  try {
    return { ok: true, category: mapCategory(data) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "保存类别后的返回数据无法识别。" };
  }
}

export async function updateCategory(category: Category): Promise<{ ok: true; category: Category } | RemoteFailure> {
  const { data, error } = await supabase
    .from("categories")
    .update({
      name_zh: category.nameZh,
      name_en: category.nameEn,
      parent_id: category.parentId,
      sort_order: category.sortOrder,
    })
    .eq("id", category.id)
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) return failure(error, "没能保存类别");
  try {
    return { ok: true, category: mapCategory(data) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "保存类别后的返回数据无法识别。" };
  }
}

export async function deleteCategory(id: string): Promise<{ ok: true } | RemoteFailure> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return failure(error, "没能删除类别");
  return { ok: true };
}

export async function insertSupplier(supplier: Supplier): Promise<{ ok: true; supplier: Supplier } | RemoteFailure> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      id: supplier.id,
      name: supplier.name,
      contact: supplier.contact,
      notes: supplier.notes,
      updated_at: supplier.updatedAt,
    })
    .select(SUPPLIER_COLUMNS)
    .single();
  if (error) return failure(error, "没能保存供应商");
  try {
    return { ok: true, supplier: mapSupplier(data) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "保存供应商后的返回数据无法识别。" };
  }
}

export async function updateSupplier(supplier: Supplier): Promise<{ ok: true; supplier: Supplier } | RemoteFailure> {
  const { data, error } = await supabase
    .from("suppliers")
    .update({
      name: supplier.name,
      contact: supplier.contact,
      notes: supplier.notes,
      updated_at: supplier.updatedAt,
    })
    .eq("id", supplier.id)
    .select(SUPPLIER_COLUMNS)
    .single();
  if (error) return failure(error, "没能保存供应商");
  try {
    return { ok: true, supplier: mapSupplier(data) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "保存供应商后的返回数据无法识别。" };
  }
}

export async function deleteSupplier(id: string): Promise<{ ok: true } | RemoteFailure> {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return failure(error, "没能删除供应商");
  return { ok: true };
}

export async function replaceMaterialOffers(
  materialId: string,
  offers: SupplierProduct[],
  previous: SupplierProduct[],
): Promise<{ ok: true } | RemoteFailure> {
  const nextIds = new Set(offers.map((offer) => offer.id));
  for (const existing of previous) {
    if (nextIds.has(existing.id)) continue;
    const { error } = await supabase.from("supplier_products").delete().eq("id", existing.id);
    if (error) return failure(error, "没能删除报价");
  }
  for (const offer of offers) {
    const row = {
      id: offer.id,
      material_id: materialId,
      supplier_id: offer.supplierId,
      supplier_code: offer.supplierCode,
      supplier_product_name: offer.supplierProductName,
      price_ex_gst: offer.priceExGst,
      currency: "AUD",
      notes: offer.notes,
      updated_at: offer.updatedAt,
    };
    const existed = previous.some((item) => item.id === offer.id);
    const { error } = existed
      ? await supabase.from("supplier_products").update(row).eq("id", offer.id)
      : await supabase.from("supplier_products").insert(row);
    if (error) return failure(error, "没能保存报价");
  }
  return { ok: true };
}
