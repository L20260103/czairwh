import type {
  Category,
  DerivedMovement,
  InventoryState,
  Material,
  MaterialDraft,
  MaterialErrors,
  Movement,
  MovementDraft,
  MovementErrors,
  MovementType,
  ReorderSuggestion,
  StockStatus,
} from "./types";
import { normalizeSpecs } from "./specs";
import { getUnit, isUnitCode, type UnitCode } from "./units";

/** 数量内部按 1/100 存成整数计算，避免浮点误差。 */
export const QTY_SCALE = 100;
/** 单笔数量上限。 */
export const MAX_QUANTITY = 99999.99;
/** 30 秒内完全相同的一笔视为重复提交。 */
export const DUPLICATE_WINDOW_MS = 30_000;
/** 各文本字段的最大字数。 */
export const MAX_LENGTH = {
  sku: 32,
  nameZh: 80,
  nameEn: 120,
  location: 40,
  operator: 40,
  job: 40,
  recipient: 40,
  reference: 80,
  notes: 200,
};

export function createEmptyState(): InventoryState {
  return {
    categories: [],
    materials: [],
    suppliers: [],
    supplierProducts: [],
    movements: [],
    lastOperator: "",
  };
}

/** 数量 → 百分位整数。 */
export function toCents(value: number): number {
  return Number.isFinite(value) ? Math.round(value * QTY_SCALE) : Number.NaN;
}

/** 百分位整数 → 数量。 */
export function fromCents(cents: number): number {
  return cents / QTY_SCALE;
}

/** 显示数量：去掉多余的 0，最多两位小数。 */
export function formatQty(value: number): string {
  const cents = toCents(value);
  if (!Number.isFinite(cents)) return "—";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / QTY_SCALE);
  const frac = abs % QTY_SCALE;
  if (frac === 0) return `${sign}${whole}`;
  if (frac % 10 === 0) return `${sign}${whole}.${frac / 10}`;
  return `${sign}${whole}.${String(frac).padStart(2, "0")}`;
}

/** 去掉首尾空白，并把连续空白合并为一个空格。 */
export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** 用于比较的工单号键（忽略大小写和多余空白）。 */
export function normalizeKey(value: string): string {
  return normalizeText(value).toLowerCase();
}

/** 一笔流水对库存的影响（百分位）：出库为负。 */
export function signedCents(type: MovementType, quantity: number): number {
  const cents = toCents(quantity);
  return type === "issue" ? -cents : cents;
}

export function onHandCents(state: InventoryState, materialId: string): number {
  let total = 0;
  for (const movement of state.movements) {
    if (movement.materialId === materialId) total += signedCents(movement.type, movement.quantity);
  }
  return total;
}

/** 某物料当前库存。 */
export function getOnHand(state: InventoryState, materialId: string): number {
  return fromCents(onHandCents(state, materialId));
}

/** 一次扫完全部流水，得到每个物料的库存（百分位）。没有流水的物料不在表里。 */
export function onHandCentsByMaterial(state: InventoryState): Map<string, number> {
  const totals = new Map<string, number>();
  for (const movement of state.movements) {
    totals.set(movement.materialId, (totals.get(movement.materialId) ?? 0) + signedCents(movement.type, movement.quantity));
  }
  return totals;
}

/**
 * 至少记过一笔出入库的物料。
 * 库存后来变成 0 的仍在集合里；只有供应商目录、从没入过库的不在。
 */
export function stockedMaterialIds(state: InventoryState): Set<string> {
  const ids = new Set<string>();
  for (const movement of state.movements) ids.add(movement.materialId);
  return ids;
}

function compareByTime(a: Movement, b: Movement): number {
  const diff = Date.parse(a.at) - Date.parse(b.at);
  return diff !== 0 && Number.isFinite(diff) ? diff : a.id.localeCompare(b.id);
}

/** 按时间顺序重新推算每笔流水前后的库存。 */
export function withDerivedBalances(state: InventoryState): DerivedMovement[] {
  const sorted = state.movements.slice().sort(compareByTime);
  const running = new Map<string, number>();
  return sorted.map((movement) => {
    const before = running.get(movement.materialId) ?? 0;
    const after = before + signedCents(movement.type, movement.quantity);
    running.set(movement.materialId, after);
    return { ...movement, derivedBefore: fromCents(before), derivedAfter: fromCents(after) };
  });
}

/** 流水，最新的在前。 */
export function movementsNewestFirst(state: InventoryState): DerivedMovement[] {
  return withDerivedBalances(state).slice().reverse();
}

/** 记录的前后数量与重新推算结果不一致的笔数。 */
export function countBalanceMismatches(state: InventoryState): number {
  return withDerivedBalances(state).filter(
    (m) =>
      toCents(m.beforeQty) !== toCents(m.derivedBefore) || toCents(m.afterQty) !== toCents(m.derivedAfter),
  ).length;
}

/** 某工单某物料的出库 / 退库合计，以及还能退多少。 */
export function getJobBalance(state: InventoryState, materialId: string, jobNumber: string) {
  const key = normalizeKey(jobNumber);
  let issued = 0;
  let returned = 0;
  if (!key) return { issued: 0, returned: 0, returnable: 0 };
  for (const movement of state.movements) {
    if (movement.materialId !== materialId || normalizeKey(movement.jobNumber) !== key) continue;
    if (movement.type === "issue") issued += toCents(movement.quantity);
    if (movement.type === "return") returned += toCents(movement.quantity);
  }
  return {
    issued: fromCents(issued),
    returned: fromCents(returned),
    returnable: fromCents(Math.max(0, issued - returned)),
  };
}

export function getStockStatus(minStock: number, onHand: number): StockStatus {
  if (toCents(minStock) <= 0) return "untracked";
  return toCents(onHand) < toCents(minStock) ? "low" : "ok";
}

/** 顶级耗材类别。中文名或英文名对上一个即可，不要求两个都写。 */
export const CONSUMABLES_ROOT_NAME_ZH = "安装耗材";
export const CONSUMABLES_ROOT_NAME_EN = "Installation Consumables";

function isConsumablesRoot(category: Category): boolean {
  if (category.parentId != null) return false;
  const nameZh = normalizeText(category.nameZh);
  const nameEn = normalizeText(category.nameEn);
  return nameZh === CONSUMABLES_ROOT_NAME_ZH || nameEn === CONSUMABLES_ROOT_NAME_EN;
}

/**
 * 需要低库存 / 补货提醒的类别。
 * 按 name_zh「安装耗材」或 name_en「Installation Consumables」找到顶级根，
 * 再从每个类别沿 parent_id 往上走；能走到这个根的（含根自己）都算。
 * 不按固定个数截断。找不到根时返回空集，任何物料都不提醒。
 */
export function consumableCategoryIds(categories: Category[]): Set<string> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const ids = new Set<string>();
  for (const start of categories) {
    const seen = new Set<string>();
    let current: Category | undefined = start;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (isConsumablesRoot(current)) {
        for (const id of seen) ids.add(id);
        break;
      }
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return ids;
}

/**
 * 建议补到最低库存的数量。
 * 没入过库，或不在安装耗材子树里，一律是 0：不算缺货。
 * 最低库存为 0 的也不补。
 */
export function reorderShortfall(minStock: number, onHand: number, stocked: boolean, consumable: boolean): number {
  if (!stocked || !consumable || toCents(minStock) <= 0) return 0;
  const shortfall = toCents(minStock) - toCents(onHand);
  return shortfall > 0 ? fromCents(shortfall) : 0;
}

/**
 * 低于最低库存、至少有过一笔流水、并且类别属于「安装耗材」或其下级的物料。
 * 按缺口比例排序，并给出建议补货量。
 * 没入过库的目录货，以及机器、风管、风口等非耗材，不算缺货，也不建议补货。
 */
export function getReorderSuggestions(state: InventoryState): ReorderSuggestion[] {
  const totals = onHandCentsByMaterial(state);
  const consumableIds = consumableCategoryIds(state.categories);
  return state.materials
    .map((material) => {
      const cents = totals.get(material.id);
      const onHand = fromCents(cents ?? 0);
      const suggested = reorderShortfall(
        material.minStock,
        onHand,
        cents !== undefined,
        consumableIds.has(material.categoryId),
      );
      if (suggested <= 0) return null;
      return { material, onHand, suggested };
    })
    .filter((item): item is ReorderSuggestion => item !== null)
    .sort((a, b) => {
      const ratioA = toCents(a.onHand) / toCents(a.material.minStock);
      const ratioB = toCents(b.onHand) / toCents(b.material.minStock);
      return ratioA !== ratioB ? ratioA - ratioB : a.material.sku.localeCompare(b.material.sku);
    });
}

export function hasMovements(state: InventoryState, materialId: string): boolean {
  return state.movements.some((m) => m.materialId === materialId);
}

type ParseResult = { ok: true; value: number } | { ok: false; error: string };

/** 解析数量输入。mode = "minimum" 时允许 0（最低库存）。 */
export function parseQuantity(input: string, unitCode: string, mode: "minimum" | "movement"): ParseResult {
  const unit = getUnit(unitCode);
  const text = input.trim();
  const isMinimum = mode === "minimum";
  if (!text) {
    return { ok: false, error: isMinimum ? "请填写最低库存。暂时不监控时填 0。" : "请填写数量。" };
  }
  if (text.includes(",") || text.includes("，")) {
    return { ok: false, error: "请使用小数点，例如 2.5，不要用逗号。" };
  }
  if (!/^[0-9.]+$/.test(text)) {
    return { ok: false, error: "数量只能包含数字和小数点。" };
  }
  const pattern = unit.integer ? /^(?:0|[1-9]\d*)$/ : /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
  if (!pattern.test(text)) {
    return {
      ok: false,
      error: unit.integer ? `单位「${unit.label}」只接受整数。` : `单位「${unit.label}」最多保留 2 位小数。`,
    };
  }
  const value = fromCents(toCents(Number(text)));
  if (!Number.isFinite(value)) return { ok: false, error: "数量无效。" };
  if (value < 0) return { ok: false, error: "数量不能为负数。" };
  if (value === 0) return isMinimum ? { ok: true, value: 0 } : { ok: false, error: "数量必须大于 0。" };
  if (value > MAX_QUANTITY) return { ok: false, error: `单笔数量不能超过 ${formatQty(MAX_QUANTITY)}。` };
  return { ok: true, value };
}

function tooLong(value: string, max: number, label: string): string | null {
  return value.length > max ? `${label}不能超过 ${max} 个字。` : null;
}

interface NormalizedMovement {
  type: MovementType;
  materialId: string;
  quantity: number;
  operator: string;
  jobNumber: string;
  recipient: string;
  supplierId: string;
  reference: string;
  notes: string;
}

/** 用于判断“重复提交”的指纹。 */
function movementFingerprint(m: NormalizedMovement): string {
  return [
    m.type,
    m.materialId,
    toCents(m.quantity),
    m.operator.toLowerCase(),
    normalizeKey(m.jobNumber),
    m.recipient.toLowerCase(),
    m.supplierId,
    m.reference.toLowerCase(),
    m.notes.toLowerCase(),
  ].join("|");
}

type ValidateMovementResult =
  | { ok: true; value: NormalizedMovement & { before: number; after: number } }
  | { ok: false; errors: MovementErrors };

/** 校验一笔入库 / 出库 / 退库。 */
export function validateMovement(
  state: InventoryState,
  draft: MovementDraft,
  at: string,
): ValidateMovementResult {
  const errors: MovementErrors = {};
  const type = draft.type;
  if (type !== "receipt" && type !== "issue" && type !== "return") errors.type = "请选择入库、出库或退库。";

  const material = state.materials.find((m) => m.id === draft.materialId);
  if (!draft.materialId || !material) errors.materialId = "请选择物料。";
  else if (!material.active) errors.materialId = "该物料已停用，不能再记账。";

  let quantity = 0;
  if (material && !errors.materialId) {
    const parsed = parseQuantity(draft.quantity, material.unit, "movement");
    if (parsed.ok) quantity = parsed.value;
    else errors.quantity = parsed.error;
  } else if (!draft.quantity.trim()) {
    errors.quantity = "请填写数量。";
  }

  const operator = normalizeText(draft.operator);
  const jobNumber = type === "receipt" ? "" : normalizeText(draft.jobNumber);
  const recipient = type === "receipt" ? "" : normalizeText(draft.recipient);
  const supplierId = type === "receipt" ? draft.supplierId.trim() : "";
  const reference = normalizeText(draft.reference);
  const notes = normalizeText(draft.notes);

  if (supplierId && !state.suppliers.some((supplier) => supplier.id === supplierId)) {
    errors.supplierId = "请选择有效的供应商。";
  }

  if (!operator) errors.operator = "请填写操作人。";
  const operatorTooLong = tooLong(operator, MAX_LENGTH.operator, "操作人");
  if (operatorTooLong) errors.operator = operatorTooLong;

  if ((type === "issue" || type === "return") && !jobNumber) {
    errors.jobNumber = type === "issue" ? "出库必须填写工单号。" : "退库必须填写工单号。";
  }
  const jobTooLong = tooLong(jobNumber, MAX_LENGTH.job, "工单号");
  if (jobTooLong) errors.jobNumber = jobTooLong;

  if (type === "issue" && !recipient) errors.recipient = "出库必须填写领用人。";
  const recipientTooLong = tooLong(recipient, MAX_LENGTH.recipient, "领用人");
  if (recipientTooLong) errors.recipient = recipientTooLong;

  const referenceTooLong = tooLong(reference, MAX_LENGTH.reference, "参考单号");
  if (referenceTooLong) errors.reference = referenceTooLong;

  const notesTooLong = tooLong(notes, MAX_LENGTH.notes, "备注");
  if (notesTooLong) errors.notes = notesTooLong;

  if (material && !errors.quantity && quantity > 0) {
    const current = onHandCents(state, material.id);
    if (type === "issue" && toCents(quantity) > current) {
      const unit = getUnit(material.unit);
      errors.quantity = `库存不足。当前 ${formatQty(fromCents(current))} ${unit.label}，不能出库 ${formatQty(quantity)} ${unit.label}。`;
    }
    if (type === "return" && jobNumber && !errors.jobNumber) {
      const job = getJobBalance(state, material.id, jobNumber);
      if (toCents(job.issued) === 0) {
        errors.jobNumber = "该工单没有此物料的出库记录，不能退库。";
      } else if (toCents(quantity) > toCents(job.returnable)) {
        const unit = getUnit(material.unit);
        errors.quantity = `退库超过该工单领用。还可退 ${formatQty(job.returnable)} ${unit.label}（已出库 ${formatQty(job.issued)}，已退 ${formatQty(job.returned)}）。`;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const normalized: NormalizedMovement = {
    type: type as MovementType,
    materialId: material!.id,
    quantity,
    operator,
    jobNumber,
    recipient,
    supplierId,
    reference,
    notes,
  };
  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs)) return { ok: false, errors: { form: "记账时间无效。" } };

  const fingerprint = movementFingerprint(normalized);
  const isDuplicate = state.movements.some((existing) => {
    const existingMs = Date.parse(existing.at);
    if (!Number.isFinite(existingMs) || Math.abs(atMs - existingMs) > DUPLICATE_WINDOW_MS) return false;
    return movementFingerprint(existing) === fingerprint;
  });
  if (isDuplicate) {
    return {
      ok: false,
      errors: { form: "这与刚刚记的一笔完全相同。若确实要再记，请等几秒，或在备注里写明原因。" },
    };
  }

  const before = onHandCents(state, normalized.materialId);
  const after = before + signedCents(normalized.type, normalized.quantity);
  return { ok: true, value: { ...normalized, before: fromCents(before), after: fromCents(after) } };
}

export type PostMovementResult =
  { ok: true; movement: Movement; state: InventoryState } | { ok: false; errors: MovementErrors };

/** 校验并记一笔流水，返回新的状态。 */
export function postMovement(
  state: InventoryState,
  draft: MovementDraft,
  meta: { id: string; at: string },
): PostMovementResult {
  const result = validateMovement(state, draft, meta.at);
  if (!result.ok) return result;
  const v = result.value;
  const movement: Movement = {
    id: meta.id,
    at: meta.at,
    type: v.type,
    materialId: v.materialId,
    quantity: v.quantity,
    beforeQty: v.before,
    afterQty: v.after,
    operator: v.operator,
    jobNumber: v.jobNumber,
    recipient: v.recipient,
    supplierId: v.supplierId,
    reference: v.reference,
    notes: v.notes,
  };
  return {
    ok: true,
    movement,
    state: { ...state, lastOperator: v.operator, movements: [...state.movements, movement] },
  };
}

function normalizeSku(value: string): string {
  return normalizeText(value).toUpperCase();
}

type MaterialFields = Omit<Material, "id" | "createdAt">;

type ValidateMaterialResult = { ok: true; value: MaterialFields } | { ok: false; errors: MaterialErrors };

/** 校验物料表单。editingId 为要修改的物料，新建时为 undefined。 */
export function validateMaterial(
  state: InventoryState,
  draft: MaterialDraft,
  editingId: string | undefined,
): ValidateMaterialResult {
  const errors: MaterialErrors = {};
  const existing = editingId ? state.materials.find((m) => m.id === editingId) : undefined;
  if (editingId && !existing) errors.form = "找不到要修改的物料。";

  const sku = normalizeSku(draft.sku);
  if (!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(sku)) {
    errors.sku = "SKU 使用字母、数字和连字符，2 到 32 位。";
  } else if (state.materials.some((m) => m.sku.toUpperCase() === sku && m.id !== editingId)) {
    errors.sku = "SKU 已存在。";
  }

  const nameZh = normalizeText(draft.nameZh);
  const nameEn = normalizeText(draft.nameEn);
  const location = normalizeText(typeof draft.location === "string" ? draft.location : "");
  const note = normalizeText(draft.note);
  const categoryId = draft.categoryId.trim();

  if (!nameZh && !nameEn) errors.nameZh = "中文名和英文名至少填一个。";
  const nameZhTooLong = tooLong(nameZh, MAX_LENGTH.nameZh, "中文名");
  if (nameZhTooLong) errors.nameZh = nameZhTooLong;
  const nameEnTooLong = tooLong(nameEn, MAX_LENGTH.nameEn, "英文名");
  if (nameEnTooLong) errors.nameEn = nameEnTooLong;

  if (!categoryId || categoryId === "none") errors.categoryId = "请选择类别。";
  else if (!state.categories.some((category) => category.id === categoryId)) errors.categoryId = "请选择有效的类别。";

  const locationTooLong = tooLong(location, MAX_LENGTH.location, "库位");
  if (locationTooLong) errors.location = locationTooLong;

  const noteTooLong = tooLong(note, MAX_LENGTH.notes, "备注");
  if (noteTooLong) errors.note = noteTooLong;

  if (!isUnitCode(draft.unit)) errors.unit = "请选择单位。";

  let minStock = 0;
  if (isUnitCode(draft.unit)) {
    const parsed = parseQuantity(draft.minStock, draft.unit, "minimum");
    if (parsed.ok) minStock = parsed.value;
    else errors.minStock = parsed.error;
  } else if (!draft.minStock.trim()) {
    errors.minStock = "请填写最低库存。暂时不监控时填 0。";
  }

  if (
    existing &&
    isUnitCode(draft.unit) &&
    existing.unit !== draft.unit &&
    hasMovements(state, existing.id)
  ) {
    errors.unit = "已有流水，不能修改单位。";
  }
  if (existing && sku !== existing.sku && hasMovements(state, existing.id)) {
    errors.sku = "已有流水，不能修改 SKU。";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      sku,
      nameZh,
      nameEn,
      categoryId,
      unit: draft.unit as UnitCode,
      location,
      minStock,
      active: draft.active,
      note,
      specs: normalizeSpecs(draft.specs),
    },
  };
}

export type SaveMaterialResult =
  { ok: true; material: Material; state: InventoryState } | { ok: false; errors: MaterialErrors };

/** 新建或修改物料。 */
export function saveMaterial(
  state: InventoryState,
  draft: MaterialDraft,
  meta: { id: string; now: string },
): SaveMaterialResult {
  const existing = state.materials.find((m) => m.id === meta.id);
  const result = validateMaterial(state, draft, existing ? meta.id : undefined);
  if (!result.ok) return result;
  const material: Material = existing
    ? { ...existing, ...result.value }
    : { id: meta.id, ...result.value, createdAt: meta.now };
  const materials = existing
    ? state.materials.map((m) => (m.id === material.id ? material : m))
    : [...state.materials, material];
  return { ok: true, material, state: { ...state, materials } };
}

export type RemoveMaterialResult = { ok: true; state: InventoryState } | { ok: false; error: string };

/** 删除物料（只允许没有流水的物料）。 */
export function removeMaterial(state: InventoryState, materialId: string): RemoveMaterialResult {
  if (!state.materials.some((m) => m.id === materialId)) return { ok: false, error: "找不到物料。" };
  if (hasMovements(state, materialId)) return { ok: false, error: "已有流水的物料不能删除，可以停用。" };
  return { ok: true, state: { ...state, materials: state.materials.filter((m) => m.id !== materialId) } };
}

/** 数据库主键用的 UUID。file:// 下没有 randomUUID 时退回 getRandomValues。 */
export function createId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
